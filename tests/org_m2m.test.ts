import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyOrgM2mJwt, parseOrgBearer, ORG_SERVICE_PERMISSIONS, type OrgM2mConfig } from "../src/org_m2m.js";

const SECRET = "0123456789abcdef0123456789abcdef"; // 32 bytes
const ISSUER = "conxian-platform";
const AUDIENCE = "conxian-gateway";
const NOW = 1_700_000_000;

const b64url = (input: string | Buffer): string => Buffer.from(input).toString("base64url");

function sign(header: Record<string, unknown>, claims: Record<string, unknown>, secret = SECRET): string {
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(claims));
  const sig = b64url(createHmac("sha256", secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

const header = () => ({ alg: "HS256", typ: "JWT" });
const claims = (over: Record<string, unknown> = {}) => ({
  iss: ISSUER,
  aud: AUDIENCE,
  sub: "gateway",
  scope: "read:admin m2m:internal",
  iat: NOW,
  nbf: NOW,
  exp: NOW + 300,
  jti: "jti-1",
  ...over,
});

const config: OrgM2mConfig = { secret: SECRET, issuer: ISSUER, audience: AUDIENCE };

const bearer = (token: string) => `Bearer ${token}`;

describe("verifyOrgM2mJwt (organization contract)", () => {
  it("accepts a well-formed org service JWT", () => {
    const result = verifyOrgM2mJwt(bearer(sign(header(), claims())), config, NOW);
    expect(result).toEqual({ ok: true, serviceId: "gateway", scopes: ["read:admin", "m2m:internal"] });
  });

  it("rejects a short secret as invalid configuration", () => {
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims())), { ...config, secret: "short" }, NOW)).toEqual({
      ok: false,
      reason: "invalid_configuration",
    });
  });

  it("rejects alg/typ/kid header deviations", () => {
    for (const h of [
      { alg: "none", typ: "JWT" },
      { alg: "HS384", typ: "JWT" },
      { alg: "HS256", typ: "JWT", kid: "k1" },
      { alg: "HS256" },
    ]) {
      expect(verifyOrgM2mJwt(bearer(sign(h, claims())), config, NOW)).toEqual({ ok: false, reason: "invalid_header" });
    }
  });

  it("rejects a bad signature", () => {
    const token = sign(header(), claims(), "another-32-byte-secret-value!!!!");
    expect(verifyOrgM2mJwt(bearer(token), config, NOW)).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects wrong issuer and audience", () => {
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ iss: "evil" }))), config, NOW)).toEqual({
      ok: false,
      reason: "wrong_issuer",
    });
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ aud: "evil" }))), config, NOW)).toEqual({
      ok: false,
      reason: "wrong_audience",
    });
  });

  it("rejects an unknown service and a non-string audience", () => {
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ sub: "not-a-service" }))), config, NOW)).toEqual({
      ok: false,
      reason: "unknown_service",
    });
    // An array audience is not the contract's single string.
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ aud: [AUDIENCE] }))), config, NOW)).toEqual({
      ok: false,
      reason: "wrong_audience",
    });
  });

  it("rejects missing required claims", () => {
    for (const key of ["aud", "sub", "scope", "iat", "nbf", "exp", "jti"]) {
      const c = claims();
      delete (c as Record<string, unknown>)[key];
      const result = verifyOrgM2mJwt(bearer(sign(header(), c)), config, NOW);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects expired and future tokens outside skew", () => {
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ iat: NOW - 1000, nbf: NOW - 1000, exp: NOW - 100 }))), config, NOW)).toEqual({
      ok: false,
      reason: "lifetime_out_of_bounds",
    });
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ iat: NOW + 500, nbf: NOW + 500, exp: NOW + 800 }))), config, NOW)).toEqual({
      ok: false,
      reason: "lifetime_out_of_bounds",
    });
  });

  it("rejects out-of-bounds TTL", () => {
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ exp: NOW + 30 }))), config, NOW)).toEqual({
      ok: false,
      reason: "lifetime_out_of_bounds",
    });
    expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ exp: NOW + 5000 }))), config, NOW)).toEqual({
      ok: false,
      reason: "lifetime_out_of_bounds",
    });
  });

  it("rejects scope violations (unknown, duplicate, ceiling, missing m2m:internal)", () => {
    const cases = ["read:admin made:up m2m:internal", "read:admin read:admin m2m:internal", "write:treasury m2m:internal", "read:admin"];
    for (const scope of cases) {
      expect(verifyOrgM2mJwt(bearer(sign(header(), claims({ scope }))), config, NOW)).toEqual({
        ok: false,
        reason: "invalid_scope",
      });
    }
  });

  it("parseOrgBearer is bounded and case-insensitive", () => {
    expect(parseOrgBearer("Bearer abc.def.ghi")).toEqual({ ok: true, token: "abc.def.ghi" });
    expect(parseOrgBearer("bearer abc.def.ghi")).toEqual({ ok: true, token: "abc.def.ghi" });
    expect(parseOrgBearer("Basic abc").ok).toBe(false);
    expect(parseOrgBearer(undefined).ok).toBe(false);
    expect(parseOrgBearer(`Bearer ${"a".repeat(5000)}`).ok).toBe(false);
  });

  it("service ceilings all include m2m:internal", () => {
    for (const ceiling of Object.values(ORG_SERVICE_PERMISSIONS)) {
      expect(ceiling).toContain("m2m:internal");
    }
  });
});
