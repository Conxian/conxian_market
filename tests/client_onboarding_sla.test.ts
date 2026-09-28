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

describe("B2B Enterprise Multi-Region Gateway Failover & Latency Balancer Engine", () => {
  const multiRegionConfig: import("../src").MultiRegionGatewayConfig = {
    clientDid: "did:conxian:enterprise:global_corp",
    primaryRegion: "us-east",
    regionalEndpoints: [
      { region: "us-east", gatewayUrl: "https://gateway-us-east.conxian.org" },
      { region: "eu-west", gatewayUrl: "https://gateway-eu-west.conxian.org" },
      { region: "ap-southeast", gatewayUrl: "https://gateway-ap-southeast.conxian.org" },
    ],
  };

  it("should keep primary region when primary endpoint is optimal and within latency threshold", () => {
    const failover = ClientInstallerEngine.balanceAndFailoverMultiRegionGateways(multiRegionConfig, 100);

    expect(failover.clientDid).toBe("did:conxian:enterprise:global_corp");
    expect(failover.primaryRegion).toBe("us-east");
    expect(failover.selectedRegion).toBe("us-east");
    expect(failover.selectedGatewayUrl).toBe("https://gateway-us-east.conxian.org");
    expect(failover.failoverTriggered).toBe(false);
    expect(failover.healthProbes).toHaveLength(3);
    expect(failover.healthProbes.every((p) => p.healthy)).toBe(true);
  });

  it("should trigger failover to lowest-latency healthy secondary region when primary is offline", () => {
    const degradedConfig: import("../src").MultiRegionGatewayConfig = {
      ...multiRegionConfig,
      regionalEndpoints: [
        { region: "us-east", gatewayUrl: "https://gateway-us-east-offline.conxian.org" },
        { region: "eu-west", gatewayUrl: "https://gateway-eu-west.conxian.org" },
        { region: "ap-southeast", gatewayUrl: "https://gateway-ap-southeast.conxian.org" },
      ],
    };

    const failover = ClientInstallerEngine.balanceAndFailoverMultiRegionGateways(degradedConfig, 100);

    expect(failover.failoverTriggered).toBe(true);
    expect(failover.selectedRegion).toBe("eu-west");
    expect(failover.selectedGatewayUrl).toBe("https://gateway-eu-west.conxian.org");

    const primaryProbe = failover.healthProbes.find((p) => p.region === "us-east");
    expect(primaryProbe?.healthy).toBe(false);
  });

  it("should wire balanceAndFailoverMultiRegionGateways into ConxianMarketSDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect({ baseUrl: "https://gateway.conxian.org" });
    const failover = sdk.balanceAndFailoverMultiRegionGateways(multiRegionConfig, 100);

    expect(failover.clientDid).toBe("did:conxian:enterprise:global_corp");
    expect(failover.selectedRegion).toBe("us-east");
    expect(failover.failoverTriggered).toBe(false);
  });
});
