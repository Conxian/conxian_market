import { describe, expect, it } from "vitest";
import { MachineTokenAuthority, M2M_TOKEN_ALG } from "../src/m2m_auth.js";

function authority(overrides: { now?: () => number; keys?: any[] } = {}) {
  const auth = new MachineTokenAuthority({
    issuer: "https://market.conxian.example",
    keys: overrides.keys ?? [{ kid: "k1", secret: Buffer.from("test-signing-key-material-1"), status: "active", createdAt: 0 }],
    now: overrides.now,
    defaultTtlSeconds: 300,
  });
  auth.registerClient({
    clientId: "svc-settlement",
    secret: "correct-horse-battery-staple",
    allowedScopes: ["settle:write", "jobs:read"],
    allowedAudiences: ["https://api.conxian.example"],
  });
  return auth;
}

const AUD = "https://api.conxian.example";

describe("MachineTokenAuthority", () => {
  it("issues a token a matching audience+scope can verify", () => {
    const auth = authority();
    const token = auth.issue({
      clientId: "svc-settlement",
      clientSecret: "correct-horse-battery-staple",
      audience: AUD,
      scopes: ["settle:write"],
    });
    expect(token.tokenType).toBe("Bearer");
    const result = auth.verify(token.accessToken, { audience: AUD, requiredScopes: ["settle:write"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe("svc-settlement");
      expect(result.claims.iss).toBe("https://market.conxian.example");
    }
  });

  it("rejects an unknown client and a wrong secret", () => {
    const auth = authority();
    expect(() =>
      auth.issue({ clientId: "nope", clientSecret: "x", audience: AUD }),
    ).toThrow(/unknown client/);
    expect(() =>
      auth.issue({ clientId: "svc-settlement", clientSecret: "wrong", audience: AUD }),
    ).toThrow(/invalid client credentials/);
  });

  it("denies an over-broad scope and an unpermitted audience", () => {
    const auth = authority();
    expect(() =>
      auth.issue({ clientId: "svc-settlement", clientSecret: "correct-horse-battery-staple", audience: AUD, scopes: ["admin:all"] }),
    ).toThrow(/scope not permitted/);
    expect(() =>
      auth.issue({ clientId: "svc-settlement", clientSecret: "correct-horse-battery-staple", audience: "https://evil.example" }),
    ).toThrow(/audience not permitted/);
  });

  it("rejects a tampered payload (bad signature)", () => {
    const auth = authority();
    const token = auth.issue({ clientId: "svc-settlement", clientSecret: "correct-horse-battery-staple", audience: AUD });
    const [h, , s] = token.accessToken.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ iss: "https://market.conxian.example", sub: "svc-settlement", aud: [AUD], scope: ["admin:all"], iat: 0, exp: 9999999999, jti: "x" })).toString("base64url");
    const result = auth.verify(`${h}.${forgedPayload}.${s}`, { audience: AUD });
    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects expired tokens and wrong audience", () => {
    let now = 1_000_000;
    const auth = authority({ now: () => now });
    const token = auth.issue({ clientId: "svc-settlement", clientSecret: "correct-horse-battery-staple", audience: AUD, ttlSeconds: 60 });
    now += 61_000;
    expect(auth.verify(token.accessToken, { audience: AUD })).toEqual({ ok: false, reason: "expired" });

    const fresh = authority().issue({ clientId: "svc-settlement", clientSecret: "correct-horse-battery-staple", audience: AUD });
    expect(authority().verify(fresh.accessToken, { audience: "https://other.example" })).toEqual({ ok: false, reason: "wrong_audience" });
  });

  it("requires the requested scopes", () => {
    const auth = authority();
    const token = auth.issue({ clientId: "svc-settlement", clientSecret: "correct-horse-battery-staple", audience: AUD, scopes: ["jobs:read"] });
    expect(auth.verify(token.accessToken, { audience: AUD, requiredScopes: ["settle:write"] })).toEqual({ ok: false, reason: "insufficient_scope" });
  });

  it("rotates keys: tokens signed before rotation still verify, retired keys expire", () => {
    let now = 0;
    const auth = authority({ now: () => now });
    const before = auth.issue({ clientId: "svc-settlement", clientSecret: "correct-horse-battery-staple", audience: AUD });

    now = 1000;
    auth.rotate({ kid: "k2", secret: Buffer.from("test-signing-key-material-2"), status: "active", createdAt: now }, 60_000);

    // Old token still verifies while the retired key is inside its grace window.
    expect(auth.verify(before.accessToken, { audience: AUD }).ok).toBe(true);

    // New tokens are signed with the active key.
    const after = auth.issue({ clientId: "svc-settlement", clientSecret: "correct-horse-battery-staple", audience: AUD });
    const [h2] = after.accessToken.split(".");
    expect(JSON.parse(Buffer.from(h2, "base64url").toString("utf8")).kid).toBe("k2");

    // After the grace window the retired key no longer verifies.
    now = 1000 + 60_001;
    expect(auth.verify(before.accessToken, { audience: AUD })).toEqual({ ok: false, reason: "expired_key" });
  });

  it("exposes JWKS metadata without secret material", () => {
    const auth = authority();
    const jwks = auth.jwks();
    expect(jwks).toEqual([{ kid: "k1", alg: M2M_TOKEN_ALG, status: "active" }]);
    expect(JSON.stringify(jwks)).not.toContain("test-signing-key-material");
  });

  it("fails closed on a replayed jti when a replay guard is configured", () => {
    const seen = new Set<string>();
    const auth = new MachineTokenAuthority({
      issuer: "https://market.conxian.example",
      keys: [{ kid: "k1", secret: Buffer.from("test-signing-key-material-1"), status: "active", createdAt: 0 }],
      replayGuard: { claim: (jti) => (seen.has(jti) ? false : (seen.add(jti), true)) },
    });
    auth.registerClient({ clientId: "svc-settlement", secret: "s", allowedScopes: ["settle:write"], allowedAudiences: [AUD] });
    const token = auth.issue({ clientId: "svc-settlement", clientSecret: "s", audience: AUD });
    expect(auth.verify(token.accessToken, { audience: AUD }).ok).toBe(true);
    expect(auth.verify(token.accessToken, { audience: AUD })).toEqual({ ok: false, reason: "replayed" });
  });
});
