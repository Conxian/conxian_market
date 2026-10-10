import { describe, expect, it } from "vitest";
import { TrustTier, SettlementRail } from "../src/core_types";
import { ConxianMarketSDK } from "../src/sdk_bridge";
import type { GapCard, BuilderReputationRecord } from "../src/sla_engine";

describe("ConxianMarketSDK Bridge - Capability Summary & TrustTier Middleware", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("connects and exposes SDK capabilities", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    expect(sdk.gateway).toBeDefined();
    expect(sdk.verifier).toBeDefined();
    expect(sdk.settlement).toBeDefined();
    expect(sdk.slaEngine).toBeDefined();
    expect(sdk.monitoringWatcher).toBeDefined();
    expect(sdk.trustTierMiddleware).toBeDefined();
    expect(sdk.bosYieldSplitter).toBeDefined();
    expect(sdk.marketAgnosticRouter).toBeDefined();
    expect(sdk.jobCardEscrowEngine).toBeDefined();
  });

  it("includes all modules in capability summary", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const summary = sdk.getCapabilitySummary();

    expect(summary.totalCapabilities).toBe(35);
    expect(summary.coreCapabilities).toBe(15);
    expect(summary.trustTierMiddlewareEnabled).toBe(true);
    expect(summary.bosYieldSplitterEnabled).toBe(true);
    expect(summary.marketAgnosticRouterEnabled).toBe(true);
    expect(summary.jobCardEscrowEngineEnabled).toBe(true);
    expect(summary.treasuryGovernanceEnabled).toBe(true);
    expect(summary.agentRegistryEnabled).toBe(true);
    expect(summary.mcp402FacadeEnabled).toBe(true);
  });

  it("executes trust tier pipeline directly via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const pipelineResult = sdk.runTrustTierPipeline({
      headers: {
        "x-conxian-light-proof": "spv_proof_data",
      },
      amountSat: 500_000n,
    });

    expect(pipelineResult.effectiveTier).toBe(TrustTier.Expedient);
    expect(pipelineResult.fee.feeSat).toBe(2_500n); // 50 bps for Lightning
    expect(pipelineResult.selectedRail).toBe(SettlementRail.Lightning);
    expect(pipelineResult.wireHeaders["x-conxian-tier"]).toBe("EXPEDIENT");
  });

  it("exposes BOS yield splitting, fee decay, vesting, and inference verification directly", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const split = sdk.calculateYieldSplit(100_000n);
    expect(split.builderSat).toBe(80_000n);

    const feeDist = sdk.distributeProtocolFee(1_000_000n, 18); // 18m = Growth Phase (150 bps)
    expect(feeDist.feeSat).toBe(15_000n);

    const policy = sdk.verifyInferencePolicy({
      isCentralizedInference: false,
      handlesPrivateKeys: false,
      usesMcpHandoff: true,
      usesEnclaveSdk: false,
    });
    expect(policy.compliant).toBe(true);
  });
});

describe("ConxianMarketSDK Bridge - Market-Agnostic Router & Job Card Escrow Integration", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("includes marketAgnosticRouter and jobCardEscrowEngine in capability summary", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const summary = sdk.getCapabilitySummary();

    expect(summary.totalCapabilities).toBe(35);
    expect(summary.marketAgnosticRouterEnabled).toBe(true);
    expect(summary.jobCardEscrowEngineEnabled).toBe(true);
  });

  it("exposes zero-custody validation, BYO DeFi adapter resolution, and deprecation advisory directly", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const validation = sdk.validateZeroCustody({
      id: "settle-100",
      sourceWalletAddress: "0xalice",
      destinationWalletAddress: "0xbob",
      amountSat: 50_000n,
      rail: SettlementRail.EvmErc8183,
      isClientKeyIsolated: true,
      storesClientDataOnHub: false,
    });
    expect(validation.isZeroCustodyCompliant).toBe(true);

    const adapter = sdk.resolveDefiAdapter(SettlementRail.Sbtc);
    expect(adapter.protocolName).toContain("ALEX");

    const advisory = sdk.getDeprecationAdvisory();
    expect(advisory.targetRepo).toBe("Conxian/Conxian");
    expect(advisory.status).toBe("DEPRECATED_RECOMMENDED_ARCHIVE");

    const notice = sdk.emitDeprecationNotice("Conxian/Conxian:legacy-vault", true);
    expect(notice.targetContract).toBe("Conxian/Conxian:legacy-vault");

    const directCallRes = sdk.routeDirectContractCall({
      targetContractAddress: "0xLegacyContract",
      rail: SettlementRail.EvmErc8183,
      fromAgentDid: "did:agent:alice",
      toAgentDid: "did:agent:bob",
      amountSat: 10_000n,
      suppressConsole: true,
    });
    expect(directCallRes.isDirectCallIntercepted).toBe(true);
    expect(directCallRes.assignedAdapter.protocolName).toContain("Uniswap");
  });

  it("exposes Job Card Escrow lifecycle methods via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const created = sdk.createJobCardEscrow({
      jobId: "bridge-job-1",
      clientDid: "did:client:bridge",
      agentProviderDid: "did:agent:bridge",
      budgetSat: 2_000_000n,
      deadlineTimestamp: Date.now() + 86400000,
      tier: TrustTier.Managed,
      rail: SettlementRail.EvmErc8183,
    });
    expect(created.jobId).toBe("bridge-job-1");

    sdk.submitJobCardOutput({
      jobId: "bridge-job-1",
      outputHash: "0xbridgeoutputhash",
      completedAtTimestamp: Date.now(),
    });

    const release = sdk.evaluateAndReleaseJobCardEscrow("bridge-job-1", new Date().toISOString());
    expect(release.grossBudgetSat).toBe(2_000_000n);
    expect(release.yieldSplit.builderSat).toBe(1_592_000n); // 80% of net payout (1,990,000 Sat)
  });

  it("exposes gap card auto-resolution and reputation recovery via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const gapCard: GapCard = {
      id: "GC-BRIDGE-101",
      context: "sla_remediation",
      type: "gap_card",
      parentJobId: "JC-BRIDGE-101",
      description: "Fix SLA breach",
      deadlineIso: "2026-08-05T12:00:00Z",
      budgetSats: 100_000n,
      urgency: "critical",
      labels: ["gap"],
      trustTier: TrustTier.Managed,
      state: "auto_published",
      createdAtIso: "2026-08-05T10:00:00Z",
    };

    const initialReputation: BuilderReputationRecord = {
      builderId: "did:conxian:agent-hero",
      score: 75,
      slaBreachCount: 1,
      abandonmentCount: 0,
      gapCardsResolved: 0,
      qualityDisputeCount: 0,
      consecutiveCompletions: 2,
      eligibleTier: TrustTier.Managed,
      status: "active",
    };

    const resolution = sdk.autoResolveGapCard({
      gapCard,
      resolvingBuilderId: "did:conxian:agent-hero",
      proofHash: "0xproof123",
      currentReputation: initialReputation,
      currentTimeIso: "2026-08-05T11:00:00Z",
    });

    expect(resolution.status).toBe("resolved");
    expect(resolution.payoutSats).toBe(100_000n);
    expect(resolution.updatedReputation?.score).toBe(80);

    const recovered = sdk.evaluateReputationRecovery(initialReputation, 5);
    expect(recovered.consecutiveCompletions).toBe(7);
  });
});

describe("ConxianMarketSDK Bridge - x402 Attestation Gateway Integration", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("verifies x402 payment receipt with attestation proof artifact via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const demand = sdk.createX402Demand({
      id: "sdk-x402-job-1",
      title: "Agent Verification Task",
      bountySat: 500_000n,
    });

    const receipt = {
      demandId: "sdk-x402-job-1",
      transactionId: "tx-sdk-attestation",
      amountSat: "500000",
      paidAt: Date.now(),
      payerDid: "did:conxian:client:sdk",
    };

    const cert = {
      enclave_attestation: "0xenclave_bytes_sdk",
      timestamp: Date.now(),
    };

    const verification = await sdk.verifyX402PaymentReceiptWithAttestation(
      demand,
      receipt,
      cert,
      "did:conxian:agent:sdk"
    );

    expect(verification.valid).toBe(true);
    expect(verification.verifiedTier).toBe(TrustTier.Managed);
    expect(verification.trustProof.proofHash).toBeDefined();

    const { escrowRecord, trustProof } = await sdk.processX402PaymentAndLockEscrowWithAttestation(
      demand,
      receipt,
      "did:conxian:agent:sdk",
      SettlementRail.EvmErc8183,
      cert
    );

    expect(escrowRecord.jobId).toBe("sdk-x402-job-1");
    expect(trustProof.verifiedTier).toBe(TrustTier.Managed);
  });
});

describe("ConxianMarketSDK Bridge - TrustTier Lifecycle Engine Integration", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("exposes trustTierLifecycleEnabled in capability summary", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const summary = sdk.getCapabilitySummary();

    expect(summary.trustTierLifecycleEnabled).toBe(true);
  });

  it("executes evaluateTierUpgrade and evaluateTierDowngrade via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const upgrade = sdk.evaluateTierUpgrade({
      currentTier: TrustTier.ObserverOnly,
      targetTier: TrustTier.Expedient,
      reputationScore: 50,
    });
    expect(upgrade.status).toBe("APPROVED");
    expect(upgrade.newTier).toBe(TrustTier.Expedient);

    const downgrade = sdk.evaluateTierDowngrade({
      currentTier: TrustTier.Strict,
      consecutiveBreaches: 2,
    });
    expect(downgrade.downgraded).toBe(true);
    expect(downgrade.newTier).toBe(TrustTier.Managed);
  });
});

describe("ConxianMarketSDK Bridge - SLA Penalty Settlement Integration", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("exposes slaPenaltyEngineEnabled in capability summary", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const summary = sdk.getCapabilitySummary();

    expect(summary.slaPenaltyEngineEnabled).toBe(true);
  });

  it("executes settleSLAPenalty and processSLAPenaltyClawback via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const result = sdk.settleSLAPenalty({
      jobId: "JC-SLA-TEST-1",
      builderId: "did:builder:sla",
      clientId: "did:client:sla",
      breachSeverity: "abandonment",
      escrowBalanceSats: 200_000n,
      contractBountySats: 200_000n,
      reason: "Unannounced job abandonment",
    });

    expect(result.penaltyBps).toBe(5000); // 50%
    expect(result.totalPenaltySats).toBe(100_000n);
    expect(result.remainingEscrowBalanceSats).toBe(100_000n);
    expect(result.clawback.clientRemediationBountySats).toBe(50_000n);
    expect(result.clawback.treasuryFeeSats).toBe(50_000n);
    expect(result.gapCardIssued).toBe(true);
    expect(result.reputationDelta).toBe(-25);
  });
});

describe("ConxianMarketSDK Bridge - Treasury Governance Integration", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("exposes validateTimelockAndMultisig and processFounderEscrowPayout via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const timelockResult = sdk.validateTimelockAndMultisig({
      transactionId: "TX-BRIDGE-001",
      proposedByDid: "did:conxian:treasurer",
      amountSat: 150_000_000n,
      targetAddress: "0xaddress",
      purpose: "Ecosystem Liquidity",
      proposedAtTimestampIso: "2026-09-08T00:00:00Z",
      executionTimestampIso: "2026-09-10T00:00:00Z", // 48 hours
      signerSignatures: ["sig1", "sig2", "sig3"],
    });

    expect(timelockResult.authorized).toBe(true);
    expect(timelockResult.validSignerCount).toBe(3);

    const payoutResult = sdk.processFounderEscrowPayout({
      founderId: "did:founder:charlie",
      totalAllocatedSat: 12_000_000n,
      monthsElapsed: 36,
      monthlyBaseCapSat: 150_000n,
      requestedBonusSat: 75_000n,
      daoApprovedBonus: true,
      escrowBalanceSat: 500_000n,
    });

    expect(payoutResult.isVested).toBe(true);
    expect(payoutResult.totalPayoutSat).toBe(225_000n);
  });
});

describe("ConxianMarketSDK Client Onboarding Integration", () => {
  it("exposes ClientInstallerEngine capabilities on ConxianMarketSDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect({
      baseUrl: "https://gateway.conxian.org",
      apiKey: "test-key",
    });

    const config = {
      clientDid: "did:conxian:client-sdk-test",
      gatewayUrl: "https://gateway.conxian.org",
      nexusUrl: "https://nexus.conxian.org",
      defaultSettlementRail: SettlementRail.EvmErc8183,
      targetTrustTier: TrustTier.Strict,
    };

    const validation = sdk.validateClientConfig(config);
    expect(validation.valid).toBe(true);

    const connectivity = sdk.testSystemConnectivity(config);
    expect(connectivity.overallHealth).toBe("HEALTHY");

    const audit = sdk.auditZeroCustody(config);
    expect(audit.passed).toBe(true);

    const provisioning = sdk.provisionClientEnvironment(config);
    expect(provisioning.provisioned).toBe(true);

    const entitlement = sdk.verifyClientEntitlements(config);
    expect(entitlement.clientDid).toBe("did:conxian:client-sdk-test");

    const manifest = sdk.alignClientDeployment(config);
    expect(manifest.checksum).toBeDefined();

    const probe = sdk.probeAssetConnectivity(config);
    expect(probe.gatewayConnected).toBe(true);

    const cliResult = sdk.runUnifiedInstallerCli(config);
    expect(cliResult.success).toBe(true);

    const summary = sdk.getCapabilitySummary();
    expect(summary.clientInstallerEnabled).toBe(true);
  });
});

describe("ConxianMarketSDK Agent Identity & MCP-402 Integration", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("registers agent cards, validates trust tier authorization, and tracks reputation via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const card = {
      agentId: "did:conxian:agent:sdk-70",
      name: "SDK Agent 70",
      providerDid: "did:conxian:provider:70",
      capabilities: [{ name: "inference", version: "1.0" }],
      endpoints: ["https://agent70.conxian.io/mcp"],
      minimumTier: TrustTier.Managed,
      issuedAt: Date.now(),
    };

    const entry = sdk.registerAgent(card);
    expect(entry.cardDigest).toBeDefined();

    expect(sdk.getAgent("did:conxian:agent:sdk-70")?.card.name).toBe("SDK Agent 70");
    expect(sdk.isAgentAuthorized("did:conxian:agent:sdk-70", TrustTier.Managed)).toBe(true);
    expect(sdk.isAgentAuthorized("did:conxian:agent:sdk-70", TrustTier.Strict)).toBe(false);

    sdk.updateAgentReputation({
      agentId: "did:conxian:agent:sdk-70",
      cardDigest: entry.cardDigest,
      tasksCompleted: 25,
      slaComplianceBps: 9980,
      disputesLost: 0,
      updatedAt: Date.now(),
    });

    expect(sdk.getAgent("did:conxian:agent:sdk-70")?.reputation?.tasksCompleted).toBe(25);
  });

  it("creates MCP-402 demands and authorizes tool execution receipts via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const call = {
      tool: "execute_analysis",
      arguments: { dataset: "market_depth" },
      job: {
        id: "mcp-job-70",
        title: "Market Depth Analysis",
        description: "Analyze sBTC orderbook depth",
        bountySat: 5_000n,
        deadline: Date.now() + 3600000,
      },
      payerDid: "did:conxian:payer:sdk70",
    };

    const demand = sdk.createMcp402Demand(call);
    expect(demand.resourceId).toBe("mcp-job-70");
    expect(demand.amount).toBe("5000");

    const validReceipt = {
      demandId: "mcp-job-70",
      transactionId: "tx-mcp-70",
      amountSat: "5000",
      paidAt: Date.now(),
      payerDid: "did:conxian:payer:sdk70",
    };

    const auth = sdk.authorizeMcp402ToolCall(call, validReceipt);
    expect(auth.authorized).toBe(true);
    expect(sdk.mcp402Facade.isSettled("mcp-job-70")).toBe(true);
  });
});

describe("ConxianMarketSDK Bridge - ADR-004 dynamic fee wiring", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("exposes the dynamic fee calculator through the SDK", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    expect(sdk.getRailDefaultFlatFloor(SettlementRail.Lightning)).toBe(10n);
    expect(sdk.getVolumeDecayedBps("TIER_4")).toBe(10);

    const fee = sdk.calculateDynamicFee({
      tier: TrustTier.Expedient,
      rail: SettlementRail.Lightning,
      amountSat: 50n,
      volumeDecayTier: "TIER_1",
    });
    expect(fee.effectiveFeeSat).toBe(10n);

    const projection = sdk.projectDynamicRevenue({
      name: "wire",
      monthlyVolumeUsd: 100_000,
      btcPriceUsd: 100_000,
      averageTxnSat: 1000,
      rail: SettlementRail.Lightning,
      volumeDecayTier: "TIER_1",
      systemLoadFactor: 1.0,
    });
    expect(projection.totalMonthlyFeeUsd).toBe(1_000);

    const loadFactor = sdk.resolveSystemLoadFromMempool({
      sample: { fastestFeeSatVb: 50, halfHourFeeSatVb: 30, hourFeeSatVb: 10, minimumFeeSatVb: 1, percentile: 75 }
    });
    expect(loadFactor).toBe(1.625);

    const report = sdk.generateDynamicFeeReport(
      [
        {
          settlementId: "sdk-set-01",
          tier: TrustTier.Expedient,
          rail: SettlementRail.Lightning,
          amountSat: 50n,
          timestamp: 1000,
          builderId: "builder-1",
        }
      ],
      1000,
      2000
    );
    expect(report.totalSettlements).toBe(1);
    expect(report.floorDominatedSettlements).toBe(1);
    expect(report.totalFeeSat).toBe(10n);
  });
});
