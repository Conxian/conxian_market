import { describe, expect, it } from "vitest";
import {
  ClientInstallerEngine,
  ConxianMarketSDK,
  TrustTier,
  SettlementRail,
  ClientOnboardingConfig,
} from "../src";

describe("B2B Enterprise Client Onboarding SLA Diagnostics Engine", () => {
  const validConfig: ClientOnboardingConfig = {
    clientDid: "did:conxian:enterprise:acme_corp",
    gatewayUrl: "https://gateway.conxian.org",
    nexusUrl: "https://nexus.conxian.org",
    defaultSettlementRail: SettlementRail.EvmErc8183,
    targetTrustTier: TrustTier.Strict,
    byoLlmKeys: {
      deepseekApiKey: "sk-deepseek-test-key-12345",
    },
  };

  it("leaves SLA status unverified without measurements", () => {
    const report = ClientInstallerEngine.runEnterpriseSlaDiagnostics(validConfig, 50);

    expect(report.clientDid).toBe("did:conxian:enterprise:acme_corp");
    expect(report.overallSlaStatus).toBe("UNVERIFIED");
    expect(report.allEndpointsSlaCompliant).toBe(false);
    expect(report.diagnostics).toHaveLength(4);

    const gatewayDiag = report.diagnostics.find((d) => d.target === "gateway");
    expect(gatewayDiag?.status).toBe("UNVERIFIED");
    expect(gatewayDiag?.slaCompliant).toBe(false);

    const nexusDiag = report.diagnostics.find((d) => d.target === "nexus");
    expect(nexusDiag?.status).toBe("UNVERIFIED");
    expect(nexusDiag?.slaCompliant).toBe(false);
  });

  it("does not manufacture a latency breach from a threshold", () => {
    const report = ClientInstallerEngine.runEnterpriseSlaDiagnostics(validConfig, 10);

    expect(report.overallSlaStatus).toBe("UNVERIFIED");
    expect(report.allEndpointsSlaCompliant).toBe(false);

    const gatewayDiag = report.diagnostics.find((d) => d.target === "gateway");
    expect(gatewayDiag?.status).toBe("UNVERIFIED");
    expect(gatewayDiag?.slaCompliant).toBe(false);
  });

  it("should wire runEnterpriseSlaDiagnostics into ConxianMarketSDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect({ baseUrl: "https://gateway.conxian.org" });
    const report = sdk.runEnterpriseSlaDiagnostics(validConfig, 100);

    expect(report.clientDid).toBe("did:conxian:enterprise:acme_corp");
    expect(report.overallSlaStatus).toBe("UNVERIFIED");
    expect(report.allEndpointsSlaCompliant).toBe(false);
  });
});
