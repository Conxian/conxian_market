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

  it("should evaluate enterprise SLA diagnostics with HEALTHY status when latency is within threshold", () => {
    const report = ClientInstallerEngine.runEnterpriseSlaDiagnostics(validConfig, 50);

    expect(report.clientDid).toBe("did:conxian:enterprise:acme_corp");
    expect(report.overallSlaStatus).toBe("HEALTHY");
    expect(report.allEndpointsSlaCompliant).toBe(true);
    expect(report.diagnostics).toHaveLength(4);

    const gatewayDiag = report.diagnostics.find((d) => d.target === "Conxian Gateway REST/gRPC");
    expect(gatewayDiag?.status).toBe("OPTIMAL");
    expect(gatewayDiag?.slaCompliant).toBe(true);

    const nexusDiag = report.diagnostics.find((d) => d.target === "Conxian Nexus Glass Node");
    expect(nexusDiag?.status).toBe("OPTIMAL");
    expect(nexusDiag?.slaCompliant).toBe(true);
  });

  it("should evaluate enterprise SLA diagnostics with NON_COMPLIANT status when latency threshold is strict and breached", () => {
    const report = ClientInstallerEngine.runEnterpriseSlaDiagnostics(validConfig, 10);

    expect(report.overallSlaStatus).toBe("NON_COMPLIANT");
    expect(report.allEndpointsSlaCompliant).toBe(false);

    const gatewayDiag = report.diagnostics.find((d) => d.target === "Conxian Gateway REST/gRPC");
    expect(gatewayDiag?.status).toBe("DEGRADED");
    expect(gatewayDiag?.slaCompliant).toBe(false);
  });

  it("should wire runEnterpriseSlaDiagnostics into ConxianMarketSDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect({ baseUrl: "https://gateway.conxian.org" });
    const report = sdk.runEnterpriseSlaDiagnostics(validConfig, 100);

    expect(report.clientDid).toBe("did:conxian:enterprise:acme_corp");
    expect(report.overallSlaStatus).toBe("HEALTHY");
    expect(report.allEndpointsSlaCompliant).toBe(true);
  });
});

describe("B2B Enterprise Client Onboarding SLA Auto-Remediation Engine", () => {
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

  it("should perform no action when diagnostic report indicates HEALTHY SLA compliance", () => {
    const report = ClientInstallerEngine.runEnterpriseSlaDiagnostics(validConfig, 50);
    const remediation = ClientInstallerEngine.remediateEnterpriseSlaBreaches(validConfig, report);

    expect(remediation.clientDid).toBe("did:conxian:enterprise:acme_corp");
    expect(remediation.remediationApplied).toBe(false);
    expect(remediation.remediatedGatewayUrl).toBe("https://gateway.conxian.org");
    expect(remediation.actions.every((a) => a.actionTaken === "NO_ACTION_REQUIRED")).toBe(true);
  });

  it("should trigger failover fallback and endpoint rerouting when diagnostic report indicates SLA breaches", () => {
    const report = ClientInstallerEngine.runEnterpriseSlaDiagnostics(validConfig, 10);
    const remediation = ClientInstallerEngine.remediateEnterpriseSlaBreaches(
      validConfig,
      report,
      "https://gateway-fallback.conxian.org"
    );

    expect(remediation.remediationApplied).toBe(true);
    expect(remediation.remediatedGatewayUrl).toBe("https://gateway-fallback.conxian.org");

    const gatewayAction = remediation.actions.find((a) => a.target.toLowerCase().includes("gateway"));
    expect(gatewayAction?.actionTaken).toBe("FAILOVER_FALLBACK");
    expect(gatewayAction?.remediatedEndpointUrl).toBe("https://gateway-fallback.conxian.org");

    expect(remediation.remediationLogs.length).toBeGreaterThan(0);
  });

  it("should wire remediateEnterpriseSlaBreaches into ConxianMarketSDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect({ baseUrl: "https://gateway.conxian.org" });
    const report = sdk.runEnterpriseSlaDiagnostics(validConfig, 10);
    const remediation = sdk.remediateEnterpriseSlaBreaches(validConfig, report);

    expect(remediation.clientDid).toBe("did:conxian:enterprise:acme_corp");
    expect(remediation.remediationApplied).toBe(true);
    expect(remediation.remediatedGatewayUrl).toBe("https://gateway-fallback.conxian.org");
  });
});
