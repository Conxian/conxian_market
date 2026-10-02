import { describe, expect, it } from "vitest";
import {
  calculateRailFee,
  calculateDynamicFee,
  calculateVolumeDecayedBps,
  getRailDefaultFlatFloor,
  railFloorFromCost,
  loadFactorFromMempoolPercentile,
  projectDynamicRevenueScenario,
  detectTrustTier,
  generateFeeReport,
  projectRevenue,
  selectRail,
  toWireHeaders,
  SettlementRail,
  TrustTier,
  TIER_FEE_BPS,
  RAIL_FEE_OFFSET_BPS,
} from "../src/fee_calculator";

describe("fee_calculator", () => {
  describe("detectTrustTier", () => {
    it("detects Strict tier when TEE proof and ZK proof are provided", () => {
      const tier = detectTrustTier({
        "x-conxian-tee-proof": "tee-123",
        "x-conxian-zk-proof": "zk-456",
      });
      expect(tier).toBe(TrustTier.Strict);
    });

    it("detects Managed tier when enclave attestation is provided", () => {
      const tier = detectTrustTier({
        "x-conxian-enclave-attestation": "enclave-789",
      });
      expect(tier).toBe(TrustTier.Managed);
    });

    it("detects Expedient tier when light proof is provided", () => {
      const tier = detectTrustTier({
        "x-conxian-light-proof": "light-000",
      });
      expect(tier).toBe(TrustTier.Expedient);
    });

    it("defaults to ObserverOnly tier when no valid attestation headers are provided", () => {
      const tier = detectTrustTier({});
      expect(tier).toBe(TrustTier.ObserverOnly);
    });
  });

  describe("calculateRailFee", () => {
    it("throws error for ObserverOnly tier", () => {
      expect(() =>
        calculateRailFee(100_000n, TrustTier.ObserverOnly, SettlementRail.Sbtc),
      ).toThrow("Settlement disabled for ObserverOnly tier");
    });

    it("calculates correct fee for Expedient tier on sBTC (200 bps base + 0 offset = 200 bps)", () => {
      const result = calculateRailFee(100_000n, TrustTier.Expedient, SettlementRail.Sbtc);
      expect(result.feeBps).toBe(200);
      expect(result.feeSat).toBe(2000n);
      expect(result.distribution.operationsSat).toBe(1000n); // 50%
      expect(result.distribution.foundersSat).toBe(600n);    // 30%
      expect(result.distribution.ecosystemSat).toBe(400n);   // 20%
    });

    it("calculates correct fee with discount offset (Expedient tier on Lightning: 200 - 25 = 175 bps)", () => {
      const result = calculateRailFee(100_000n, TrustTier.Expedient, SettlementRail.Lightning);
      expect(result.feeBps).toBe(175);
      expect(result.feeSat).toBe(1750n);
    });

    it("enforces minimum floor of 10 bps", () => {
      const result = calculateRailFee(100_000n, TrustTier.Strict, SettlementRail.Rgb);
      // Strict base = 100 bps, RGB offset = -20 bps → 80 bps > 10 bps floor
      expect(result.feeBps).toBe(80);
    });
  });

  describe("selectRail", () => {
    it("returns null for ObserverOnly tier", () => {
      expect(selectRail(TrustTier.ObserverOnly)).toBeNull();
    });

    it("prioritizes Lightning for high speed sensitivity", () => {
      const rail = selectRail(TrustTier.Expedient, { speedSensitivity: "high" });
      expect(rail).toBe(SettlementRail.Lightning);
    });

    it("prioritizes RGB for privacy requirement in Managed tier", () => {
      const rail = selectRail(TrustTier.Managed, { privacyRequirement: true });
      expect(rail).toBe(SettlementRail.Rgb);
    });

    it("defaults to sBTC for Managed/Strict tier when no special preference set", () => {
      expect(selectRail(TrustTier.Managed)).toBe(SettlementRail.Sbtc);
      expect(selectRail(TrustTier.Strict)).toBe(SettlementRail.Sbtc);
    });
  });

  describe("generateFeeReport & toWireHeaders", () => {
    it("generates aggregated fee report for events", () => {
      const events = [
        {
          settlementId: "s1",
          tier: TrustTier.Expedient,
          rail: SettlementRail.Sbtc,
          amountSat: 100_000n,
          timestamp: 1000,
          builderId: "builder-1",
        },
        {
          settlementId: "s2",
          tier: TrustTier.Managed,
          rail: SettlementRail.Lightning,
          amountSat: 200_000n,
          timestamp: 1001,
          builderId: "builder-2",
        },
      ];

      const report = generateFeeReport(events, 1000, 2000);
      expect(report.totalSettlements).toBe(2);
      expect(report.totalVolumeSat).toBe(300_000n);
      expect(report.byRail[SettlementRail.Sbtc].count).toBe(1);
      expect(report.byRail[SettlementRail.Lightning].count).toBe(1);
    });

    it("formats wire headers correctly", () => {
      const fee = calculateRailFee(100_000n, TrustTier.Expedient, SettlementRail.Sbtc);
      const headers = toWireHeaders(fee);
      expect(headers["x-conxian-fee-bps"]).toBe("200");
      expect(headers["x-conxian-fee-sat"]).toBe("2000");
      expect(headers["x-conxian-tier"]).toBe(TrustTier.Expedient);
      expect(headers["x-conxian-rail"]).toBe(SettlementRail.Sbtc);
    });
  });

  describe("projectRevenue", () => {
    it("projects revenue based on volume scenario", () => {
      const projection = projectRevenue({
        name: "Base Scenario",
        monthlyVolumeUsd: 1_000_000,
        btcPriceUsd: 65_000,
      });

      expect(projection.scenario).toBe("Base Scenario");
      expect(projection.byStream.protocolFee).toBe(20_000); // 2% of $1M
      expect(projection.totalMonthlyUsd).toBe(30_000); // sum of streams (3%)
      expect(projection.pctOfTarget).toBe(12.0); // 30k / 250k = 12%
    });
  });
});

describe("ADR-004 dynamic fee model", () => {
  describe("getRailDefaultFlatFloor", () => {
    it("returns the documented rail-specific flat floors", () => {
      expect(getRailDefaultFlatFloor(SettlementRail.Lightning)).toBe(10n);
      expect(getRailDefaultFlatFloor(SettlementRail.Statechain)).toBe(25n);
      expect(getRailDefaultFlatFloor(SettlementRail.Fedimint)).toBe(25n);
      expect(getRailDefaultFlatFloor(SettlementRail.Rgb)).toBe(20n);
      expect(getRailDefaultFlatFloor(SettlementRail.Sbtc)).toBe(50n);
      expect(getRailDefaultFlatFloor(SettlementRail.AlexStacks)).toBe(50n);
      expect(getRailDefaultFlatFloor(SettlementRail.Babylon)).toBe(50n);
      expect(getRailDefaultFlatFloor(SettlementRail.EvmErc8183)).toBe(100n);
    });
  });

  describe("railFloorFromCost & cost model", () => {
    it("derives floors as cost + margin (interchange-plus)", () => {
      expect(railFloorFromCost(8n, 2500n)).toBe(10n);
      expect(railFloorFromCost(80n, 2500n)).toBe(100n);
      expect(railFloorFromCost(8n, 0n)).toBe(8n);
    });
  });

  describe("loadFactorFromMempoolPercentile", () => {
    it("maps percentile to a 1.0-3.0 load factor", () => {
      expect(loadFactorFromMempoolPercentile(0)).toBe(1.0);
      expect(loadFactorFromMempoolPercentile(50)).toBe(1.0);
      expect(loadFactorFromMempoolPercentile(70)).toBeCloseTo(1.5);
      expect(loadFactorFromMempoolPercentile(90)).toBeCloseTo(2.0);
      expect(loadFactorFromMempoolPercentile(100)).toBe(3.0);
      expect(loadFactorFromMempoolPercentile(-5)).toBe(1.0);
      expect(loadFactorFromMempoolPercentile(150)).toBe(3.0);
    });
  });

  describe("calculateVolumeDecayedBps", () => {
    it("decays 200 -> 150 -> 75 -> 25 across tiers", () => {
      expect(calculateVolumeDecayedBps("TIER_1")).toBe(200);
      expect(calculateVolumeDecayedBps("TIER_2")).toBe(150);
      expect(calculateVolumeDecayedBps("TIER_3")).toBe(75);
      expect(calculateVolumeDecayedBps("TIER_4")).toBe(25);
    });
  });

  describe("calculateDynamicFee", () => {
    it("applies the flat floor to micro-payments (dust protection)", () => {
      const fee = calculateDynamicFee({
        tier: TrustTier.Expedient,
        rail: SettlementRail.Lightning,
        amountSat: 50n,
        volumeDecayTier: "TIER_1",
      });
      // 50 sats @ 200bps = 1 sat, but flat floor = 10 sats
      expect(fee.effectiveFeeSat).toBe(10n);
      expect(fee.flatFloorSat).toBe(10n);
    });

    it("uses percentage fee when it exceeds the flat floor", () => {
      const fee = calculateDynamicFee({
        tier: TrustTier.Expedient,
        rail: SettlementRail.Sbtc,
        amountSat: 100_000n,
        volumeDecayTier: "TIER_1",
      });
      // 100k sats @ 200bps = 2000 sats > 50 sat floor
      expect(fee.effectiveFeeSat).toBe(2000n);
    });

    it("applies the system load factor (1.0x - 3.0x)", () => {
      const fee = calculateDynamicFee({
        tier: TrustTier.Expedient,
        rail: SettlementRail.Lightning,
        amountSat: 100_000n,
        volumeDecayTier: "TIER_1",
        systemLoadFactor: 2.5,
      });
      // 100k @ 200bps = 2000 sats * 2.5 = 5000
      expect(fee.effectiveFeeSat).toBe(5000n);
      expect(fee.systemLoadFactor).toBe(2.5);
    });

    it("clamps the load factor to [1.0, 3.0]", () => {
      const low = calculateDynamicFee({
        tier: TrustTier.Expedient,
        rail: SettlementRail.Lightning,
        amountSat: 100_000n,
        systemLoadFactor: 0.1,
      });
      expect(low.systemLoadFactor).toBe(1.0);

      const high = calculateDynamicFee({
        tier: TrustTier.Expedient,
        rail: SettlementRail.Lightning,
        amountSat: 100_000n,
        systemLoadFactor: 9.9,
      });
      expect(high.systemLoadFactor).toBe(3.0);
    });

    it("caps enterprise subscription settlements at the flat floor", () => {
      const fee = calculateDynamicFee({
        tier: TrustTier.Strict,
        rail: SettlementRail.EvmErc8183,
        amountSat: 10_000_000n,
        volumeDecayTier: "TIER_1",
        enterpriseSubscriptionCap: true,
      });
      // capped at EVM flat floor (100 sats) regardless of percentage fee
      expect(fee.effectiveFeeSat).toBe(100n);
    });

    it("distributes 50/30/20 and preserves the full amount", () => {
      const fee = calculateDynamicFee({
        tier: TrustTier.Expedient,
        rail: SettlementRail.Sbtc,
        amountSat: 100_000n,
        volumeDecayTier: "TIER_1",
      });
      const { operationsSat, foundersSat, ecosystemSat } = fee.distribution;
      expect(operationsSat + foundersSat + ecosystemSat).toBe(fee.effectiveFeeSat);
      expect(operationsSat).toBe(1000n); // 50% of 2000
      expect(foundersSat).toBe(600n); // 30% of 2000
      expect(ecosystemSat).toBe(400n); // 20% of 2000
    });

    it("rejects ObserverOnly tier", () => {
      expect(() =>
        calculateDynamicFee({
          tier: TrustTier.ObserverOnly,
          rail: SettlementRail.Lightning,
          amountSat: 100n,
        }),
      ).toThrow();
    });
  });

  describe("projectDynamicRevenueScenario", () => {
    it("projects monthly fee revenue for a volume scenario", () => {
      const projection = projectDynamicRevenueScenario({
        name: "baseline",
        monthlyVolumeUsd: 100_000,
        btcPriceUsd: 100_000,
        averageTxnSat: 1000,
        rail: SettlementRail.Lightning,
        volumeDecayTier: "TIER_1",
        systemLoadFactor: 1.0,
      });
      // 100k USD / 100k USD/BTC = 1 BTC = 1e8 sats; /1000 sats = 1e5 txns
      expect(projection.monthlyTxns).toBe(100_000);
      // 1000 sats @ 200bps = 20 sats (above 10 sat Lightning floor)
      expect(projection.averageFeeSat).toBe(20);
      expect(projection.totalMonthlyFeeSat).toBe(2_000_000n);
      // 2e6 sats * 100k USD/BTC / 1e8 = 2000 USD
      expect(projection.totalMonthlyFeeUsd).toBe(2_000);
    });
  });
});
