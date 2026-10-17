import { describe, expect, it } from "vitest";
import { MultiDimensionalScoringEngine } from "../src/multi_dimensional_scoring.js";
import { TrustTier } from "../src/core_types.js";

describe("MultiDimensionalScoringEngine", () => {
  const engine = new MultiDimensionalScoringEngine();

  it("calculates accurate WPS score and valuation impact using x402 volume and ERC-8183 escrow state", () => {
    const result = engine.calculateWps({
      agentDid: "did:conxian:agent1",
      trustTier: TrustTier.Strict,
      reputationScore: 92,
      x402Volume: {
        totalVolumeSats: 50_000_000n, // 50M sats ($30,000 USD equiv)
        usdVolume: 30000,
        successfulPaymentCount: 150,
        failedPaymentCount: 2,
        throughputTps: 12.5,
      },
      escrowState: {
        activeEscrowCount: 5,
        completedEscrowCount: 45,
        totalReleasedBountySats: 40_000_000n,
        totalLockedBountySats: 10_000_000n,
        slaBreachPenaltyCount: 0,
        averageEscrowDurationHours: 1.5,
      },
    });

    expect(result.agentDid).toBe("did:conxian:agent1");
    expect(result.isErpMockDeprecated).toBe(true);
    expect(result.dataSourcesUsed).toContain("x402_live_transaction_volume");
    expect(result.dataSourcesUsed).toContain("erc8183_escrow_state");
    expect(result.trustTierMultiplier).toBe(1.5); // Strict tier
    expect(result.weightedPerformanceScore).toBeGreaterThan(80);
    expect(result.estimatedValuationImpactUsd).toBeGreaterThan(50000); // Dynamic valuation
  });

  it("evaluates network valuation impact across a cohort of agents", () => {
    const evaluation = engine.evaluateNetworkValuationImpact([
      {
        agentDid: "did:conxian:agent1",
        trustTier: TrustTier.Strict,
        reputationScore: 95,
        x402Volume: {
          totalVolumeSats: 100_000_000n,
          usdVolume: 60000,
          successfulPaymentCount: 300,
          failedPaymentCount: 1,
        },
        escrowState: {
          activeEscrowCount: 10,
          completedEscrowCount: 90,
          totalReleasedBountySats: 80_000_000n,
          totalLockedBountySats: 20_000_000n,
          slaBreachPenaltyCount: 0,
        },
      },
      {
        agentDid: "did:conxian:agent2",
        trustTier: TrustTier.Managed,
        reputationScore: 85,
        x402Volume: {
          totalVolumeSats: 20_000_000n,
          usdVolume: 12000,
          successfulPaymentCount: 80,
          failedPaymentCount: 4,
        },
        escrowState: {
          activeEscrowCount: 2,
          completedEscrowCount: 25,
          totalReleasedBountySats: 15_000_000n,
          totalLockedBountySats: 5_000_000n,
          slaBreachPenaltyCount: 1,
        },
      },
    ]);

    expect(evaluation.evaluatedAgentCount).toBe(2);
    expect(evaluation.totalX402VolumeSats).toBe(120_000_000n);
    expect(evaluation.totalEscrowValueSats).toBe(120_000_000n);
    expect(evaluation.totalNetworkValuationUsd).toBeGreaterThan(100000);
    expect(evaluation.averageWps).toBeGreaterThan(70);
  });
});
