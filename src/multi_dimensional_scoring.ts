/**
 * Multi-Dimensional Scoring Engine (CON-1437 / CON-1440 / CON-1436).
 *
 * Refactors WPS (Weighted Performance Score) and multi-dimensional valuation impact
 * calculations to consume external x402 transaction volume and real-world ERC-8183
 * escrow state, completely shifting metrics away from the deprecated erp_mock schema.
 */

import { TrustTier } from "./core_types.js";

export interface X402VolumeInput {
  totalVolumeSats: bigint;
  usdVolume: number;
  successfulPaymentCount: number;
  failedPaymentCount: number;
  throughputTps?: number;
  periodStartIso?: string;
  periodEndIso?: string;
}

export interface Erc8183EscrowStateInput {
  activeEscrowCount: number;
  completedEscrowCount: number;
  totalReleasedBountySats: bigint;
  totalLockedBountySats: bigint;
  slaBreachPenaltyCount: number;
  averageEscrowDurationHours?: number;
}

export interface AgentPerformanceMetrics {
  agentDid: string;
  trustTier: TrustTier;
  reputationScore: number;
  x402Volume: X402VolumeInput;
  escrowState: Erc8183EscrowStateInput;
}

export interface MultiDimensionalScoreResult {
  agentDid: string;
  weightedPerformanceScore: number; // WPS (0-100)
  x402VolumeScore: number; // (0-100)
  escrowReliabilityScore: number; // (0-100)
  reputationScore: number; // (0-100)
  trustTierMultiplier: number;
  estimatedValuationImpactUsd: number;
  isErpMockDeprecated: boolean;
  dataSourcesUsed: string[];
  calculatedAtIso: string;
}

export interface NetworkValuationEvaluation {
  totalNetworkValuationUsd: number;
  averageWps: number;
  totalX402VolumeSats: bigint;
  totalEscrowValueSats: bigint;
  evaluatedAgentCount: number;
  calculatedAtIso: string;
}

export class MultiDimensionalScoringEngine {
  /**
   * Calculate Weighted Performance Score (WPS) and estimated valuation impact
   * using real-world x402 transaction volume and ERC-8183 escrow state.
   */
  calculateWps(metrics: AgentPerformanceMetrics): MultiDimensionalScoreResult {
    const calculatedAtIso = new Date().toISOString();

    // 1. Calculate x402 Volume Score (0-100) based on success rate and throughput
    const totalPayments = metrics.x402Volume.successfulPaymentCount + metrics.x402Volume.failedPaymentCount;
    const successRate = totalPayments > 0 ? metrics.x402Volume.successfulPaymentCount / totalPayments : 1.0;

    // Sat volume score log-scaled up to 1,000,000,000 sats ($1M equivalent benchmark)
    const volumeSatNum = Number(metrics.x402Volume.totalVolumeSats);
    const volumeScoreComponent = Math.min(100, (Math.log10(Math.max(1, volumeSatNum)) / 9) * 100);
    const x402VolumeScore = Math.min(100, Math.max(0, volumeScoreComponent * 0.6 + successRate * 40));

    // 2. Calculate ERC-8183 Escrow Reliability Score (0-100)
    const totalEscrows = metrics.escrowState.completedEscrowCount + metrics.escrowState.slaBreachPenaltyCount;
    const completionRate = totalEscrows > 0 ? metrics.escrowState.completedEscrowCount / totalEscrows : 1.0;
    const breachPenaltyPenalty = metrics.escrowState.slaBreachPenaltyCount * 15; // -15 pts per breach
    const escrowReliabilityScore = Math.min(100, Math.max(0, completionRate * 100 - breachPenaltyPenalty));

    // 3. TrustTier Multiplier
    let trustTierMultiplier = 1.0;
    switch (metrics.trustTier) {
      case TrustTier.Strict:
        trustTierMultiplier = 1.5;
        break;
      case TrustTier.Managed:
        trustTierMultiplier = 1.25;
        break;
      case TrustTier.Expedient:
        trustTierMultiplier = 1.0;
        break;
      case TrustTier.ObserverOnly:
        trustTierMultiplier = 0.5;
        break;
    }

    // 4. Calculate Weighted Performance Score (WPS)
    // Formula: (40% x402 Volume + 40% Escrow Reliability + 20% Reputation) * TrustTierMultiplier
    const rawWps = (x402VolumeScore * 0.4 + escrowReliabilityScore * 0.4 + metrics.reputationScore * 0.2);
    const weightedPerformanceScore = Math.min(100, Math.max(0, rawWps * trustTierMultiplier));

    // 5. Valuation Impact (USD) derived directly from live transaction throughput & escrow values
    // Valuation Impact = USD Volume * (WPS / 50) + (Escrow Value in USD * TrustTierMultiplier * 2)
    const releasedEscrowUsd = Number(metrics.escrowState.totalReleasedBountySats) * 0.0006; // ~$0.0006 per sat
    const estimatedValuationImpactUsd =
      metrics.x402Volume.usdVolume * (weightedPerformanceScore / 50) +
      releasedEscrowUsd * trustTierMultiplier * 2.0;

    return {
      agentDid: metrics.agentDid,
      weightedPerformanceScore: Number(weightedPerformanceScore.toFixed(2)),
      x402VolumeScore: Number(x402VolumeScore.toFixed(2)),
      escrowReliabilityScore: Number(escrowReliabilityScore.toFixed(2)),
      reputationScore: metrics.reputationScore,
      trustTierMultiplier,
      estimatedValuationImpactUsd: Number(estimatedValuationImpactUsd.toFixed(2)),
      isErpMockDeprecated: true,
      dataSourcesUsed: [
        "x402_live_transaction_volume",
        "erc8183_escrow_state",
        "builder_reputation_score",
      ],
      calculatedAtIso,
    };
  }

  /**
   * Aggregate multi-dimensional network valuation impact across a cohort of active agents.
   */
  evaluateNetworkValuationImpact(
    agentMetrics: AgentPerformanceMetrics[]
  ): NetworkValuationEvaluation {
    const calculatedAtIso = new Date().toISOString();
    let totalValuationUsd = 0;
    let sumWps = 0;
    let totalX402VolumeSats = 0n;
    let totalEscrowValueSats = 0n;

    for (const agent of agentMetrics) {
      const score = this.calculateWps(agent);
      totalValuationUsd += score.estimatedValuationImpactUsd;
      sumWps += score.weightedPerformanceScore;
      totalX402VolumeSats += agent.x402Volume.totalVolumeSats;
      totalEscrowValueSats += agent.escrowState.totalReleasedBountySats + agent.escrowState.totalLockedBountySats;
    }

    const avgWps = agentMetrics.length > 0 ? sumWps / agentMetrics.length : 0;

    return {
      totalNetworkValuationUsd: Number(totalValuationUsd.toFixed(2)),
      averageWps: Number(avgWps.toFixed(2)),
      totalX402VolumeSats,
      totalEscrowValueSats,
      evaluatedAgentCount: agentMetrics.length,
      calculatedAtIso,
    };
  }
}
