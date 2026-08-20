import { describe, expect, it } from "vitest";
import { BosYieldSplitter } from "../src/bos_yield_splitter";

describe("BosYieldSplitter", () => {
  it("calculates accurate 80/10/10 yield split for AI labor transactions", () => {
    const grossSat = 1_000_000n; // 1M sats
    const split = BosYieldSplitter.calculateYieldSplit(grossSat);

    expect(split.grossAmountSat).toBe(1_000_000n);
    expect(split.builderSat).toBe(800_000n);               // 80%
    expect(split.platformTreasurySat).toBe(100_000n);      // 10%
    expect(split.ecosystemStakeholdersSat).toBe(100_000n); // 10%
    expect(split.builderSat + split.platformTreasurySat + split.ecosystemStakeholdersSat).toBe(grossSat);
  });

  it("applies fee decay schedule based on launch duration", () => {
    // Phase 1: 0-12 months -> 2.0% (200 bps)
    const p1 = BosYieldSplitter.getEffectiveFeeRateBps(6);
    expect(p1.phase).toBe("Launch Stabilization");
    expect(p1.rateBps).toBe(200);

    // Phase 2: 12-36 months -> 1.5% (150 bps)
    const p2 = BosYieldSplitter.getEffectiveFeeRateBps(24);
    expect(p2.phase).toBe("Growth Phase");
    expect(p2.rateBps).toBe(150);

    // Phase 3: 36+ months -> 1.0% (100 bps)
    const p3 = BosYieldSplitter.getEffectiveFeeRateBps(48);
    expect(p3.phase).toBe("Mature Ecosystem");
    expect(p3.rateBps).toBe(100);
  });

  it("distributes protocol fee 50% Ops / 30% Founders / 20% Ecosystem", () => {
    const grossSat = 10_000_000n; // 10M sats
    const feeDist = BosYieldSplitter.distributeProtocolFee(grossSat, 6); // 200 bps = 200,000 sats fee

    expect(feeDist.feeSat).toBe(200_000n);
    expect(feeDist.operationsTreasurySat).toBe(100_000n); // 50%
    expect(feeDist.founderCompensationSat).toBe(60_000n);  // 30%
    expect(feeDist.ecosystemGrowthSat).toBe(40_000n);      // 20%
    expect(feeDist.operationsTreasurySat + feeDist.founderCompensationSat + feeDist.ecosystemGrowthSat).toBe(feeDist.feeSat);
  });

  it("evaluates founder vesting, performance caps, and emergency limits", () => {
    // Case 1: Pre-cliff (<12 months)
    const preCliff = BosYieldSplitter.evaluateFounderVesting({
      monthsElapsed: 6,
      totalAllocatedSat: 12_000_000n,
      monthlyBaseCapSat: 100_000n,
      daoBonusSat: 50_000n,
      escrowSat: 200_000n,
    });

    expect(preCliff.isVested).toBe(false);
    expect(preCliff.authorizedMonthlyBaseSat).toBe(0n);
    expect(preCliff.violations.length).toBeGreaterThan(0);

    // Case 2: Post-cliff (24 months = 50% vested) with bonus cap breach & valid escrow
    const postCliff = BosYieldSplitter.evaluateFounderVesting({
      monthsElapsed: 24,
      totalAllocatedSat: 12_000_000n,
      monthlyBaseCapSat: 100_000n,
      daoBonusSat: 150_000n, // Exceeds 100K base cap
      escrowSat: 500_000n,   // Within 600K limit (6 * 100K)
    });

    expect(postCliff.isVested).toBe(true);
    expect(postCliff.vestedRatio).toBe(0.5);
    expect(postCliff.vestedAmountSat).toBe(6_000_000n);
    expect(postCliff.authorizedBonusSat).toBe(100_000n); // Capped at 100K
    expect(postCliff.isEscrowWithinLimit).toBe(true);
    expect(postCliff.violations).toContain("DAO bonus capped at 50% of total monthly compensation");
  });

  it("verifies Sovereign OS Thin Orchestrator and BYOK security policy", () => {
    // Compliant edge agent
    const validAgent = BosYieldSplitter.verifyInferencePolicy({
      isCentralizedInference: false,
      handlesPrivateKeys: true,
      usesMcpHandoff: true,
      usesEnclaveSdk: true,
    });

    expect(validAgent.compliant).toBe(true);
    expect(validAgent.violations.length).toBe(0);

    // Non-compliant centralized agent with raw key handling
    const invalidAgent = BosYieldSplitter.verifyInferencePolicy({
      isCentralizedInference: true,
      handlesPrivateKeys: true,
      usesMcpHandoff: false,
      usesEnclaveSdk: false,
    });

    expect(invalidAgent.compliant).toBe(false);
    expect(invalidAgent.violations).toContain("Centralized heavy AI inference prohibited; must run at edge or via user keys");
    expect(invalidAgent.violations).toContain("Agent handoffs must use Model Context Protocol (MCP)");
    expect(invalidAgent.violations).toContain("Sensitive key handling requires conxius-enclave-sdk integration");
  });
});
