import { describe, expect, it } from "vitest";
import {
  calculateRailFee,
  calculateDynamicFee,
  calculateVolumeDecayedBps,
  getRailDefaultFlatFloor,
  railFloorFromCost,
  loadFactorFromMempoolPercentile,
  projectDynamicRevenueScenario,
  resolveSystemLoadFromMempool,
  generateDynamicFeeReport,
  selectVolumeDecayTier,
  calibrateRailFloorFromMeasuredCost,
  detectTrustTier,
  generateFeeReport,
  projectRevenue,
  selectRail,
  toWireHeaders,
  SettlementRail,
  TrustTier,
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

    it("calculates the TIER_1 volume-decay rate (0.50%) above the sBTC flat floor", () => {
      const result = calculateRailFee(100_000n, TrustTier.Expedient, SettlementRail.Sbtc);
      // 100k sats @ 50bps = 500 sats > 375 sat sBTC floor
      expect(result.feeBps).toBe(50);
      expect(result.feeSat).toBe(500n);
      expect(result.distribution.operationsSat).toBe(250n); // 50%
      expect(result.distribution.foundersSat).toBe(150n);    // 30%
      expect(result.distribution.ecosystemSat).toBe(100n);   // 20%
    });

    it("applies a single rate across networks (no per-rail offset)", () => {
      const result = calculateRailFee(100_000n, TrustTier.Expedient, SettlementRail.Lightning);
      expect(result.feeBps).toBe(50);
      expect(result.feeSat).toBe(500n);
    });

    it("applies the rail flat floor to micro-settlements (cost recovery)", () => {
      const result = calculateRailFee(5n, TrustTier.Expedient, SettlementRail.Lightning);
      // 5 sats @ 50bps = 0 sats → Lightning flat floor = 10 sats
      expect(result.feeSat).toBe(10n);
      expect(result.feeBps).toBe(20000);
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
      expect(headers["x-conxian-fee-bps"]).toBe("50");
      expect(headers["x-conxian-fee-sat"]).toBe("500");
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
      expect(getRailDefaultFlatFloor(SettlementRail.Statechain)).toBe(125n);
      expect(getRailDefaultFlatFloor(SettlementRail.Fedimint)).toBe(25n);
      expect(getRailDefaultFlatFloor(SettlementRail.Rgb)).toBe(312n);
      expect(getRailDefaultFlatFloor(SettlementRail.Sbtc)).toBe(375n);
      expect(getRailDefaultFlatFloor(SettlementRail.AlexStacks)).toBe(50n);
      expect(getRailDefaultFlatFloor(SettlementRail.Babylon)).toBe(50n);
      expect(getRailDefaultFlatFloor(SettlementRail.EvmErc8183)).toBe(75n);
    });
  });

  describe("railFloorFromCost & cost model", () => {
    it("derives floors as cost + margin (interchange-plus)", () => {
      expect(railFloorFromCost(8n, 2500n)).toBe(10n);
      expect(railFloorFromCost(60n, 2500n)).toBe(75n);
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
    it("decays 50 -> 25 -> 15 -> 10 across tiers", () => {
      expect(calculateVolumeDecayedBps("TIER_1")).toBe(50);
      expect(calculateVolumeDecayedBps("TIER_2")).toBe(25);
      expect(calculateVolumeDecayedBps("TIER_3")).toBe(15);
      expect(calculateVolumeDecayedBps("TIER_4")).toBe(10);
    });
  });

  describe("selectVolumeDecayTier (hysteresis)", () => {
    it("selects the natural tier when far past a boundary", () => {
      expect(selectVolumeDecayTier(50_000_000n, "TIER_1")).toBe("TIER_1");
      expect(selectVolumeDecayTier(200_000_000n, "TIER_1")).toBe("TIER_2");
      expect(selectVolumeDecayTier(11_000_000_000n, "TIER_1")).toBe("TIER_2");
    });

    it("damps oscillation just above a boundary (hysteresis band)", () => {
      // 100_000_000 (TIER_2 entry) + 5% band = 105_000_000.
      expect(selectVolumeDecayTier(102_000_000n, "TIER_1")).toBe("TIER_1");
      expect(selectVolumeDecayTier(110_000_000n, "TIER_1")).toBe("TIER_2");
    });

    it("keeps the previous tier just below a boundary when moving down", () => {
      // Below TIER_2 entry minus band: 100_000_000 - 5% = 95_000_000.
      expect(selectVolumeDecayTier(97_000_000n, "TIER_2")).toBe("TIER_2");
      expect(selectVolumeDecayTier(90_000_000n, "TIER_2")).toBe("TIER_1");
    });

    it("moves step-wise (at most one tier per re-evaluation)", () => {
      expect(selectVolumeDecayTier(50_000_000_000n, "TIER_1")).toBe("TIER_2");
    });
  });

  describe("calibrateRailFloorFromMeasuredCost", () => {
    it("derives floor as measured cost + margin (interchange-plus)", () => {
      expect(calibrateRailFloorFromMeasuredCost(40n, 250n)).toBe(41n);
      expect(calibrateRailFloorFromMeasuredCost(80n, 250n)).toBe(82n);
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
      // 50 sats @ 50bps = 0 sats, but flat floor = 10 sats
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
      // 100k sats @ 50bps = 500 sats > 375 sat sBTC floor
      expect(fee.effectiveFeeSat).toBe(500n);
    });

    it("applies the system load factor (1.0x - 3.0x)", () => {
      const fee = calculateDynamicFee({
        tier: TrustTier.Expedient,
        rail: SettlementRail.Lightning,
        amountSat: 100_000n,
        volumeDecayTier: "TIER_1",
        systemLoadFactor: 2.5,
      });
      // 100k @ 50bps = 500 sats * 2.5 = 1250
      expect(fee.effectiveFeeSat).toBe(1250n);
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
      // capped at EVM flat floor (75 sats) regardless of percentage fee
      expect(fee.effectiveFeeSat).toBe(75n);
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
      expect(operationsSat).toBe(250n); // 50% of 500
      expect(foundersSat).toBe(150n); // 30% of 500
      expect(ecosystemSat).toBe(100n); // 20% of 500
    });

    it("reports floor-dominance for enterprise-capped settlements and excludes observers", () => {
      const report = generateDynamicFeeReport(
        [
          {
            settlementId: "ent-01",
            tier: TrustTier.Strict,
            rail: SettlementRail.EvmErc8183,
            amountSat: 10_000_000n,
            volumeDecayTier: "TIER_1",
            enterpriseSubscriptionCap: true,
            timestamp: 1000,
            builderId: "builder-ent",
          },
          {
            settlementId: "obs-01",
            tier: TrustTier.ObserverOnly,
            rail: SettlementRail.Lightning,
            amountSat: 100n,
            timestamp: 1001,
            builderId: "builder-obs",
          },
        ],
        1000,
        2000
      );
      expect(report.totalSettlements).toBe(1);
      expect(report.floorDominatedSettlements).toBe(1);
      expect(report.percentageDominatedSettlements).toBe(0);
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
      // 1000 sats @ 50bps = 5 sats, below the 10 sat Lightning floor → floor dominates
      expect(projection.averageFeeSat).toBe(10);
      expect(projection.totalMonthlyFeeSat).toBe(1_000_000n);
      // 1e6 sats * 100k USD/BTC / 1e8 = 1000 USD
      expect(projection.totalMonthlyFeeUsd).toBe(1_000);
    });
  });
});

  describe("resolveSystemLoadFromMempool & generateDynamicFeeReport", () => {
    it("resolves system load factor from mempool fee samples and percentiles", () => {
      // Direct percentile
      expect(
        resolveSystemLoadFromMempool({ sample: { fastestFeeSatVb: 15, halfHourFeeSatVb: 10, hourFeeSatVb: 5, minimumFeeSatVb: 1, percentile: 20 } })
      ).toBe(1.0);
      expect(
        resolveSystemLoadFromMempool({ sample: { fastestFeeSatVb: 100, halfHourFeeSatVb: 80, hourFeeSatVb: 50, minimumFeeSatVb: 1, percentile: 95 } })
      ).toBe(2.5);

      // Interpolated from fastestFeeSatVb (baseline 10, ceiling 100)
      expect(
        resolveSystemLoadFromMempool({ sample: { fastestFeeSatVb: 10, halfHourFeeSatVb: 8, hourFeeSatVb: 5, minimumFeeSatVb: 1 }, baselineFastestFeeSatVb: 10, maxFastestFeeSatVb: 100 })
      ).toBe(1.0);
      expect(
        resolveSystemLoadFromMempool({ sample: { fastestFeeSatVb: 55, halfHourFeeSatVb: 40, hourFeeSatVb: 20, minimumFeeSatVb: 1 }, baselineFastestFeeSatVb: 10, maxFastestFeeSatVb: 100 })
      ).toBe(2.0);
      expect(
        resolveSystemLoadFromMempool({ sample: { fastestFeeSatVb: 120, halfHourFeeSatVb: 100, hourFeeSatVb: 80, minimumFeeSatVb: 1 }, baselineFastestFeeSatVb: 10, maxFastestFeeSatVb: 100 })
      ).toBe(3.0);
    });

    it("aggregates dynamic settlement events into ADR-004 fee report", () => {
      const events: import("../src/core_types").DynamicSettlementEvent[] = [
        {
          settlementId: "set-001",
          tier: TrustTier.Expedient,
          rail: SettlementRail.Lightning,
          amountSat: 50n, // Floor-dominated (10 sats floor > 0 sats percentage)
          timestamp: 1000,
          builderId: "builder-a",
        },
        {
          settlementId: "set-002",
          tier: TrustTier.Expedient,
          rail: SettlementRail.Lightning,
          amountSat: 100_000n, // Percentage-dominated (500 sats percentage > 10 sats floor)
          timestamp: 1100,
          builderId: "builder-b",
        },
      ];

      const report = generateDynamicFeeReport(events, 1000, 2000);

      expect(report.totalSettlements).toBe(2);
      expect(report.totalVolumeSat).toBe(100_050n);
      expect(report.floorDominatedSettlements).toBe(1);
      expect(report.percentageDominatedSettlements).toBe(1);
      expect(report.totalFeeSat).toBe(510n); // 10 sats + 500 sats
      expect(report.distribution.operationsSat).toBe(255n); // 50%
      expect(report.distribution.foundersSat).toBe(153n); // 30%
      expect(report.distribution.ecosystemSat).toBe(102n); // 20%
      expect(report.byRail[SettlementRail.Lightning].floorDominatedCount).toBe(1);
      expect(report.byRail[SettlementRail.Lightning].percentageDominatedCount).toBe(1);
    });
  });
