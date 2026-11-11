/**
 * Conxian Market: Machine-to-Machine (M2M) authentication.
 *
 * Gives the SDK a standards-shaped service-to-service credential so a machine
 * (agent, provider adapter, settlement worker) can authenticate *to* the market
 * surface without a human session, following the OAuth2 client-credentials
 * pattern and JWK-style signing-key rotation.
 *
 * Design constraints (matches the repository posture):
 *   - No new runtime dependency: uses `node:crypto` only.
 *   - Fail-closed: every rejection path denies; there is no "allow on error".
 *   - The client secret and signing-key material are never logged or returned;
 *     `jwks()` exposes public metadata only.
 *   - Tokens are short-lived and scope-bound; a token is only usable for the
 *     audience and scopes it was issued for.
 *
 * This module authenticates a machine to a service. It does not verify
 * attestation or settle value — those remain in `verification.ts` and
 * `settlement.ts`.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const M2M_TOKEN_ALG = "HS256" as const;

export interface MachineClient {
  clientId: string;
  /** SHA-256 (hex) of the client secret. The plaintext secret is never stored. */
  secretHash: string;
  /** Scopes this client may request. A request outside this set is denied. */
  allowedScopes: string[];
  /** Audiences this client may address. */
  allowedAudiences: string[];
}

export type SigningKeyStatus = "active" | "retired";

export interface SigningKey {
  kid: string;
  /** HMAC key material. Supplied by the caller from a secret store; never committed. */
  secret: Buffer;
  status: SigningKeyStatus;
  createdAt: number;
  /**
   * Retired keys stop verifying after this instant (ms). An active key has none.
   * Retiring — rather than deleting — is what lets rotation proceed without
   * invalidating tokens signed moments earlier.
   */
  notAfter?: number;
}

export interface TokenClaims {
  iss: string;
  sub: string;
  aud: string[];
  scope: string[];
  iat: number;
  exp: number;
  jti: string;
}

export interface IssuedToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  scope: string;
}

export type VerifyFailure =
  | "malformed"
  | "unsupported_alg"
  | "unknown_key"
  | "expired_key"
  | "bad_signature"
  | "wrong_issuer"
  | "not_yet_valid"
  | "expired"
  | "wrong_audience"
  | "insufficient_scope"
  | "replayed";

export type VerifyResult =
  | { ok: true; claims: TokenClaims }
  | { ok: false; reason: VerifyFailure };

export interface AuthorityOptions {
  issuer: string;
  keys: SigningKey[];
  now?: () => number;
  defaultTtlSeconds?: number;
  /** Optional one-time-use enforcement keyed on `jti`. */
  replayGuard?: { claim(jti: string): boolean };
}

const DEFAULT_TTL_SECONDS = 300;

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64").replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/gu, "+").replace(/_/gu, "/") + pad, "base64");
}

function sign(kid: string, payloadSegment: string, secret: Buffer): string {
  const header = b64url(JSON.stringify({ alg: M2M_TOKEN_ALG, typ: "JWT", kid }));
  return `${header}.${payloadSegment}.${b64url(createHmac("sha256", secret).update(`${header}.${payloadSegment}`).digest())}`;
}

/**
 * Issues and verifies scoped machine tokens against a rotating signing keyset.
 */
export class MachineTokenAuthority {
  private readonly issuer: string;
  private readonly keys: SigningKey[];
  private readonly now: () => number;
  private readonly defaultTtlSeconds: number;
  private readonly replayGuard?: { claim(jti: string): boolean };
  private readonly clients = new Map<string, MachineClient>();

  constructor(options: AuthorityOptions) {
    if (options.keys.length === 0) throw new Error("at least one signing key is required");
    if (new Set(options.keys.map((k) => k.kid)).size !== options.keys.length) {
      throw new Error("signing key ids must be unique");
    }
    this.issuer = options.issuer;
    this.keys = [...options.keys];
    this.now = options.now ?? (() => Date.now());
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? DEFAULT_TTL_SECONDS;
    this.replayGuard = options.replayGuard;
  }

  /** Register a client. The secret is hashed on entry and never retained. */
  registerClient(client: Omit<MachineClient, "secretHash"> & { secret: string }): void {
    const secretHash = createHmac("sha256", "conxian-m2m-client").update(client.secret).digest("hex");
    this.clients.set(client.clientId, {
      clientId: client.clientId,
      secretHash,
      allowedScopes: [...client.allowedScopes],
      allowedAudiences: [...client.allowedAudiences],
    });
  }

  /**
   * Issue a token for the OAuth2 client-credentials grant. Denies (throws) on
   * unknown client, wrong secret, unknown audience, or an over-broad scope.
   */
  issue(input: { clientId: string; clientSecret: string; audience: string; scopes?: string[]; ttlSeconds?: number }): IssuedToken {
    const client = this.clients.get(input.clientId);
    if (!client) throw new Error("unknown client");
    const presented = createHmac("sha256", "conxian-m2m-client").update(input.clientSecret).digest("hex");
    if (!safeEqualString(presented, client.secretHash)) throw new Error("invalid client credentials");
    if (!client.allowedAudiences.includes(input.audience)) throw new Error("audience not permitted for client");

    const requested = input.scopes ?? client.allowedScopes;
    for (const scope of requested) {
      if (!client.allowedScopes.includes(scope)) throw new Error(`scope not permitted for client: ${scope}`);
    }

    const iat = Math.floor(this.now() / 1000);
    const ttl = input.ttlSeconds ?? this.defaultTtlSeconds;
    const claims: TokenClaims = {
      iss: this.issuer,
      sub: client.clientId,
      aud: [input.audience],
      scope: [...requested],
      iat,
      exp: iat + ttl,
      jti: randomUUID(),
    };

    const active = this.activeKey();
    const payload = b64url(JSON.stringify(claims));
    return {
      accessToken: sign(active.kid, payload, active.secret),
      tokenType: "Bearer",
      expiresIn: ttl,
      scope: claims.scope.join(" "),
    };
  }

  /** Verify a bearer token. Every failure path returns `{ ok: false }`. */
  verify(token: string, requirements: { audience: string; requiredScopes?: string[] }): VerifyResult {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, reason: "malformed" };

    let header: { alg?: string; kid?: string };
    try {
      header = JSON.parse(fromB64url(parts[0]).toString("utf8"));
    } catch {
      return { ok: false, reason: "malformed" };
    }
    if (header.alg !== M2M_TOKEN_ALG) return { ok: false, reason: "unsupported_alg" };

    const key = this.keys.find((candidate) => candidate.kid === header.kid);
    if (!key) return { ok: false, reason: "unknown_key" };
    if (key.status === "retired" && key.notAfter !== undefined && this.now() >= key.notAfter) {
      return { ok: false, reason: "expired_key" };
    }

    const expected = sign(key.kid, parts[1], key.secret).split(".")[2];
    if (!safeEqualString(expected, parts[2])) return { ok: false, reason: "bad_signature" };

    let claims: TokenClaims;
    try {
      claims = JSON.parse(fromB64url(parts[1]).toString("utf8"));
    } catch {
      return { ok: false, reason: "malformed" };
    }

    if (claims.iss !== this.issuer) return { ok: false, reason: "wrong_issuer" };
    const nowSeconds = Math.floor(this.now() / 1000);
    if (typeof claims.iat === "number" && claims.iat > nowSeconds) return { ok: false, reason: "not_yet_valid" };
    if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) return { ok: false, reason: "expired" };
    if (!Array.isArray(claims.aud) || !claims.aud.includes(requirements.audience)) {
      return { ok: false, reason: "wrong_audience" };
    }
    for (const scope of requirements.requiredScopes ?? []) {
      if (!Array.isArray(claims.scope) || !claims.scope.includes(scope)) {
        return { ok: false, reason: "insufficient_scope" };
      }
    }
    if (this.replayGuard && !this.replayGuard.claim(claims.jti)) {
      return { ok: false, reason: "replayed" };
    }

    return { ok: true, claims };
  }

  /**
   * Rotate the signing keyset: the new key becomes active and the previous
   * active key is retired but kept verifying until `retireAfter` (ms). This is
   * the JWK-rotation step — tokens signed just before rotation stay valid.
   */
  rotate(newKey: SigningKey, retireAfterMs: number): void {
    if (this.keys.some((k) => k.kid === newKey.kid)) throw new Error("signing key id already present");
    const retireAt = this.now() + retireAfterMs;
    for (const key of this.keys) {
      if (key.status === "active") {
        key.status = "retired";
        key.notAfter = retireAt;
      }
    }
    this.keys.push({ ...newKey, status: "active" });
  }

  /** Public keyset metadata (JWKS shape). Never includes secret material. */
  jwks(): Array<{ kid: string; alg: string; status: SigningKeyStatus; notAfter?: number }> {
    return this.keys.map((key) => ({
      kid: key.kid,
      alg: M2M_TOKEN_ALG,
      status: key.status,
      ...(key.notAfter !== undefined ? { notAfter: key.notAfter } : {}),
    }));
  }

  private activeKey(): SigningKey {
    const active = this.keys.find((key) => key.status === "active");
    if (!active) throw new Error("no active signing key");
    return active;
  }
}

/** Constant-time comparison of two strings (utf8). */
function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
