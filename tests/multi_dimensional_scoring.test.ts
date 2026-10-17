import { describe, expect, it } from "vitest";
import { MultiDimensionalScoringEngine } from "../src/multi_dimensional_scoring.js";
import { TrustTier } from "../src/core_types.js";
import type { AgentPerformanceMetrics } from "../src/core_types.js";

describe("MultiDimensionalScoringEngine", () => {
  const engine = new MultiDimensionalScoringEngine();

  const mockMetrics: AgentPerformanceMetrics = {
    agentDid: "did:conxian:agent123",
    trustTier: TrustTier.Strict,
    reputationScore: 92,
    x402Volume: {
      totalVolumeSats: 50_000_000n,
      usdVolume: 25_000,
      successfulPaymentCount: 150,
      failedPaymentCount: 2,
    },
    escrowState: {
      activeEscrowCount: 3,
      completedEscrowCount: 47,
      totalReleasedBountySats: 45_000_000n,
      totalLockedBountySats: 5_000_000n,
      slaBreachPenaltyCount: 0,
    },
  };

  it("calculates Weighted Performance Score (WPS) within 0-100 bounds", () => {
    const result = engine.calculateWps(mockMetrics);
    expect(result.agentDid).toBe("did:conxian:agent123");
    expect(result.weightedPerformanceScore).toBeGreaterThanOrEqual(0);
    expect(result.weightedPerformanceScore).toBeLessThanOrEqual(100);
    expect(result.tierMultiplier).toBe(1.25); // Strict tier
    expect(result.reputationSubScore).toBe(92);
  });

  it("applies penalty deductions for SLA breaches in escrow reliability", () => {
    const degradedMetrics: AgentPerformanceMetrics = {
      ...mockMetrics,
      trustTier: TrustTier.ObserverOnly,
      escrowState: {
        ...mockMetrics.escrowState,
        slaBreachPenaltyCount: 3, // 3 * 15 = 45 point deduction
      },
    };

    const result = engine.calculateWps(degradedMetrics);
    expect(result.tierMultiplier).toBe(0.9);
    expect(result.escrowReliabilitySubScore).toBeLessThan(60);
  });

  it("evaluates network valuation impact across agent pool", () => {
    const pool = [mockMetrics, { ...mockMetrics, agentDid: "did:conxian:agent456" }];
    const evaluation = engine.evaluateNetworkValuationImpact(pool);

    expect(evaluation.totalActiveAgents).toBe(2);
    expect(evaluation.aggregateWps).toBeGreaterThan(80);
    expect(evaluation.networkValuationImpactScore).toBeGreaterThan(0);
    expect(evaluation.totalVolumeSats).toBe(100_000_000n);
  });

  it("handles empty agent pool safely", () => {
    const evaluation = engine.evaluateNetworkValuationImpact([]);
    expect(evaluation.totalActiveAgents).toBe(0);
    expect(evaluation.aggregateWps).toBe(0);
    expect(evaluation.networkValuationImpactScore).toBe(0);
    expect(evaluation.totalVolumeSats).toBe(0n);
  });
});
