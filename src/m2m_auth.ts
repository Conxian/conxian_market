/**
 * Conxian Market: Machine-to-Machine (M2M) authentication — **market-internal**.
 *
 * NOTE ON SCOPE: this module is a market-internal issuer with its own client
 * registry. It is **not** the organization M2M standard. The org contract is
 * defined by `conxius-platform` (`docs/M2M_AUTHENTICATION.md`) and verified by
 * the Gateway (`conxian-gateway` `internal/api/src/m2m_auth.rs`). To accept the
 * organization's service JWTs, use `org_m2m.ts` in this package. This module
 * remains for market-internal service credentials and for the EdDSA/JWKS
 * research that informed the org work.
 *
 * Gives the SDK a service-to-service credential so a machine (agent, provider
 * adapter, settlement worker) can authenticate *to* the market surface without
 * a human session, following the OAuth2 client-credentials pattern and
 * JWK-style signing-key rotation.
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

import {
  createHmac,
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign as cryptoSign,
  timingSafeEqual,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";

/** HS256 (shared secret) or EdDSA (Ed25519, asymmetric). */
export type M2MAlg = "HS256" | "EdDSA";

export const M2M_TOKEN_ALG = "HS256" as const;
export const M2M_EDDSA_ALG = "EdDSA" as const;

export interface MachineClient {
  clientId: string;
  /** SHA-256 (hex) of the client secret. The plaintext secret is never stored. */
  secretHash: string;
  /** Scopes this client may request. A request outside this set is denied. */
  allowedScopes: string[];
  /** Audiences this client may address. */
  allowedAudiences: string[];
  /**
   * Optional ERC-8004 agent identity this client is bound to. When set, tokens
   * issued for the client carry `agent`, and a verifier can require that the
   * credential and the agent identity agree — closing the gap where identity
   * (`agent_registry.ts`) and credential (here) were separate registrations.
   */
  agentId?: string;
}

export type SigningKeyStatus = "active" | "retired";

export interface SigningKey {
  kid: string;
  /** Defaults to `HS256` when omitted (backward compatible). */
  alg?: M2MAlg;
  /** HS256: HMAC key material. Supplied by the caller; never committed. */
  secret?: Buffer;
  /** EdDSA: signing key (issuer). Never leaves the issuer. */
  privateKey?: KeyObject;
  /** EdDSA: verify-only key. A verifier needs only this — no shared secret. */
  publicKey?: KeyObject;
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
  /** ERC-8004 agent id bound to the client, when the client is bound. */
  agent?: string;
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
  | "agent_mismatch"
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
  const encoded = buf.toString("base64").replace(/\+/gu, "-").replace(/\//gu, "_");
  // Strip trailing '=' padding with a linear scan (avoids a backtracking regex).
  let end = encoded.length;
  while (end > 0 && encoded.charCodeAt(end - 1) === 61 /* "=" */) end -= 1;
  return encoded.slice(0, end);
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/gu, "+").replace(/_/gu, "/") + pad, "base64");
}

function sign(kid: string, payloadSegment: string, alg: M2MAlg, key: SigningKey): string {
  const header = b64url(JSON.stringify({ alg, typ: "JWT", kid }));
  const signingInput = `${header}.${payloadSegment}`;
  let signature: Buffer;
  if (alg === "EdDSA") {
    if (!key.privateKey) throw new Error("EdDSA signing requires a private key");
    signature = cryptoSign(null, Buffer.from(signingInput, "utf8"), key.privateKey);
  } else {
    if (!key.secret) throw new Error("HS256 signing requires a secret");
    signature = createHmac("sha256", key.secret).update(signingInput).digest();
  }
  return `${signingInput}.${b64url(signature)}`;
}

function verifySignature(alg: M2MAlg, key: SigningKey, signingInput: string, signatureB64: string): boolean {
  const signature = fromB64url(signatureB64);
  if (alg === "EdDSA") {
    const publicKey = key.publicKey ?? (key.privateKey ? createPublicKey(key.privateKey) : undefined);
    if (!publicKey) return false;
    return cryptoVerify(null, Buffer.from(signingInput, "utf8"), publicKey, signature);
  }
  if (!key.secret) return false;
  const expected = createHmac("sha256", key.secret).update(signingInput).digest();
  return signature.length === expected.length && timingSafeEqual(signature, expected);
}

function keyAlg(key: SigningKey): M2MAlg {
  return key.alg ?? M2M_TOKEN_ALG;
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
      ...(client.agentId !== undefined ? { agentId: client.agentId } : {}),
    });
  }

  /** The ERC-8004 agent identity bound to a client, if any. */
  agentForClient(clientId: string): string | undefined {
    return this.clients.get(clientId)?.agentId;
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
      ...(client.agentId !== undefined ? { agent: client.agentId } : {}),
    };

    const active = this.activeKey();
    const payload = b64url(JSON.stringify(claims));
    return {
      accessToken: sign(active.kid, payload, keyAlg(active), active),
      tokenType: "Bearer",
      expiresIn: ttl,
      scope: claims.scope.join(" "),
    };
  }

  /** Verify a bearer token. Every failure path returns `{ ok: false }`. */
  verify(
    token: string,
    requirements: { audience: string; requiredScopes?: string[]; requiredAgent?: string },
  ): VerifyResult {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, reason: "malformed" };

    let header: { alg?: string; kid?: string };
    try {
      header = JSON.parse(fromB64url(parts[0]).toString("utf8"));
    } catch {
      return { ok: false, reason: "malformed" };
    }
    if (header.alg !== "HS256" && header.alg !== "EdDSA") return { ok: false, reason: "unsupported_alg" };

    const key = this.keys.find((candidate) => candidate.kid === header.kid);
    if (!key) return { ok: false, reason: "unknown_key" };
    // The header algorithm must match the key's algorithm: a token cannot
    // downgrade an asymmetric key to a shared-secret check (alg confusion).
    if (keyAlg(key) !== header.alg) return { ok: false, reason: "unsupported_alg" };
    if (key.status === "retired" && key.notAfter !== undefined && this.now() >= key.notAfter) {
      return { ok: false, reason: "expired_key" };
    }

    if (!verifySignature(header.alg as M2MAlg, key, `${parts[0]}.${parts[1]}`, parts[2])) {
      return { ok: false, reason: "bad_signature" };
    }

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
    // Credential/identity binding: when the caller requires an agent identity,
    // the token must carry exactly that agent. Fail closed otherwise.
    if (requirements.requiredAgent !== undefined && claims.agent !== requirements.requiredAgent) {
      return { ok: false, reason: "agent_mismatch" };
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
   * Rotation may change the algorithm (e.g. HS256 → EdDSA): old tokens verify
   * against the retired key until the grace window closes.
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
  jwks(): Array<{ kid: string; alg: M2MAlg; status: SigningKeyStatus; notAfter?: number }> {
    return this.keys.map((key) => ({
      kid: key.kid,
      alg: keyAlg(key),
      status: key.status,
      ...(key.notAfter !== undefined ? { notAfter: key.notAfter } : {}),
    }));
  }

  /**
   * An RFC 7517 JWK Set containing only the **public** keys, so a separate
   * verifier needs no shared secret. HS256 keys are symmetric and are therefore
   * omitted — publishing them would disclose the signing secret. Serve this at
   * `/.well-known/jwks.json`; it is safe to expose.
   */
  jwksDocument(): { keys: Record<string, unknown>[] } {
    const keys: Record<string, unknown>[] = [];
    for (const key of this.keys) {
      if (keyAlg(key) !== M2M_EDDSA_ALG) continue;
      const publicKey = key.publicKey ?? (key.privateKey ? createPublicKey(key.privateKey) : undefined);
      if (!publicKey) continue;
      const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
      keys.push({ ...jwk, kid: key.kid, alg: M2M_EDDSA_ALG, use: "sig" });
    }
    return { keys };
  }

  private activeKey(): SigningKey {
    const active = this.keys.find((key) => key.status === "active");
    if (!active) throw new Error("no active signing key");
    return active;
  }
}

/** Generate an Ed25519 keypair for asymmetric (EdDSA) M2M tokens. */
export function generateEd25519SigningKey(kid: string, createdAt: number, status: SigningKeyStatus = "active"): SigningKey {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { kid, alg: M2M_EDDSA_ALG, privateKey, publicKey, status, createdAt };
}

/** Extract a bearer token from an `authorization` header value, or undefined. */
export function bearerFromHeader(header: string | undefined | null): string | undefined {
  if (typeof header !== "string") return undefined;
  const trimmed = header.trim();
  // Linear, case-insensitive "Bearer " prefix check — avoids a backtracking regex
  // over attacker-controlled header input.
  const prefix = trimmed.slice(0, 7);
  if (prefix.toLowerCase() !== "bearer ") return undefined;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

/** Constant-time comparison of two strings (utf8). */
function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
