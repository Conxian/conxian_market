import { describe, expect, it } from "vitest";
import {
  calculateRailFee,
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
