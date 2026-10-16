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

  it("does not derive service health from configuration", () => {
    const report = ClientInstallerEngine.testSystemConnectivity(validConfig);
    expect(report.overallHealth).toBe("UNVERIFIED");
    expect(report.diagnostics).toHaveLength(4);
    expect(report.diagnostics.find((d) => d.target === "gateway")?.connected).toBe(false);
    expect(report.diagnostics.find((d) => d.target === "nexus")?.connected).toBe(false);
  });

  it("leaves custody unverified without provider evidence", () => {
    const audit = ClientInstallerEngine.auditZeroCustody(validConfig);
    expect(audit.passed).toBe(false);
    expect(audit.localKeyIsolationConfirmed).toBe(false);
    expect(audit.byoDeFiDirectRoutingConfirmed).toBe(false);
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

  it("does not provision an environment from configuration alone", () => {
    const provisioning = ClientInstallerEngine.provisionClientEnvironment(validConfig);
    expect(provisioning.provisioned).toBe(false);
    expect(provisioning.configSummary.clientDid).toBe("did:conxian:org:client-001");
    expect(provisioning.connectivityReport.overallHealth).toBe("UNVERIFIED");
    expect(provisioning.zeroCustodyCheck.passed).toBe(false);
    expect(provisioning.onboardingLogs.length).toBeGreaterThan(0);
  });

  it("does not grant a paid license from the requested tier", () => {
    const entitlement = ClientInstallerEngine.verifyClientEntitlements(validConfig);
    expect(entitlement.clientDid).toBe("did:conxian:org:client-001");
    expect(entitlement.tier).toBe(TrustTier.ObserverOnly);
    expect(entitlement.maxActiveJobCards).toBe(0);
    expect(entitlement.agentExecutionEnabled).toBe(false);
  });

  it("aligns client configuration into an unsigned deployment plan", () => {
    const manifest = ClientInstallerEngine.alignClientDeployment(validConfig);
    expect(manifest.clientDid).toBe("did:conxian:org:client-001");
    expect(manifest.checksum).toContain("sha256_");
    expect(manifest.hasByoLlmKeys).toBe(true);
  });

  it("does not infer connected assets from settings", () => {
    const probe = ClientInstallerEngine.probeAssetConnectivity(validConfig);
    expect(probe.allAssetsOperational).toBe(false);
    expect(probe.gatewayConnected).toBe(false);
    expect(probe.nexusConnected).toBe(false);
    expect(probe.walletConnected).toBe(false);
    expect(probe.edgeAgentConnected).toBe(false);
  });

  it("verifies domain routing firewall and catches domain misconfiguration", () => {
    const validRouting = ClientInstallerEngine.verifyDomainRoutingFirewall(validConfig);
    expect(validRouting.valid).toBe(true);
    expect(validRouting.firewallEnforced).toBe(true);

    const invalidRoutingConfig: ClientOnboardingConfig = {
      ...validConfig,
      gatewayUrl: "https://gateway.conxian-labs.com",
    };
    const invalidCheck = ClientInstallerEngine.verifyDomainRoutingFirewall(invalidRoutingConfig);
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.violations[0]).toContain("Gateway endpoint violation");
  });

  it("allows the Managed SaaS Gateway facade (api.conxian-labs.com) as a protocol-managed surface", () => {
    const managedConfig: ClientOnboardingConfig = {
      ...validConfig,
      gatewayUrl: "https://api.conxian-labs.com/v1/agent",
    };
    const managedCheck = ClientInstallerEngine.verifyDomainRoutingFirewall(managedConfig);
    expect(managedCheck.valid).toBe(true);
    expect(managedCheck.firewallEnforced).toBe(true);
    expect(managedCheck.violations).toHaveLength(0);

    const validation = ClientInstallerEngine.validateClientConfig(managedConfig);
    expect(validation.valid).toBe(true);

    const cliResult = ClientInstallerEngine.runUnifiedInstallerCli(managedConfig);
    expect(cliResult.success).toBe(true);
  });

  it("executes unified CLI installer end-to-end pipeline successfully", () => {
    const cliResult = ClientInstallerEngine.runUnifiedInstallerCli(validConfig);
    expect(cliResult.success).toBe(false);
    expect(cliResult.entitlement.clientDid).toBe("did:conxian:org:client-001");
    expect(cliResult.manifest?.checksum).toBeDefined();
    expect(cliResult.connectivity.allAssetsOperational).toBe(false);
    expect(cliResult.zeroCustody.passed).toBe(false);
    expect(cliResult.provisioning.provisioned).toBe(false);
  });
});
