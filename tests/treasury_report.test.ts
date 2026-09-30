import { describe, expect, it } from "vitest";
import {
  generateMonthlyTreasuryReport,
  renderTreasuryDashboard,
} from "../src/treasury_report";

const healthyInput = {
  month: "2026-09",
  totalAssets: 10_000_000,
  monthlyBurnRate: 500_000, // → 20-month runway
  dailyVolume: 50_000,
  monthlyRevenue: 30_000,
  stablecoinPct: 45,
  allocation: {
    stablecoinsZar: 4_000_000, // 40%
    rwaZar: 3_000_000, // 30%
    liquidStakingZar: 2_000_000, // 20%
    nativeTokenZar: 1_000_000, // 10%
  },
  feeTotals: { operations: 500_000, founders: 300_000, ecosystem: 200_000 },
  multisig: { threshold: 3, signers: 5 },
  feeRateBps: 200,
};

describe("generateMonthlyTreasuryReport", () => {
  it("classifies a healthy treasury as GREEN across all indicators", () => {
    const report = generateMonthlyTreasuryReport(healthyInput);
    expect(report.overallStatus).toBe("GREEN");
    expect(report.indicators.every((i) => i.status === "GREEN")).toBe(true);
    expect(report.indicators[0].value).toBe(20); // runway months
    expect(report.alerts).toEqual([]);
  });

  it("flags a short runway as RED", () => {
    const report = generateMonthlyTreasuryReport({
      ...healthyInput,
      monthlyBurnRate: 5_000_000, // 2-month runway
    });
    expect(report.overallStatus).toBe("RED");
    expect(report.indicators.find((i) => i.key === "runway")?.status).toBe("RED");
    expect(report.alerts.some((a) => a.includes("Runway"))).toBe(true);
  });

  it("computes asset-allocation deviation status against 40/30/20/10 targets", () => {
    const report = generateMonthlyTreasuryReport(healthyInput);
    const stable = report.allocation.find((a) => a.assetClass === "Stablecoins")!;
    expect(stable.targetPct).toBe(40);
    expect(stable.currentPct).toBeCloseTo(40);
    expect(stable.status).toBe("GREEN");
  });

  it("flags allocation drift when a class is far from target", () => {
    const report = generateMonthlyTreasuryReport({
      ...healthyInput,
      allocation: {
        stablecoinsZar: 1_000_000, // 10% vs 40% target → RED
        rwaZar: 3_000_000,
        liquidStakingZar: 2_000_000,
        nativeTokenZar: 4_000_000,
      },
    });
    const stable = report.allocation.find((a) => a.assetClass === "Stablecoins")!;
    expect(stable.status).toBe("RED");
    expect(report.overallStatus).toBe("RED");
  });

  it("reports fee distribution with target percentages", () => {
    const report = generateMonthlyTreasuryReport(healthyInput);
    expect(report.feeDistribution).toEqual([
      { allocation: "Operations", amount: 500_000, targetPct: 50 },
      { allocation: "Founders", amount: 300_000, targetPct: 30 },
      { allocation: "Ecosystem", amount: 200_000, targetPct: 20 },
    ]);
  });

  it("alerts on an under-signer multisig", () => {
    const report = generateMonthlyTreasuryReport({
      ...healthyInput,
      multisig: { threshold: 3, signers: 2 },
    });
    expect(report.alerts.some((a) => a.includes("multisig"))).toBe(true);
  });
});

describe("renderTreasuryDashboard", () => {
  it("renders the KPI dashboard with the reporting month", () => {
    const report = generateMonthlyTreasuryReport(healthyInput);
    const out = renderTreasuryDashboard(report);
    expect(out).toContain("TREASURY KPI DASHBOARD");
    expect(out).toContain("2026-09");
    expect(out).toContain("3-of-5");
  });
});
