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

    expect(summary.totalCapabilities).toBe(32);
    expect(summary.coreCapabilities).toBe(12);
    expect(summary.trustTierMiddlewareEnabled).toBe(true);
    expect(summary.bosYieldSplitterEnabled).toBe(true);
    expect(summary.marketAgnosticRouterEnabled).toBe(true);
    expect(summary.jobCardEscrowEngineEnabled).toBe(true);
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
    expect(pipelineResult.fee.feeSat).toBe(8_750n); // 175 bps for Lightning
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

    expect(summary.totalCapabilities).toBe(32);
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
    expect(release.yieldSplit.builderSat).toBe(1_574_400n); // 80% of net payout (1,968,000 Sat)
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
