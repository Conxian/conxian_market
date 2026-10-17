/**
 * Multi-Dimensional Scoring Engine (CON-1437 / CON-1440 / CON-1436).
 *
 * Refactors WPS (Weighted Performance Score) and multi-dimensional valuation impact
 * calculations to consume external x402 transaction volume and real-world ERC-8183
 * escrow state, completely shifting metrics away from the deprecated erp_mock schema.
 */

import { TrustTier } from "./core_types.js";
import type {
  AgentPerformanceMetrics,
  MultiDimensionalScoreResult,
  NetworkValuationEvaluation,
} from "./core_types.js";

export class MultiDimensionalScoringEngine {
  /**
   * Calculates Weighted Performance Score (WPS: 0-100) combining Reputation, x402 Volume,
   * Escrow Reliability, and Trust Tier Multiplier.
   */
  calculateWps(metrics: AgentPerformanceMetrics): MultiDimensionalScoreResult {
    // 1. Reputation Sub-Score (0-100 weight: 35%)
    const reputationSubScore = Math.min(100, Math.max(0, metrics.reputationScore));

    // 2. x402 Volume Sub-Score (0-100 weight: 35%)
    const successRate =
      metrics.x402Volume.successfulPaymentCount + metrics.x402Volume.failedPaymentCount > 0
        ? metrics.x402Volume.successfulPaymentCount /
          (metrics.x402Volume.successfulPaymentCount + metrics.x402Volume.failedPaymentCount)
        : 1.0;
    const volumeBonus = Math.min(30, Math.log10(Number(metrics.x402Volume.totalVolumeSats + 1n)) * 5);
    const x402VolumeSubScore = Math.min(100, successRate * 70 + volumeBonus);

    // 3. Escrow Reliability Sub-Score (0-100 weight: 30%)
    const totalEscrows = metrics.escrowState.activeEscrowCount + metrics.escrowState.completedEscrowCount;
    const completionRate = totalEscrows > 0 ? metrics.escrowState.completedEscrowCount / totalEscrows : 1.0;
    const penaltyDeduction = metrics.escrowState.slaBreachPenaltyCount * 15;
    const escrowReliabilitySubScore = Math.max(0, Math.min(100, completionRate * 100 - penaltyDeduction));

    // 4. Trust Tier Multiplier
    let tierMultiplier = 1.0;
    switch (metrics.trustTier) {
      case TrustTier.Strict:
        tierMultiplier = 1.25;
        break;
      case TrustTier.Managed:
        tierMultiplier = 1.15;
        break;
      case TrustTier.Expedient:
        tierMultiplier = 1.05;
        break;
      case TrustTier.ObserverOnly:
        tierMultiplier = 0.9;
        break;
    }

    const rawWps =
      (reputationSubScore * 0.35 + x402VolumeSubScore * 0.35 + escrowReliabilitySubScore * 0.3) *
      tierMultiplier;
    const weightedPerformanceScore = Number(Math.min(100, Math.max(0, rawWps)).toFixed(2));

    return {
      agentDid: metrics.agentDid,
      weightedPerformanceScore,
      reputationSubScore: Number(reputationSubScore.toFixed(2)),
      x402VolumeSubScore: Number(x402VolumeSubScore.toFixed(2)),
      escrowReliabilitySubScore: Number(escrowReliabilitySubScore.toFixed(2)),
      tierMultiplier,
      evaluatedAtIso: new Date().toISOString(),
    };
  }

  /**
   * Evaluates aggregate network valuation impact across a pool of agents.
   */
  evaluateNetworkValuationImpact(agentMetrics: AgentPerformanceMetrics[]): NetworkValuationEvaluation {
    if (agentMetrics.length === 0) {
      return {
        totalActiveAgents: 0,
        aggregateWps: 0,
        networkValuationImpactScore: 0,
        totalVolumeSats: 0n,
        totalEscrowLockedSats: 0n,
        timestampIso: new Date().toISOString(),
      };
    }

    let sumWps = 0;
    let totalVolumeSats = 0n;
    let totalEscrowLockedSats = 0n;

    for (const metrics of agentMetrics) {
      const score = this.calculateWps(metrics);
      sumWps += score.weightedPerformanceScore;
      totalVolumeSats += metrics.x402Volume.totalVolumeSats;
      totalEscrowLockedSats += metrics.escrowState.totalLockedBountySats;
    }

    const aggregateWps = Number((sumWps / agentMetrics.length).toFixed(2));
    const volumeFactor = Math.min(50, Math.log10(Number(totalVolumeSats + 1n)) * 8);
    const networkValuationImpactScore = Number(Math.min(100, aggregateWps * 0.6 + volumeFactor).toFixed(2));

    return {
      totalActiveAgents: agentMetrics.length,
      aggregateWps,
      networkValuationImpactScore,
      totalVolumeSats,
      totalEscrowLockedSats,
      timestampIso: new Date().toISOString(),
    };
  }
}
