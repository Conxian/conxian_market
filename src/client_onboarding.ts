/**
 * Conxian Client Onboarding, System Installation & Connectivity Orchestrator Engine
 *
 * Builds local installation plans and checks configuration syntax. Runtime health,
 * paid entitlement, custody and provisioning require external verified evidence.
 * Configuration alone never grants execution authority or establishes service health.
 */

import { createHash } from "node:crypto";

import {
  ClientOnboardingConfig,
  ClientProvisioningResult,
  SystemConnectivityReport,
  ZeroCustodySanityCheck,
  ConnectivityDiagnosticItem,
  TrustTier,
  SettlementRail,
  ClientEntitlementLicense,
  ClientDeploymentManifest,
  AssetConnectivityProbeResult,
  UnifiedCliInstallerRunResult,
  DomainRoutingCheckResult,
  SlaExemptionReason,
  SlaPolicyEvaluationResult,
} from "./core_types.js";

export class ClientInstallerEngine {
  /**
   * Helper to check if a URL belongs to the corporate surface (conxian-labs.com).
   * Parses the URL safely to prevent incomplete URL substring sanitization vulnerabilities.
   */
  private static isCorporateUrl(urlStr?: string): boolean {
    if (!urlStr) return false;
    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname.toLowerCase();
      return host === "conxian-labs.com" || host.endsWith(".conxian-labs.com");
    } catch {
      return false;
    }
  }

  /**
   * The Managed SaaS Gateway facade (`api.conxian-labs.com`) is the corporate
   * managed-subscriber endpoint for the paid tier. It is a distinct,
   * protocol-managed surface — not the corporate marketing surface — so the
   * domain routing firewall must allow it while continuing to reject the
   * marketing/documentation surfaces (`conxian-labs.com`, `www.conxian-labs.com`,
   * `gateway.conxian-labs.com`).
   */
  private static isManagedApiUrl(urlStr?: string): boolean {
    if (!urlStr) return false;
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.toLowerCase() === "api.conxian-labs.com";
    } catch {
      return false;
    }
  }

  /**
   * Verify domain routing firewall between Protocol surface (conxian.org)
   * and Corporate surface (conxian-labs.com).
   */
  static verifyDomainRoutingFirewall(
    config: ClientOnboardingConfig,
    timestampIso = new Date().toISOString()
  ): DomainRoutingCheckResult {
    const violations: string[] = [];

    if (this.isCorporateUrl(config.gatewayUrl) && !this.isManagedApiUrl(config.gatewayUrl)) {
      violations.push(
        "Gateway endpoint violation: gateway must route to conxian.org surface (gateway.conxian.org), not corporate conxian-labs.com"
      );
    }
    if (this.isCorporateUrl(config.nexusUrl)) {
      violations.push(
        "Nexus Glass Node endpoint violation: nexus must route to conxian.org surface (nexus.conxian.org), not corporate conxian-labs.com"
      );
    }

    const protocolEndpointsVerified =
      (!this.isCorporateUrl(config.gatewayUrl) || this.isManagedApiUrl(config.gatewayUrl)) &&
      !this.isCorporateUrl(config.nexusUrl);
    const corporateEndpointsVerified = true;
    const firewallEnforced = violations.length === 0;

    return {
      valid: firewallEnforced,
      violations,
      protocolEndpointsVerified,
      corporateEndpointsVerified,
      firewallEnforced,
      timestampIso,
    };
  }

  /**
   * Validate raw client onboarding configuration inputs.
   */
  static validateClientConfig(config: ClientOnboardingConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.clientDid || typeof config.clientDid !== "string" || !config.clientDid.startsWith("did:")) {
      errors.push("Invalid or missing clientDid: must be a valid DID starting with 'did:'");
    }

    for (const [name, value] of [["gatewayUrl", config.gatewayUrl], ["nexusUrl", config.nexusUrl]]) {
      try {
        const endpoint = new URL(value);
        if (!["http:", "https:"].includes(endpoint.protocol) || !endpoint.hostname || endpoint.username || endpoint.password || endpoint.hash) {
          errors.push(`Invalid ${name}: expected an HTTP(S) URL without embedded credentials or fragments`);
        }
      } catch {
        errors.push(`Missing or invalid ${name}`);
      }
    }
    if (!Object.values(SettlementRail).includes(config.defaultSettlementRail)) {
      errors.push("Invalid or missing defaultSettlementRail");
    }
    if (!Object.values(TrustTier).includes(config.targetTrustTier)) {
      errors.push("Invalid or missing targetTrustTier");
    }

    // Domain routing firewall check
    const firewallCheck = this.verifyDomainRoutingFirewall(config);
    if (!firewallCheck.valid) {
      errors.push(...firewallCheck.violations);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Verify purchased client license entitlements and execution privileges.
   */
  static verifyClientEntitlements(
    config: ClientOnboardingConfig,
    licenseOverride?: Partial<ClientEntitlementLicense>
  ): ClientEntitlementLicense {
    // A configuration or caller override is not a verified purchase receipt.
    // No entitlement issuer/verifier is configured in this local planner.
    void licenseOverride;
    return {
      licenseId: "",
      clientDid: config.clientDid || "did:conxian:anonymous",
      tier: TrustTier.ObserverOnly,
      allowedRails: [],
      maxActiveJobCards: 0,
      agentExecutionEnabled: false,
      verificationStatus: "UNVERIFIED",
    };
  }

  /**
   * Align client settings into an unsigned deployment plan with a SHA-256 checksum.
   */
  static alignClientDeployment(
    config: ClientOnboardingConfig,
    timestampIso = new Date().toISOString()
  ): ClientDeploymentManifest {
    const hasKeys = !!(
      config.byoLlmKeys?.deepseekApiKey ||
      config.byoLlmKeys?.openaiApiKey ||
      config.byoLlmKeys?.anthropicApiKey
    );

    // Versioned canonical array avoids delimiter ambiguity. This is an
    // integrity checksum of a local plan, not a signature or deployment proof.
    const manifestData = JSON.stringify([
      "CONXIAN-CLIENT-DEPLOYMENT/v1", config.clientDid, config.gatewayUrl,
      config.nexusUrl, config.defaultSettlementRail, config.targetTrustTier,
      hasKeys, timestampIso,
    ]);
    const checksum = `sha256_${createHash("sha256").update(manifestData).digest("hex")}`;

    return {
      manifestId: `man_${Date.now().toString(36)}`,
      clientDid: config.clientDid,
      gatewayUrl: config.gatewayUrl,
      nexusUrl: config.nexusUrl,
      defaultRail: config.defaultSettlementRail,
      targetTrustTier: config.targetTrustTier,
      hasByoLlmKeys: hasKeys,
      checksum,
      generatedAtIso: timestampIso,
    };
  }

  /**
   * Probe end-to-end asset connectivity across client wallets, edge agents, Gateway, and Nexus Glass Node.
   */
  static probeAssetConnectivity(
    config: ClientOnboardingConfig,
    timestampIso = new Date().toISOString()
  ): AssetConnectivityProbeResult {
    return {
      probeId: `prb_${Date.now().toString(36)}`,
      walletConnected: false,
      edgeAgentConnected: false,
      gatewayConnected: false,
      nexusConnected: false,
      probedAtIso: timestampIso,
      allAssetsOperational: false,
      details: [
        "UNVERIFIED: no authenticated Gateway or Nexus runtime probe has run",
        "UNVERIFIED: settlement rail configuration does not connect a wallet",
        "UNVERIFIED: trust tier or BYO credentials do not prove an edge runtime",
      ],
    };
  }

  /**
   * Run end-to-end connectivity diagnostics against Gateway, Nexus, and LLM Provider endpoints.
   */
  static testSystemConnectivity(
    config: ClientOnboardingConfig,
    timestampIso = new Date().toISOString()
  ): SystemConnectivityReport {
    const diagnostics: ConnectivityDiagnosticItem[] = [
      { target: "gateway", endpoint: config.gatewayUrl || "" },
      { target: "nexus", endpoint: config.nexusUrl || "" },
      { target: "llm_provider", endpoint: "BYO provider (not probed)" },
      { target: "settlement_rail", endpoint: `Rail Adapter: ${config.defaultSettlementRail}` },
    ].map((item) => ({
      ...item,
      connected: false,
      latencyMs: null,
      statusMessage: "UNVERIFIED: configuration only; no runtime measurement available",
    })) as ConnectivityDiagnosticItem[];
    return { overallHealth: "UNVERIFIED", timestampIso, diagnostics };
  }

  /**
   * Perform Zero-Custody Sanity Audit on client environment configuration.
   */
  static auditZeroCustody(config: ClientOnboardingConfig): ZeroCustodySanityCheck {
    const reasons = [
      "UNVERIFIED: local configuration cannot establish key isolation, hardware custody or direct routing",
    ];
    try {
      const settings = JSON.stringify(config.customSettings || {});
      if (/private[_-]?key|mnemonic|seed[_-]?phrase/i.test(settings)) {
        reasons.unshift("Zero-custody violation: sensitive key fields found in customSettings");
      }
    } catch {
      reasons.unshift("Zero-custody check unavailable: customSettings are not serializable");
    }
    return {
      passed: false,
      reasons,
      localKeyIsolationConfirmed: false,
      byoDeFiDirectRoutingConfirmed: false,
    };
  }

  /**
   * Execute full system installation, connectivity testing, zero-custody audit, and client provisioning workflow.
   */
  static provisionClientEnvironment(
    config: ClientOnboardingConfig,
    timestampIso = new Date().toISOString()
  ): ClientProvisioningResult {
    const logs: string[] = [];
    logs.push(`[${timestampIso}] Initializing Conxian client onboarding for DID: ${config.clientDid}`);

    // Step 1: Validate Configuration
    const validation = this.validateClientConfig(config);
    if (!validation.valid) {
      logs.push(`[${timestampIso}] ERROR: Configuration validation failed: ${validation.errors.join("; ")}`);
      return {
        provisioned: false,
        timestampIso,
        configSummary: {
          clientDid: config.clientDid || "unknown",
          gatewayUrl: config.gatewayUrl || "",
          nexusUrl: config.nexusUrl || "",
          settlementRail: config.defaultSettlementRail,
          trustTier: config.targetTrustTier,
          hasByoLlmKeys: false,
        },
        connectivityReport: {
          overallHealth: "UNREACHABLE",
          timestampIso,
          diagnostics: [],
        },
        zeroCustodyCheck: {
          passed: false,
          reasons: validation.errors,
          localKeyIsolationConfirmed: false,
          byoDeFiDirectRoutingConfirmed: false,
        },
        onboardingLogs: logs,
      };
    }
    logs.push(`[${timestampIso}] SUCCESS: Client configuration syntax validated.`);

    // Step 2: System Connectivity Testing
    const connectivityReport = this.testSystemConnectivity(config, timestampIso);
    logs.push(`[${timestampIso}] Connectivity diagnostics completed with overall health: ${connectivityReport.overallHealth}`);

    // Step 3: Zero Custody Audit
    const zeroCustodyCheck = this.auditZeroCustody(config);
    if (!zeroCustodyCheck.passed) {
      logs.push(`[${timestampIso}] ERROR: Zero-custody audit failed! ${zeroCustodyCheck.reasons.join("; ")}`);
      return {
        provisioned: false,
        timestampIso,
        configSummary: {
          clientDid: config.clientDid,
          gatewayUrl: config.gatewayUrl,
          nexusUrl: config.nexusUrl,
          settlementRail: config.defaultSettlementRail,
          trustTier: config.targetTrustTier,
          hasByoLlmKeys: !!(config.byoLlmKeys?.deepseekApiKey || config.byoLlmKeys?.openaiApiKey),
        },
        connectivityReport,
        zeroCustodyCheck,
        onboardingLogs: logs,
      };
    }
    logs.push(`[${timestampIso}] SUCCESS: Zero-custody security audit passed.`);

    // Step 4: Complete Provisioning
    const provisioned = connectivityReport.overallHealth === "HEALTHY";
    if (provisioned) {
      logs.push(`[${timestampIso}] SUCCESS: Conxian Market SDK client environment successfully provisioned for ${config.clientDid}.`);
    } else {
      logs.push(`[${timestampIso}] WARNING: Provisioning completed with UNREACHABLE network status.`);
    }

    return {
      provisioned,
      timestampIso,
      configSummary: {
        clientDid: config.clientDid,
        gatewayUrl: config.gatewayUrl,
        nexusUrl: config.nexusUrl,
        settlementRail: config.defaultSettlementRail,
        trustTier: config.targetTrustTier,
        hasByoLlmKeys: !!(
          config.byoLlmKeys?.deepseekApiKey ||
          config.byoLlmKeys?.openaiApiKey ||
          config.byoLlmKeys?.anthropicApiKey
        ),
      },
      connectivityReport,
      zeroCustodyCheck,
      onboardingLogs: logs,
    };
  }

  /**
   * Execute complete Unified CLI Installer pipeline combining purchase entitlement verification,
   * deployment alignment, multi-asset probing, zero-custody audit, and environment provisioning.
   */
  static runUnifiedInstallerCli(
    config: ClientOnboardingConfig,
    timestampIso = new Date().toISOString()
  ): UnifiedCliInstallerRunResult {
    const runId = `cli_run_${Date.now().toString(36)}`;
    const entitlement = this.verifyClientEntitlements(config);
    const validation = this.validateClientConfig(config);

    if (!validation.valid) {
      return {
        success: false,
        runId,
        clientDid: config.clientDid || "did:conxian:unknown",
        entitlement,
        connectivity: {
          probeId: `prb_${Date.now().toString(36)}`,
          walletConnected: false,
          edgeAgentConnected: false,
          gatewayConnected: false,
          nexusConnected: false,
          probedAtIso: timestampIso,
          allAssetsOperational: false,
          details: validation.errors,
        },
        zeroCustody: {
          passed: false,
          reasons: validation.errors,
          localKeyIsolationConfirmed: false,
          byoDeFiDirectRoutingConfirmed: false,
        },
        provisioning: {
          provisioned: false,
          timestampIso,
          configSummary: {
            clientDid: config.clientDid || "unknown",
            gatewayUrl: config.gatewayUrl || "",
            nexusUrl: config.nexusUrl || "",
            settlementRail: config.defaultSettlementRail || SettlementRail.EvmErc8183,
            trustTier: config.targetTrustTier || TrustTier.Managed,
            hasByoLlmKeys: false,
          },
          connectivityReport: { overallHealth: "UNREACHABLE", timestampIso, diagnostics: [] },
          zeroCustodyCheck: { passed: false, reasons: validation.errors, localKeyIsolationConfirmed: false, byoDeFiDirectRoutingConfirmed: false },
          onboardingLogs: validation.errors,
        },
        timestampIso,
      };
    }

    const manifest = this.alignClientDeployment(config, timestampIso);
    const connectivity = this.probeAssetConnectivity(config, timestampIso);
    const zeroCustody = this.auditZeroCustody(config);
    const provisioning = this.provisionClientEnvironment(config, timestampIso);

    const success = entitlement.agentExecutionEnabled && provisioning.provisioned &&
      zeroCustody.passed && connectivity.allAssetsOperational;

    return {
      success,
      runId,
      clientDid: config.clientDid,
      entitlement,
      manifest,
      connectivity,
      zeroCustody,
      provisioning,
      timestampIso,
    };
  }

  /**
   * Run B2B Enterprise Client Onboarding SLA diagnostics across Gateway, Nexus,
   * LLM Provider, and Settlement Rail endpoints against configurable latency thresholds.
   */
  static runEnterpriseSlaDiagnostics(
    config: ClientOnboardingConfig,
    latencyThresholdMs = 50,
    timestampIso = new Date().toISOString()
  ): import("./core_types.js").EnterpriseSlaDiagnosticsReport {
    const connectivity = this.testSystemConnectivity(config, timestampIso);
    return {
      clientDid: config.clientDid || "did:conxian:unknown",
      overallSlaStatus: "UNVERIFIED",
      latencyThresholdMs,
      diagnostics: connectivity.diagnostics.map((item) => ({
        target: item.target,
        endpointUrl: item.endpoint,
        expectedMaxLatencyMs: latencyThresholdMs,
        measuredLatencyMs: null,
        slaCompliant: false,
        status: "UNVERIFIED",
        detail: "No measured runtime latency; SLA compliance cannot be inferred",
      })),
      allEndpointsSlaCompliant: false,
      timestampIso,
    };
  }

  /**
   * Session 69: Evaluates SLA Policy and Statutory Exemptions for B2B Client Onboarding.
   * Enforces Open-Source No-SLA disclaimers for public/unpaid tiers, and bounds B2B SLAs
   * strictly to signed commercial contracts with support windows and force majeure exemptions.
   */
  static evaluateSlaPolicyAndExemptions(
    config: ClientOnboardingConfig,
    isCommercialB2bContract: boolean = false,
    activeExemptions: SlaExemptionReason[] = []
  ): SlaPolicyEvaluationResult {
    const timestampIso = new Date().toISOString();
    const clientDid = config.clientDid || "did:conxian:unknown";

    if (!isCommercialB2bContract) {
      return {
        clientDid,
        isSlaCovered: false,
        slaTier: "NO_SLA_OPEN_SOURCE",
        openSourceDisclaimerActive: true,
        ackWindowHours: 0,
        patchWindowDays: 0,
        exemptionsActive: activeExemptions,
        policySummary: "Public/Open-Source tier: Provided strictly on a community-best-effort basis without legally binding SLA guarantees or financial uptime liabilities.",
        timestampIso,
      };
    }

    const isEnterprisePremium = config.targetTrustTier === TrustTier.Strict || config.targetTrustTier === TrustTier.Managed;
    const slaTier = isEnterprisePremium ? "ENTERPRISE_PREMIUM" : "BUSINESS_HOURS_NBD";
    const ackWindowHours = isEnterprisePremium ? 2 : 24;
    const patchWindowDays = isEnterprisePremium ? 3 : 14;

    let summary = `B2B ${slaTier} SLA active for ${clientDid}. Target Acknowledgement Window: ${ackWindowHours}h, Patch Window: ${patchWindowDays}d.`;
    if (activeExemptions.length > 0) {
      summary += ` Statutory exemptions active: [${activeExemptions.join(", ")}]. Underlying L1/TEE network outages excluded from liability.`;
    }

    return {
      clientDid,
      isSlaCovered: true,
      slaTier,
      openSourceDisclaimerActive: false,
      ackWindowHours,
      patchWindowDays,
      exemptionsActive: activeExemptions,
      policySummary: summary,
      timestampIso,
    };
  }

}
