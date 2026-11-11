import { describe, expect, it } from "vitest";
import { TrustTierMiddleware } from "../src/trust_tier_middleware.js";
import { MachineTokenAuthority } from "../src/m2m_auth.js";

const AUD = "https://api.market.conxian.example";

function setup() {
  const authority = new MachineTokenAuthority({
    issuer: "https://market.conxian.example",
    keys: [{ kid: "k1", secret: Buffer.from("middleware-test-key"), status: "active", createdAt: 0 }],
  });
  authority.registerClient({
    clientId: "svc-settlement",
    secret: "s",
    allowedScopes: ["settle:write"],
    allowedAudiences: [AUD],
    agentId: "agent-7",
  });
  return { authority, middleware: new TrustTierMiddleware() };
}

describe("TrustTierMiddleware.authenticate (authn before tier authz)", () => {
  it("authenticates a valid bearer token and surfaces the client identity", () => {
    const { authority, middleware } = setup();
    const token = authority.issue({ clientId: "svc-settlement", clientSecret: "s", audience: AUD });
    const result = middleware.authenticate({ authorization: `Bearer ${token.accessToken}` }, {
      authority,
      audience: AUD,
      requiredScopes: ["settle:write"],
      requiredAgent: "agent-7",
    });
    expect(result).toEqual({
      authenticated: true,
      clientId: "svc-settlement",
      agent: "agent-7",
      scopes: ["settle:write"],
    });
  });

  it("fails closed when the token is missing", () => {
    const { authority, middleware } = setup();
    expect(middleware.authenticate({}, { authority, audience: AUD })).toEqual({
      authenticated: false,
      reason: "missing_token",
    });
  });

  it("propagates a verification failure reason", () => {
    const { authority, middleware } = setup();
    const token = authority.issue({ clientId: "svc-settlement", clientSecret: "s", audience: AUD });
    expect(
      middleware.authenticate({ authorization: `Bearer ${token.accessToken}` }, { authority, audience: "https://other.example" }),
    ).toEqual({ authenticated: false, reason: "wrong_audience" });
  });

  it("rejects a token whose bound agent does not match the required agent", () => {
    const { authority, middleware } = setup();
    const token = authority.issue({ clientId: "svc-settlement", clientSecret: "s", audience: AUD });
    expect(
      middleware.authenticate({ authorization: `Bearer ${token.accessToken}` }, { authority, audience: AUD, requiredAgent: "agent-9" }),
    ).toEqual({ authenticated: false, reason: "agent_mismatch" });
  });

  it("does not authenticate from the attestation headers alone", () => {
    const { authority, middleware } = setup();
    expect(
      middleware.authenticate({ "x-conxian-tee-proof": "proof" }, { authority, audience: AUD }),
    ).toEqual({ authenticated: false, reason: "missing_token" });
  });
});
