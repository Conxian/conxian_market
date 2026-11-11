/**
 * Conxian Market: verification of the **organization** M2M service JWTs.
 *
 * The organization's M2M contract is defined by `conxius-platform`
 * (`docs/M2M_AUTHENTICATION.md` + the `2026-07-22-issue-1160-m2m-jwt-auth`
 * spec) and implemented on the Gateway in `internal/api/src/m2m_auth.rs`. This
 * module lets the market SDK accept the *same* tokens, so a machine holds one
 * credential the whole ecosystem can verify rather than a market-specific one.
 *
 * The contract (identical to the Gateway verifier):
 *   - compact JWS, `alg` exactly `HS256`, `typ` exactly `JWT`, no `kid`;
 *   - required `iss`/`aud` (exact single string)/`sub`/`scope`/`iat`/`nbf`/`exp`/`jti`;
 *   - TTL bounded to 60..900 s; clock skew bounded to 0..60 s;
 *   - scopes known, non-duplicate, a subset of the service ceiling, and include
 *     `m2m:internal`;
 *   - fail-closed on any deviation.
 *
 * `m2m_auth.ts` (this repo) is a separate, market-internal issuer with its own
 * registry; it is **not** the org standard. Use this module to accept the org
 * contract.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const ORG_M2M_ALG = "HS256";
export const ORG_M2M_TYP = "JWT";
export const ORG_M2M_DEFAULT_CLOCK_SKEW_SECONDS = 30;
export const ORG_M2M_MAX_CLOCK_SKEW_SECONDS = 60;
export const ORG_M2M_MIN_TTL_SECONDS = 60;
export const ORG_M2M_MAX_TTL_SECONDS = 900;
export const ORG_M2M_MIN_SECRET_BYTES = 32;
export const ORG_M2M_MAX_BEARER_BYTES = 4096;
export const ORG_M2M_INTERNAL_SCOPE = "m2m:internal";

/** Registered JWT service identities (mirrors the platform `SERVICE_IDS` minus `external`). */
export const ORG_JWT_SERVICE_IDS = [
  "gateway",
  "elizaos",
  "nexus",
  "orbit",
  "wallet",
  "ui",
  "admin-dashboard",
  "pulse-bos",
] as const;

/** Known scope vocabulary (mirrors the platform `KNOWN_SCOPES`). */
export const ORG_KNOWN_SCOPES = [
  "read:admin",
  "write:admin",
  "read:governance",
  "write:governance",
  "read:treasury",
  "write:treasury",
  "read:metrics",
  "admin:secrets",
  "admin:deploy",
  "m2m:internal",
  "read:telemetry",
  "read:settlement",
  "write:settlement",
] as const;

/** Per-service permission ceiling (mirrors the platform `SERVICE_PERMISSIONS`). */
export const ORG_SERVICE_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  gateway: ["read:admin", "read:governance", "read:treasury", "read:metrics", "m2m:internal"],
  elizaos: ["read:admin", "read:governance", "read:metrics", "m2m:internal"],
  nexus: ["read:governance", "read:treasury", "read:metrics", "write:governance", "m2m:internal"],
  orbit: ["admin:deploy", "m2m:internal"],
  wallet: ["read:treasury", "write:governance", "m2m:internal"],
  ui: ["read:admin", "read:governance", "read:treasury", "read:metrics", "m2m:internal"],
  "admin-dashboard": [
    "read:admin",
    "write:admin",
    "read:governance",
    "write:governance",
    "read:treasury",
    "write:treasury",
    "read:metrics",
    "admin:secrets",
    "admin:deploy",
    "m2m:internal",
    "read:telemetry",
    "read:settlement",
    "write:settlement",
  ],
  "pulse-bos": ["read:admin", "read:treasury", "read:metrics", "m2m:internal"],
};

export type OrgM2mFailure =
  | "malformed_bearer"
  | "invalid_configuration"
  | "invalid_header"
  | "invalid_signature"
  | "invalid_claims"
  | "wrong_issuer"
  | "wrong_audience"
  | "unknown_service"
  | "invalid_scope"
  | "lifetime_out_of_bounds";

export type OrgM2mResult =
  | { ok: true; serviceId: string; scopes: string[] }
  | { ok: false; reason: OrgM2mFailure };

export interface OrgM2mConfig {
  secret: string;
  issuer: string;
  audience: string;
  clockSkewSeconds?: number;
}

interface OrgM2mClaims {
  iss: string;
  aud: string;
  sub: string;
  scope: string;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
}

function b64urlDecode(input: string): Buffer | null {
  try {
    return Buffer.from(input, "base64url");
  } catch {
    return null;
  }
}

/** Parse `Authorization: Bearer <token>` with a bounded token size. */
export function parseOrgBearer(authorization: string | undefined | null): { ok: true; token: string } | { ok: false; reason: OrgM2mFailure } {
  if (typeof authorization !== "string") return { ok: false, reason: "malformed_bearer" };
  const trimmed = authorization.trim();
  if (trimmed.slice(0, 7).toLowerCase() !== "bearer ") return { ok: false, reason: "malformed_bearer" };
  const token = trimmed.slice(7).trim();
  if (token.length === 0 || token.length > ORG_M2M_MAX_BEARER_BYTES) return { ok: false, reason: "malformed_bearer" };
  return { ok: true, token };
}

function parseScopes(claim: unknown): string[] | null {
  if (typeof claim !== "string" || claim.length === 0) return null;
  if (claim.startsWith(" ") || claim.endsWith(" ") || claim.includes("  ")) return null;
  const seen = new Set<string>();
  const scopes: string[] = [];
  for (const scope of claim.split(" ")) {
    if (!(ORG_KNOWN_SCOPES as readonly string[]).includes(scope)) return null;
    if (seen.has(scope)) return null;
    seen.add(scope);
    scopes.push(scope);
  }
  return scopes.length > 0 ? scopes : null;
}

/**
 * Verify a compact HS256 JWT against the organization contract.
 * `nowSeconds` is injected for deterministic testing.
 */
export function verifyOrgM2mJwt(
  authorization: string | undefined | null,
  config: OrgM2mConfig,
  nowSeconds: number,
): OrgM2mResult {
  if (config.secret.length < ORG_M2M_MIN_SECRET_BYTES) return { ok: false, reason: "invalid_configuration" };
  const skew = config.clockSkewSeconds ?? ORG_M2M_DEFAULT_CLOCK_SKEW_SECONDS;
  if (!Number.isInteger(skew) || skew < 0 || skew > ORG_M2M_MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "invalid_configuration" };
  }

  const parsed = parseOrgBearer(authorization);
  if (!parsed.ok) return parsed;

  const parts = parsed.token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid_header" };
  const [headerB64, payloadB64, signatureB64] = parts;

  const headerBytes = b64urlDecode(headerB64);
  if (!headerBytes) return { ok: false, reason: "invalid_header" };
  let header: { alg?: unknown; typ?: unknown; kid?: unknown };
  try {
    header = JSON.parse(headerBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid_header" };
  }
  if (header.alg !== ORG_M2M_ALG || header.typ !== ORG_M2M_TYP || header.kid !== undefined) {
    return { ok: false, reason: "invalid_header" };
  }

  const expected = createHmac("sha256", config.secret).update(`${headerB64}.${payloadB64}`).digest();
  const provided = b64urlDecode(signatureB64);
  if (!provided || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "invalid_signature" };
  }

  const payloadBytes = b64urlDecode(payloadB64);
  if (!payloadBytes) return { ok: false, reason: "invalid_claims" };
  let raw: Partial<OrgM2mClaims>;
  try {
    raw = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid_claims" };
  }

  if (raw.iss !== config.issuer) return { ok: false, reason: "wrong_issuer" };
  if (raw.aud !== config.audience) return { ok: false, reason: "wrong_audience" };
  if (typeof raw.sub !== "string" || !(ORG_JWT_SERVICE_IDS as readonly string[]).includes(raw.sub)) {
    return { ok: false, reason: "unknown_service" };
  }
  if (
    typeof raw.iat !== "number" ||
    typeof raw.nbf !== "number" ||
    typeof raw.exp !== "number" ||
    !Number.isSafeInteger(raw.iat) ||
    !Number.isSafeInteger(raw.nbf) ||
    !Number.isSafeInteger(raw.exp) ||
    raw.iat < 0 ||
    raw.nbf < 0 ||
    raw.exp < 0
  ) {
    return { ok: false, reason: "invalid_claims" };
  }
  if (typeof raw.jti !== "string" || raw.jti.length === 0 || raw.jti.length > 128 || /[\s\u0000-\u001f\u007f]/u.test(raw.jti)) {
    return { ok: false, reason: "invalid_claims" };
  }

  const ttl = raw.exp - raw.iat;
  if (ttl < ORG_M2M_MIN_TTL_SECONDS || ttl > ORG_M2M_MAX_TTL_SECONDS) return { ok: false, reason: "lifetime_out_of_bounds" };
  if (raw.nbf > raw.iat + ORG_M2M_MAX_CLOCK_SKEW_SECONDS || raw.nbf < raw.iat - ORG_M2M_MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "lifetime_out_of_bounds" };
  }
  if (raw.exp <= nowSeconds - skew) return { ok: false, reason: "lifetime_out_of_bounds" };
  if (raw.nbf > nowSeconds + skew) return { ok: false, reason: "lifetime_out_of_bounds" };

  const scopes = parseScopes(raw.scope);
  if (!scopes) return { ok: false, reason: "invalid_scope" };
  const ceiling = ORG_SERVICE_PERMISSIONS[raw.sub];
  if (!ceiling) return { ok: false, reason: "unknown_service" };
  if (!scopes.includes(ORG_M2M_INTERNAL_SCOPE)) return { ok: false, reason: "invalid_scope" };
  for (const scope of scopes) {
    if (!ceiling.includes(scope)) return { ok: false, reason: "invalid_scope" };
  }

  return { ok: true, serviceId: raw.sub, scopes };
}
