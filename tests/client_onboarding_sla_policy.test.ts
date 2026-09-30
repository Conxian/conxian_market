import { describe, it, expect } from "vitest";
import { ClientInstallerEngine } from "../src/client_onboarding";
import { ConxianMarketSDK } from "../src/sdk_bridge";
import {
  TrustTier,
  SettlementRail,
  ClientOnboardingConfig,
  SlaExemptionReason,
} from "../src/core_types";

describe("Session 69: B2B Enterprise Client Onboarding SLA Policy & Exemption Engine", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.org" };
  const baseConfig: ClientOnboardingConfig = {
    clientDid: "did:conxian:client:corp-99",
    gatewayUrl: "https://gateway.conxian.org/v1",
    nexusUrl: "https://nexus.conxian.org/v1",
    defaultSettlementRail: SettlementRail.Statechain,
    targetTrustTier: TrustTier.Strict,
  };

  it("should enforce open-source disclaimer and zero SLA coverage for public/unpaid contracts", () => {
    const result = ClientInstallerEngine.evaluateSlaPolicyAndExemptions(baseConfig, false);

    expect(result.isSlaCovered).toBe(false);
    expect(result.slaTier).toBe("NO_SLA_OPEN_SOURCE");
    expect(result.openSourceDisclaimerActive).toBe(true);
    expect(result.ackWindowHours).toBe(0);
    expect(result.patchWindowDays).toBe(0);
    expect(result.policySummary).toContain("community-best-effort basis");
  });

  it("should activate ENTERPRISE_PREMIUM SLA for Strict/Managed commercial B2B contracts", () => {
    const result = ClientInstallerEngine.evaluateSlaPolicyAndExemptions(baseConfig, true);

    expect(result.isSlaCovered).toBe(true);
    expect(result.slaTier).toBe("ENTERPRISE_PREMIUM");
    expect(result.openSourceDisclaimerActive).toBe(false);
    expect(result.ackWindowHours).toBe(2);
    expect(result.patchWindowDays).toBe(3);
    expect(result.policySummary).toContain("Target Acknowledgement Window: 2h");
  });

  it("should activate BUSINESS_HOURS_NBD SLA for Expedient/ObserverOnly commercial contracts", () => {
    const expedientConfig: ClientOnboardingConfig = {
      ...baseConfig,
      targetTrustTier: TrustTier.Expedient,
    };

    const result = ClientInstallerEngine.evaluateSlaPolicyAndExemptions(expedientConfig, true);

    expect(result.isSlaCovered).toBe(true);
    expect(result.slaTier).toBe("BUSINESS_HOURS_NBD");
    expect(result.ackWindowHours).toBe(24);
    expect(result.patchWindowDays).toBe(14);
  });

  it("should incorporate statutory force majeure and L1 network halt exemptions into policy summary", () => {
    const exemptions: SlaExemptionReason[] = [
      "BITCOIN_L1_CONGESTION",
      "STACKS_NETWORK_HALT",
      "HARDWARE_TEE_VENDOR_DEPRECATION",
    ];

    const result = ClientInstallerEngine.evaluateSlaPolicyAndExemptions(baseConfig, true, exemptions);

    expect(result.exemptionsActive).toEqual(exemptions);
    expect(result.policySummary).toContain("Statutory exemptions active: [BITCOIN_L1_CONGESTION, STACKS_NETWORK_HALT, HARDWARE_TEE_VENDOR_DEPRECATION]");
    expect(result.policySummary).toContain("Underlying L1/TEE network outages excluded from liability.");
  });

  it("should expose evaluateSlaPolicyAndExemptions via ConxianMarketSDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const result = sdk.evaluateSlaPolicyAndExemptions(baseConfig, true, ["FORCE_MAJEURE"]);

    expect(result.clientDid).toBe("did:conxian:client:corp-99");
    expect(result.isSlaCovered).toBe(true);
    expect(result.exemptionsActive).toContain("FORCE_MAJEURE");
  });
});
