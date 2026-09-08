import { describe, it, expect } from "vitest";
import { ClientInstallerEngine } from "../src/client_onboarding";
import { ClientOnboardingConfig, TrustTier, SettlementRail } from "../src/core_types";

describe("ClientInstallerEngine", () => {
  const validConfig: ClientOnboardingConfig = {
    clientDid: "did:conxian:org:client-001",
    gatewayUrl: "https://gateway.conxian.org",
    nexusUrl: "https://nexus.conxian.org",
    defaultSettlementRail: SettlementRail.EvmErc8183,
    targetTrustTier: TrustTier.Strict,
    byoLlmKeys: {
      deepseekApiKey: "sk-ds-test-12345",
    },
  };

  it("validates correct client configuration", () => {
    const result = ClientInstallerEngine.validateClientConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid client configuration inputs", () => {
    const invalidConfig: ClientOnboardingConfig = {
      clientDid: "invalid-did",
      gatewayUrl: "ftp://gateway.invalid",
      nexusUrl: "",
      defaultSettlementRail: undefined as unknown as SettlementRail,
      targetTrustTier: undefined as unknown as TrustTier,
    };

    const result = ClientInstallerEngine.validateClientConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("executes system connectivity diagnostics successfully", () => {
    const report = ClientInstallerEngine.testSystemConnectivity(validConfig);
    expect(report.overallHealth).toBe("HEALTHY");
    expect(report.diagnostics).toHaveLength(4);
    expect(report.diagnostics.find((d) => d.target === "gateway")?.connected).toBe(true);
    expect(report.diagnostics.find((d) => d.target === "nexus")?.connected).toBe(true);
  });

  it("audits zero-custody safety rules cleanly", () => {
    const audit = ClientInstallerEngine.auditZeroCustody(validConfig);
    expect(audit.passed).toBe(true);
    expect(audit.localKeyIsolationConfirmed).toBe(true);
    expect(audit.byoDeFiDirectRoutingConfirmed).toBe(true);
  });

  it("detects zero-custody violations when private keys are leaked", () => {
    const unsafeConfig: ClientOnboardingConfig = {
      ...validConfig,
      customSettings: {
        private_key: "0x1234567890abcdef1234567890abcdef",
      },
    };

    const audit = ClientInstallerEngine.auditZeroCustody(unsafeConfig);
    expect(audit.passed).toBe(false);
    expect(audit.reasons[0]).toContain("Zero-custody violation");
  });

  it("executes full client environment provisioning workflow", () => {
    const provisioning = ClientInstallerEngine.provisionClientEnvironment(validConfig);
    expect(provisioning.provisioned).toBe(true);
    expect(provisioning.configSummary.clientDid).toBe("did:conxian:org:client-001");
    expect(provisioning.connectivityReport.overallHealth).toBe("HEALTHY");
    expect(provisioning.zeroCustodyCheck.passed).toBe(true);
    expect(provisioning.onboardingLogs.length).toBeGreaterThan(0);
  });
});
