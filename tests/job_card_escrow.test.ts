import { describe, it, expect, beforeEach } from "vitest";
import {
  JobCardEscrowEngine,
  EscrowState,
  TrustTier,
  SettlementRail,
  ConxianMarketSDK,
} from "../src";

describe("JobCardEscrowEngine (Session 54 Candidate #6)", () => {
  let engine: JobCardEscrowEngine;

  beforeEach(() => {
    engine = new JobCardEscrowEngine();
  });

  it("should create a zero-custody Job Card escrow", () => {
    const record = engine.createEscrow({
      jobId: "job-101",
      clientDid: "did:conxian:client:alpha",
      agentProviderDid: "did:conxian:agent:beta",
      budgetSat: 1_000_000n,
      deadlineTimestamp: Date.now() + 86400000,
      tier: TrustTier.Managed,
      rail: SettlementRail.EvmErc8183,
    });

    expect(record.jobId).toBe("job-101");
    expect(record.state).toBe(EscrowState.Open);
    expect(record.budgetSat).toBe(1_000_000n);
    expect(record.evaluatorDid).toBe("did:conxian:evaluator:default");
  });

  it("should reject escrow creation if budget is zero or negative", () => {
    expect(() =>
      engine.createEscrow({
        jobId: "job-invalid",
        clientDid: "did:client:1",
        agentProviderDid: "did:agent:1",
        budgetSat: 0n,
        deadlineTimestamp: Date.now() + 86400000,
        tier: TrustTier.Expedient,
        rail: SettlementRail.Lightning,
      })
    ).toThrow("Budget must be greater than zero satoshis");
  });

  it("should reject duplicate escrow creation for same jobId", () => {
    engine.createEscrow({
      jobId: "job-dup",
      clientDid: "did:client:1",
      agentProviderDid: "did:agent:1",
      budgetSat: 500_000n,
      deadlineTimestamp: Date.now() + 86400000,
      tier: TrustTier.Expedient,
      rail: SettlementRail.Lightning,
    });

    expect(() =>
      engine.createEscrow({
        jobId: "job-dup",
        clientDid: "did:client:1",
        agentProviderDid: "did:agent:1",
        budgetSat: 500_000n,
        deadlineTimestamp: Date.now() + 86400000,
        tier: TrustTier.Expedient,
        rail: SettlementRail.Lightning,
      })
    ).toThrow("Escrow already exists for jobId: job-dup");
  });

  it("should submit job output and transition state to SUBMITTED", () => {
    engine.createEscrow({
      jobId: "job-202",
      clientDid: "did:conxian:client:alpha",
      agentProviderDid: "did:conxian:agent:beta",
      budgetSat: 2_000_000n,
      deadlineTimestamp: Date.now() + 86400000,
      tier: TrustTier.Managed,
      rail: SettlementRail.AlexStacks,
    });

    const updated = engine.submitJobOutput({
      jobId: "job-202",
      outputHash: "0xdeadbeef1234567890abcdef",
      outputPayload: "s3://conxian-results/job-202.json",
      completedAtTimestamp: Date.now(),
    });

    expect(updated.state).toBe(EscrowState.Submitted);
    expect(updated.submission?.outputHash).toBe("0xdeadbeef1234567890abcdef");
  });

  it("should evaluate SLA, calculate fees, apply 80/10/10 yield split, and release funds", () => {
    engine.createEscrow({
      jobId: "job-303",
      clientDid: "did:conxian:client:alpha",
      agentProviderDid: "did:conxian:agent:beta",
      budgetSat: 10_000_000n,
      deadlineTimestamp: Date.now() + 86400000,
      tier: TrustTier.Managed,
      rail: SettlementRail.EvmErc8183,
    });

    engine.submitJobOutput({
      jobId: "job-303",
      outputHash: "0xhash303",
      completedAtTimestamp: Date.now(),
    });

    const release = engine.evaluateAndRelease("job-303", new Date().toISOString());

    expect(release.status).toBe(EscrowState.Released);
    expect(release.grossBudgetSat).toBe(10_000_000n);

    // Managed tier fee (150 bps) + EVM rail offset (+10 bps) = 160 bps = 160,000 Sat
    expect(release.feeSat).toBe(160_000n);
    expect(release.netPayoutSat).toBe(9_840_000n);

    // 80/10/10 yield split on 9,840,000 sat:
    // Builder (80%) = 7,872,000 sat
    // Treasury (10%) = 984,000 sat
    // Ecosystem (10%) = 984,000 sat
    expect(release.yieldSplit.builderSat).toBe(7_872_000n);
    expect(release.yieldSplit.platformTreasurySat).toBe(984_000n);
    expect(release.yieldSplit.ecosystemStakeholdersSat).toBe(984_000n);

    expect(release.m2mRoute.isNonCustodial).toBe(true);
    expect(release.m2mRoute.rail).toBe(SettlementRail.EvmErc8183);

    const record = engine.getEscrowRecord("job-303");
    expect(record?.state).toBe(EscrowState.Released);
  });

  it("should dispute escrow and issue non-custodial refund and bounty", () => {
    engine.createEscrow({
      jobId: "job-404",
      clientDid: "did:conxian:client:alpha",
      agentProviderDid: "did:conxian:agent:beta",
      budgetSat: 5_000_000n,
      deadlineTimestamp: Date.now() - 3600000, // Missed deadline
      tier: TrustTier.Expedient,
      rail: SettlementRail.Lightning,
    });

    const refund = engine.disputeAndRefund("job-404", "SLA Deadline Breach", new Date().toISOString());

    expect(refund.status).toBe(EscrowState.Refunded);
    expect(refund.bountyAmountSat).toBe(500_000n); // 10% penalty = 500k
    expect(refund.refundAmountSat).toBe(4_500_000n);
    expect(refund.reason).toBe("SLA Deadline Breach");

    const record = engine.getEscrowRecord("job-404");
    expect(record?.state).toBe(EscrowState.Refunded);
  });

  it("should integrate seamlessly with ConxianMarketSDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect({ baseUrl: "https://gateway.conxian.io" });

    const created = sdk.createJobCardEscrow({
      jobId: "sdk-job-1",
      clientDid: "did:client:sdk",
      agentProviderDid: "did:agent:sdk",
      budgetSat: 1_000_000n,
      deadlineTimestamp: Date.now() + 3600000,
      tier: TrustTier.Managed,
      rail: SettlementRail.Sbtc,
    });

    expect(created.jobId).toBe("sdk-job-1");

    sdk.submitJobCardOutput({
      jobId: "sdk-job-1",
      outputHash: "0xsdkoutput",
      completedAtTimestamp: Date.now(),
    });

    const release = sdk.evaluateAndReleaseJobCardEscrow("sdk-job-1", new Date().toISOString());
    expect(release.status).toBe(EscrowState.Released);

    const summary = sdk.getCapabilitySummary();
    expect(summary.jobCardEscrowEngineEnabled).toBe(true);
    expect(summary.coreCapabilities).toBe(12);
  });
});
