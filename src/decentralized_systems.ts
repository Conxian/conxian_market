/**
 * @file decentralized_systems.ts
 * @description Decentralized Systems Production Readiness, Resilient Issue Fallback Engine, and Commercial Opportunity Evaluator.
 */

import {
  DecentralizedSystemRail,
  DecentralizedSystemReadinessInput,
  DecentralizedSystemReadinessReport,
  IssueFallbackEvaluation,
  BusinessOpportunityInput,
  BusinessOpportunityScorecard,
  SystemReadinessTier,
  TrustTier,
} from "./core_types.js";

/** Default baseline readiness profiles for supported decentralized system rails. */
export const DEFAULT_RAIL_PROFILES: Record<DecentralizedSystemRail, DecentralizedSystemReadinessInput> = {
  BITCOIN_L1: {
    rail: "BITCOIN_L1",
    securityScore: 100,
    throughputTps: 7,
    avgLatencyMs: 600000,
    avgFeeSat: 2500,
    uptimePct: 100,
    verificationIntegrityScore: 100,
  },
  STACKS_SBTC: {
    rail: "STACKS_SBTC",
    securityScore: 90,
    throughputTps: 100,
    avgLatencyMs: 5000,
    avgFeeSat: 500,
    uptimePct: 99.8,
    verificationIntegrityScore: 92,
  },
  EVM_ERC8183: {
    rail: "EVM_ERC8183",
    securityScore: 92,
    throughputTps: 500,
    avgLatencyMs: 2000,
    avgFeeSat: 200,
    uptimePct: 99.9,
    verificationIntegrityScore: 95,
  },
  FEDIMINT_MINT: {
    rail: "FEDIMINT_MINT",
    securityScore: 78,
    throughputTps: 2000,
    avgLatencyMs: 500,
    avgFeeSat: 10,
    uptimePct: 99.5,
    verificationIntegrityScore: 80,
  },
  LIGHTNING_NETWORK: {
    rail: "LIGHTNING_NETWORK",
    securityScore: 88,
    throughputTps: 5000,
    avgLatencyMs: 300,
    avgFeeSat: 5,
    uptimePct: 99.7,
    verificationIntegrityScore: 88,
  },
  TEE_ENCLAVE: {
    rail: "TEE_ENCLAVE",
    securityScore: 85,
    throughputTps: 10000,
    avgLatencyMs: 100,
    avgFeeSat: 0,
    uptimePct: 99.0,
    verificationIntegrityScore: 75,
  },
  BITVM3_PROOF: {
    rail: "BITVM3_PROOF",
    securityScore: 20,
    throughputTps: 10,
    avgLatencyMs: 30000,
    avgFeeSat: 2500,
    uptimePct: 80.0,
    verificationIntegrityScore: 10,
  },
  ZK_LIGHT_CLIENT: {
    rail: "ZK_LIGHT_CLIENT",
    securityScore: 88,
    throughputTps: 50,
    avgLatencyMs: 15000,
    avgFeeSat: 300,
    uptimePct: 99.2,
    verificationIntegrityScore: 88,
  },
};

/**
 * Evaluates the production readiness score (0-100) and readiness tier for a decentralized system rail.
 */
export function evaluateSystemReadiness(
  input: DecentralizedSystemReadinessInput
): DecentralizedSystemReadinessReport {
  // Security sub-score (25% weight)
  const securitySubScore = Math.min(100, Math.max(0, input.securityScore));

  // Latency & Throughput sub-score (20% weight)
  // Latency penalty if >2000ms; bonus for TPS
  let latencySubScore = 100;
  if (input.avgLatencyMs > 2000) {
    const excess = input.avgLatencyMs - 2000;
    latencySubScore = Math.max(10, 100 - (excess / 10000) * 50);
  }

  // Cost sub-score (20% weight)
  // Target fee <= 1000 sat; penalty for higher fees
  let costSubScore = 100;
  if (input.avgFeeSat > 1000) {
    const excessFee = input.avgFeeSat - 1000;
    costSubScore = Math.max(10, 100 - (excessFee / 2000) * 40);
  }

  // Liveness sub-score (20% weight)
  const livenessSubScore = Math.min(100, Math.max(0, input.uptimePct));

  // Verification sub-score (15% weight)
  const verificationSubScore = Math.min(100, Math.max(0, input.verificationIntegrityScore));

  // Calculate weighted score
  let rawScore =
    securitySubScore * 0.25 +
    latencySubScore * 0.2 +
    costSubScore * 0.2 +
    livenessSubScore * 0.2 +
    verificationSubScore * 0.15;

  // Penalty if active issues exist
  const issues = input.activeIssues || [];
  if (issues.length > 0) {
    rawScore = Math.max(0, rawScore - issues.length * 15);
  }

  const overallReadinessScore = Math.round(rawScore * 10) / 10;

  let tier: SystemReadinessTier = "RESEARCH_ONLY";
  if (overallReadinessScore >= 80) {
    tier = "PRODUCTION_READY";
  } else if (overallReadinessScore >= 50) {
    tier = "BETA_SUPPORTED";
  }

  return {
    rail: input.rail,
    overallReadinessScore,
    tier,
    securitySubScore: Math.round(securitySubScore),
    latencySubScore: Math.round(latencySubScore),
    costSubScore: Math.round(costSubScore),
    livenessSubScore: Math.round(livenessSubScore),
    verificationSubScore: Math.round(verificationSubScore),
    evaluatedAtIso: new Date().toISOString(),
    activeIssues: issues,
  };
}

/**
 * Evaluates operational issues on a primary rail and determines the appropriate fallback route and trust tier impact.
 */
export function resolveIssueFallback(
  primaryRail: DecentralizedSystemRail,
  issueDetected: string,
  availableReports?: DecentralizedSystemReadinessReport[]
): IssueFallbackEvaluation {
  const normalizedIssue = issueDetected.toUpperCase();
  const now = new Date().toISOString();

  let recommendedFallbackRail: DecentralizedSystemRail | null = null;
  let trustTierImpact: TrustTier = TrustTier.Strict;
  let routingReason = "";

  if (primaryRail === "BITCOIN_L1") {
    recommendedFallbackRail = "STACKS_SBTC";
    trustTierImpact = TrustTier.Strict;
    routingReason = `Bitcoin L1 issue (${issueDetected}) detected. Routing to Stacks sBTC pool for high-throughput zero-custody settlement.`;
  } else if (primaryRail === "STACKS_SBTC") {
    recommendedFallbackRail = "EVM_ERC8183";
    trustTierImpact = TrustTier.Strict;
    routingReason = `Stacks sBTC issue (${issueDetected}) detected. Routing to EVM ERC-8183 CJCS programmable escrow.`;
  } else if (primaryRail === "EVM_ERC8183") {
    recommendedFallbackRail = "LIGHTNING_NETWORK";
    trustTierImpact = TrustTier.Managed;
    routingReason = `EVM ERC-8183 issue (${issueDetected}) detected. Shifting to Lightning Network M2M micro-payment rail.`;
  } else if (primaryRail === "TEE_ENCLAVE") {
    recommendedFallbackRail = "ZK_LIGHT_CLIENT";
    trustTierImpact = TrustTier.ObserverOnly;
    routingReason = `TEE Enclave issue (${issueDetected}) detected. Fallback to ZK Light Client and downgrading trust tier to ObserverOnly.`;
  } else if (primaryRail === "BITVM3_PROOF") {
    recommendedFallbackRail = "ZK_LIGHT_CLIENT";
    trustTierImpact = TrustTier.ObserverOnly;
    routingReason = `BitVM3 proof unverified (${issueDetected}). Failing closed to ZK Light Client / ObserverOnly verification.`;
  } else {
    recommendedFallbackRail = "LIGHTNING_NETWORK";
    trustTierImpact = TrustTier.Managed;
    routingReason = `General issue (${issueDetected}) on ${primaryRail}. Fallback to Lightning Network default rail.`;
  }

  // Find fallback report if provided
  let fallbackReadinessTier: SystemReadinessTier | null = null;
  if (availableReports && recommendedFallbackRail) {
    const found = availableReports.find((r) => r.rail === recommendedFallbackRail);
    if (found) {
      fallbackReadinessTier = found.tier;
    }
  }

  if (!fallbackReadinessTier && recommendedFallbackRail) {
    const report = evaluateSystemReadiness(DEFAULT_RAIL_PROFILES[recommendedFallbackRail]);
    fallbackReadinessTier = report.tier;
  }

  return {
    primaryRail,
    issueDetected,
    fallbackRequired: true,
    recommendedFallbackRail,
    fallbackReadinessTier,
    trustTierImpact,
    routingReason,
    evaluatedAtIso: now,
  };
}

/**
 * Scores a business opportunity for expanding support to a decentralized system.
 */
export function scoreBusinessOpportunity(
  input: BusinessOpportunityInput
): BusinessOpportunityScorecard {
  const projectedAnnualRevenueUsd = Math.round(
    input.estimatedTamUsd * (input.feeCapturePct / 100)
  );

  // Score components
  // TAM score: max at $50M
  const tamScore = Math.min(100, (input.estimatedTamUsd / 50000000) * 100);
  const feasibility = Math.min(100, Math.max(0, input.technicalFeasibilityScore));
  const slaAlignment = Math.min(100, Math.max(0, input.slaAlignmentScore));

  const overallScore = Math.round(
    tamScore * 0.35 + feasibility * 0.35 + slaAlignment * 0.3
  );

  let feasibilityTier: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (overallScore >= 75) {
    feasibilityTier = "HIGH";
  } else if (overallScore >= 50) {
    feasibilityTier = "MEDIUM";
  }

  return {
    opportunityId: input.opportunityId,
    title: input.title,
    targetRail: input.targetRail,
    overallOpportunityScore: overallScore,
    projectedAnnualRevenueUsd,
    feasibilityTier,
    evaluatedAtIso: new Date().toISOString(),
  };
}
