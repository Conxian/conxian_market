import { describe, it, expect } from "vitest";
import {
  evaluateSystemReadiness,
  resolveIssueFallback,
  scoreBusinessOpportunity,
  DEFAULT_RAIL_PROFILES,
} from "../src/decentralized_systems.js";
import {
  DecentralizedSystemReadinessInput,
  BusinessOpportunityInput,
  TrustTier,
} from "../src/core_types.js";

describe("Decentralized Systems Readiness Engine", () => {
  it("evaluates production readiness for default Bitcoin L1 rail profile", () => {
    const report = evaluateSystemReadiness(DEFAULT_RAIL_PROFILES.BITCOIN_L1);
    expect(report.rail).toBe("BITCOIN_L1");
    expect(report.overallReadinessScore).toBeGreaterThanOrEqual(70);
    expect(report.tier).toBe("BETA_SUPPORTED"); // due to high latency/fee penalty
    expect(report.securitySubScore).toBe(100);
  });

  it("evaluates production readiness for EVM ERC-8183 rail profile as PRODUCTION_READY", () => {
    const report = evaluateSystemReadiness(DEFAULT_RAIL_PROFILES.EVM_ERC8183);
    expect(report.rail).toBe("EVM_ERC8183");
    expect(report.overallReadinessScore).toBeGreaterThanOrEqual(80);
    expect(report.tier).toBe("PRODUCTION_READY");
  });

  it("evaluates research-only tier for BitVM3 unverified proof rail profile", () => {
    const report = evaluateSystemReadiness(DEFAULT_RAIL_PROFILES.BITVM3_PROOF);
    expect(report.rail).toBe("BITVM3_PROOF");
    expect(report.overallReadinessScore).toBeLessThan(50);
    expect(report.tier).toBe("RESEARCH_ONLY");
  });

  it("applies penalty score when active issues are reported", () => {
    const inputWithIssues: DecentralizedSystemReadinessInput = {
      ...DEFAULT_RAIL_PROFILES.EVM_ERC8183,
      activeIssues: ["RPC Rate Limiting", "High Gas Spike"],
    };
    const report = evaluateSystemReadiness(inputWithIssues);
    expect(report.activeIssues).toEqual(["RPC Rate Limiting", "High Gas Spike"]);
    expect(report.overallReadinessScore).toBeLessThan(80);
  });
});

describe("Resilient Issue Fallback Engine", () => {
  it("routes around Bitcoin L1 congestion to Stacks sBTC", () => {
    const evaluation = resolveIssueFallback("BITCOIN_L1", "Fee spike >50 sat/vB");
    expect(evaluation.primaryRail).toBe("BITCOIN_L1");
    expect(evaluation.fallbackRequired).toBe(true);
    expect(evaluation.recommendedFallbackRail).toBe("STACKS_SBTC");
    expect(evaluation.trustTierImpact).toBe(TrustTier.Strict);
    expect(evaluation.routingReason).toContain("Stacks sBTC pool");
  });

  it("routes around Stacks network halt to EVM ERC-8183", () => {
    const evaluation = resolveIssueFallback("STACKS_SBTC", "Network block halt");
    expect(evaluation.primaryRail).toBe("STACKS_SBTC");
    expect(evaluation.recommendedFallbackRail).toBe("EVM_ERC8183");
    expect(evaluation.trustTierImpact).toBe(TrustTier.Strict);
  });

  it("downgrades trust tier to ObserverOnly on TEE enclave hardware deprecation", () => {
    const evaluation = resolveIssueFallback("TEE_ENCLAVE", "AWS Nitro Attestation Root Expired");
    expect(evaluation.primaryRail).toBe("TEE_ENCLAVE");
    expect(evaluation.recommendedFallbackRail).toBe("ZK_LIGHT_CLIENT");
    expect(evaluation.trustTierImpact).toBe(TrustTier.ObserverOnly);
  });

  it("fails closed to ObserverOnly on BitVM3 unverified proof input", () => {
    const evaluation = resolveIssueFallback("BITVM3_PROOF", "Metadata forgery detected");
    expect(evaluation.primaryRail).toBe("BITVM3_PROOF");
    expect(evaluation.recommendedFallbackRail).toBe("ZK_LIGHT_CLIENT");
    expect(evaluation.trustTierImpact).toBe(TrustTier.ObserverOnly);
  });
});

describe("Commercial Business Opportunity Evaluator", () => {
  it("scores high-value cross-chain x402 opportunity", () => {
    const input: BusinessOpportunityInput = {
      opportunityId: "OPP-001",
      title: "Cross-Chain x402 Value Routing Fees",
      targetRail: "STACKS_SBTC",
      estimatedTamUsd: 50000000, // $50M
      feeCapturePct: 2.0, // 2%
      technicalFeasibilityScore: 90,
      slaAlignmentScore: 95,
    };
    const scorecard = scoreBusinessOpportunity(input);
    expect(scorecard.opportunityId).toBe("OPP-001");
    expect(scorecard.projectedAnnualRevenueUsd).toBe(1000000); // $1M
    expect(scorecard.overallOpportunityScore).toBeGreaterThanOrEqual(85);
    expect(scorecard.feasibilityTier).toBe("HIGH");
  });

  it("scores micro-payment Fedimint clearing opportunity", () => {
    const input: BusinessOpportunityInput = {
      opportunityId: "OPP-002",
      title: "Fedimint Micro-Payment Clearing",
      targetRail: "FEDIMINT_MINT",
      estimatedTamUsd: 10000000, // $10M
      feeCapturePct: 1.0, // 1%
      technicalFeasibilityScore: 80,
      slaAlignmentScore: 85,
    };
    const scorecard = scoreBusinessOpportunity(input);
    expect(scorecard.opportunityId).toBe("OPP-002");
    expect(scorecard.projectedAnnualRevenueUsd).toBe(100000); // $100k
    expect(scorecard.feasibilityTier).toBe("MEDIUM");
  });
});
