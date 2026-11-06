import { describe, expect, it } from "vitest";
import {
  isUsableEntitlement,
  resolveClientEntitlement,
  unverifiedObserverLicense,
  type EntitlementPurchaseReference,
  type EntitlementResolver,
} from "../src/entitlement_resolver.js";
import { SettlementRail, TrustTier, type ClientEntitlementLicense } from "../src/core_types.js";

const REFERENCE: EntitlementPurchaseReference = {
  paymentPointer: "$conxian.com/market/subscription/managed",
  clientDid: "did:conxian:org:client-001",
  transactionId: "tx_abc123",
};

function verifiedLicense(overrides: Partial<ClientEntitlementLicense> = {}): ClientEntitlementLicense {
  return {
    verificationStatus: "VERIFIED",
    licenseId: "lic_001",
    clientDid: REFERENCE.clientDid,
    tier: TrustTier.Managed,
    allowedRails: [SettlementRail.Lightning],
    maxActiveJobCards: 25,
    agentExecutionEnabled: true,
    ...overrides,
  };
}

describe("resolveClientEntitlement", () => {
  it("fails closed to the unverified baseline when no resolver is configured", async () => {
    const license = await resolveClientEntitlement(undefined, REFERENCE);
    expect(license.verificationStatus).toBe("UNVERIFIED");
    expect(license.tier).toBe(TrustTier.ObserverOnly);
    expect(license.agentExecutionEnabled).toBe(false);
    expect(license.maxActiveJobCards).toBe(0);
  });

  it("returns a VERIFIED, DID-bound, unexpired license as-is", async () => {
    const resolver: EntitlementResolver = { resolve: async () => verifiedLicense() };
    const license = await resolveClientEntitlement(resolver, REFERENCE);
    expect(license.verificationStatus).toBe("VERIFIED");
    expect(license.tier).toBe(TrustTier.Managed);
    expect(license.licenseId).toBe("lic_001");
  });

  it("fails closed when the resolver throws", async () => {
    const resolver: EntitlementResolver = { resolve: async () => { throw new Error("provider down"); } };
    const license = await resolveClientEntitlement(resolver, REFERENCE);
    expect(license.verificationStatus).toBe("UNVERIFIED");
    expect(license.tier).toBe(TrustTier.ObserverOnly);
  });

  it("fails closed when the resolver returns null", async () => {
    const resolver: EntitlementResolver = { resolve: async () => null };
    const license = await resolveClientEntitlement(resolver, REFERENCE);
    expect(license.verificationStatus).toBe("UNVERIFIED");
  });

  it("rejects a license bound to a different client DID", async () => {
    const resolver: EntitlementResolver = { resolve: async () => verifiedLicense({ clientDid: "did:conxian:org:other" }) };
    const license = await resolveClientEntitlement(resolver, REFERENCE);
    expect(license.verificationStatus).toBe("UNVERIFIED");
    expect(license.tier).toBe(TrustTier.ObserverOnly);
  });

  it("rejects an unverified license even with a high tier", async () => {
    const resolver: EntitlementResolver = { resolve: async () => verifiedLicense({ verificationStatus: "UNVERIFIED", tier: TrustTier.Strict }) };
    const license = await resolveClientEntitlement(resolver, REFERENCE);
    expect(license.tier).toBe(TrustTier.ObserverOnly);
  });

  it("rejects an expired license", async () => {
    const now = Date.parse("2026-11-06T00:00:00.000Z");
    const resolver: EntitlementResolver = {
      resolve: async () => verifiedLicense({ expiresAtIso: "2026-11-05T00:00:00.000Z" }),
    };
    const license = await resolveClientEntitlement(resolver, REFERENCE, now);
    expect(license.verificationStatus).toBe("UNVERIFIED");
  });

  it("accepts an unexpired license at the boundary", async () => {
    const now = Date.parse("2026-11-06T00:00:00.000Z");
    const resolver: EntitlementResolver = {
      resolve: async () => verifiedLicense({ expiresAtIso: "2026-11-07T00:00:00.000Z" }),
    };
    const license = await resolveClientEntitlement(resolver, REFERENCE, now);
    expect(license.verificationStatus).toBe("VERIFIED");
  });
});

describe("isUsableEntitlement", () => {
  it("requires VERIFIED status, DID match and future expiry", () => {
    expect(isUsableEntitlement(verifiedLicense(), REFERENCE.clientDid)).toBe(true);
    expect(isUsableEntitlement(null, REFERENCE.clientDid)).toBe(false);
    expect(isUsableEntitlement(verifiedLicense({ verificationStatus: "UNVERIFIED" }), REFERENCE.clientDid)).toBe(false);
    expect(isUsableEntitlement(verifiedLicense(), "did:conxian:other")).toBe(false);
    expect(isUsableEntitlement(verifiedLicense({ expiresAtIso: "not-a-date" }), REFERENCE.clientDid)).toBe(false);
  });
});

describe("unverifiedObserverLicense", () => {
  it("is the fail-closed baseline with no execution or rails", () => {
    const license = unverifiedObserverLicense("");
    expect(license.clientDid).toBe("did:conxian:anonymous");
    expect(license.verificationStatus).toBe("UNVERIFIED");
    expect(license.allowedRails).toEqual([]);
    expect(license.agentExecutionEnabled).toBe(false);
  });
});
