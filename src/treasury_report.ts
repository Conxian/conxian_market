/**
 * Treasury monthly transparency reporting (MARKET-001, issue #8).
 *
 * Produces the KPI health indicators, asset-allocation status, fee-distribution
 * summary, and a renderable dashboard for monthly governance transparency.
 * Thresholds mirror docs/research/FUNDING_AND_ECONOMICS.md.
 */

import {
  DEFAULT_TARGET_ALLOCATION,
  type AssetAllocation,
  type HealthStatus,
} from "./monitoring_watcher";

export interface ThresholdBand {
  /** value >= green → GREEN */
  green: number;
  /** value >= yellow → YELLOW; below yellow → RED */
  yellow: number;
}

// ── Thresholds (FUNDING_AND_ECONOMICS.md) ──

export const RUNWAY_THRESHOLDS: ThresholdBand = { green: 12, yellow: 6 };
export const DAILY_VOLUME_THRESHOLDS: ThresholdBand = { green: 33_000, yellow: 15_000 };
export const MONTHLY_REVENUE_THRESHOLDS: ThresholdBand = { green: 20_000, yellow: 10_000 };
export const STABLECOIN_PCT_THRESHOLDS: ThresholdBand = { green: 40, yellow: 25 };

/** Fee distribution targets (Operations 50 / Founders 30 / Ecosystem 20). */
export const FEE_DISTRIBUTION_TARGETS = {
  operations: 50,
  founders: 30,
  ecosystem: 20,
} as const;

export interface TreasuryReportInput {
  /** Reporting month, e.g. "2026-09". */
  month: string;
  /** Total treasury assets (ZAR). */
  totalAssets: number;
  /** Monthly burn rate (ZAR/month). */
  monthlyBurnRate: number;
  /** Trailing daily volume (ZAR). */
  dailyVolume: number;
  /** Trailing monthly revenue (ZAR). */
  monthlyRevenue: number;
  /** Stablecoin share of the treasury (%). */
  stablecoinPct: number;
  /** Asset allocation split (ZAR). */
  allocation: AssetAllocation;
  /** Actual fee receipts per distribution bucket (ZAR). */
  feeTotals: { operations: number; founders: number; ecosystem: number };
  /** Multisig configuration. */
  multisig: { threshold: number; signers: number };
  /** Effective fee rate in basis points. */
  feeRateBps: number;
}

export interface HealthIndicator {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: HealthStatus;
  band: ThresholdBand;
}

export interface AllocationStatus {
  assetClass: string;
  targetPct: number;
  currentPct: number;
  status: HealthStatus;
}

export interface FeeDistributionSummary {
  allocation: "Operations" | "Founders" | "Ecosystem";
  amount: number;
  targetPct: number;
}

export interface TreasuryReport {
  month: string;
  generatedAtIso: string;
  overallStatus: HealthStatus;
  indicators: HealthIndicator[];
  allocation: AllocationStatus[];
  feeDistribution: FeeDistributionSummary[];
  multisig: { threshold: number; signers: number };
  feeRateBps: number;
  alerts: string[];
}

function evaluateIndicator(
  key: string,
  label: string,
  value: number,
  unit: string,
  band: ThresholdBand,
): HealthIndicator {
  const status: HealthStatus = value >= band.green ? "GREEN" : value >= band.yellow ? "YELLOW" : "RED";
  return { key, label, value, unit, status, band };
}

function escalate(current: HealthStatus, next: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = { GREEN: 0, YELLOW: 1, RED: 2 };
  return rank[next] > rank[current] ? next : current;
}

/**
 * Build the monthly treasury transparency report from raw treasury inputs.
 * Pure and deterministic; no network or on-chain I/O (aggregation is injected).
 */
export function generateMonthlyTreasuryReport(input: TreasuryReportInput): TreasuryReport {
  const indicators: HealthIndicator[] = [
    evaluateIndicator(
      "runway",
      "Runway",
      input.monthlyBurnRate > 0 ? input.totalAssets / input.monthlyBurnRate : Number.POSITIVE_INFINITY,
      "months",
      RUNWAY_THRESHOLDS,
    ),
    evaluateIndicator("dailyVolume", "Daily Volume", input.dailyVolume, "ZAR", DAILY_VOLUME_THRESHOLDS),
    evaluateIndicator("monthlyRevenue", "Monthly Revenue", input.monthlyRevenue, "ZAR", MONTHLY_REVENUE_THRESHOLDS),
    evaluateIndicator(
      "stablecoinPct",
      "Stablecoin %",
      input.stablecoinPct,
      "%",
      STABLECOIN_PCT_THRESHOLDS,
    ),
  ];

  const assetClasses: Array<{
    assetClass: string;
    value: number;
    targetPct: number;
  }> = [
    { assetClass: "Stablecoins", value: input.allocation.stablecoinsZar, targetPct: DEFAULT_TARGET_ALLOCATION.stablecoinsPct },
    { assetClass: "RWA/T-Bills", value: input.allocation.rwaZar, targetPct: DEFAULT_TARGET_ALLOCATION.rwaPct },
    { assetClass: "Liquid Staking", value: input.allocation.liquidStakingZar, targetPct: DEFAULT_TARGET_ALLOCATION.liquidStakingPct },
    { assetClass: "Native Token", value: input.allocation.nativeTokenZar, targetPct: DEFAULT_TARGET_ALLOCATION.nativeTokenPct },
  ];

  const allocation: AllocationStatus[] = assetClasses.map((a) => {
    const currentPct = input.totalAssets > 0 ? (a.value / input.totalAssets) * 100 : 0;
    const delta = Math.abs(currentPct - a.targetPct);
    const status: HealthStatus = delta <= 5 ? "GREEN" : delta <= 15 ? "YELLOW" : "RED";
    return { assetClass: a.assetClass, targetPct: a.targetPct, currentPct, status };
  });

  const feeDistribution: FeeDistributionSummary[] = [
    { allocation: "Operations", amount: input.feeTotals.operations, targetPct: FEE_DISTRIBUTION_TARGETS.operations },
    { allocation: "Founders", amount: input.feeTotals.founders, targetPct: FEE_DISTRIBUTION_TARGETS.founders },
    { allocation: "Ecosystem", amount: input.feeTotals.ecosystem, targetPct: FEE_DISTRIBUTION_TARGETS.ecosystem },
  ];

  const alerts: string[] = [];
  for (const i of indicators) {
    if (i.status === "RED") alerts.push(`CRITICAL: ${i.label} ${i.value}${i.unit} below red threshold (${i.band.yellow}${i.unit})`);
    else if (i.status === "YELLOW") alerts.push(`WARNING: ${i.label} ${i.value}${i.unit} below green threshold (${i.band.green}${i.unit})`);
  }
  if (input.multisig.signers < input.multisig.threshold) {
    alerts.push(`CRITICAL: multisig under-signer (${input.multisig.signers}/${input.multisig.threshold})`);
  }

  let overallStatus: HealthStatus = "GREEN";
  for (const i of indicators) overallStatus = escalate(overallStatus, i.status);
  for (const a of allocation) overallStatus = escalate(overallStatus, a.status);

  return {
    month: input.month,
    generatedAtIso: new Date().toISOString(),
    overallStatus,
    indicators,
    allocation,
    feeDistribution,
    multisig: { threshold: input.multisig.threshold, signers: input.multisig.signers },
    feeRateBps: input.feeRateBps,
    alerts,
  };
}

/** Render the ASCII KPI dashboard (matching MARKET-001) for governance posting. */
export function renderTreasuryDashboard(report: TreasuryReport): string {
  const fmt = (v: number, unit: string) =>
    Number.isFinite(v) ? `${v.toLocaleString("en-ZA")}${unit}` : "∞";
  const bar = (status: HealthStatus) => (status === "GREEN" ? "█████████████" : status === "YELLOW" ? "████████░░░░░" : "████░░░░░░░░░");
  const row = (label: string, indicator: HealthIndicator) =>
    `│  ${label.padEnd(16)}  │  ${fmt(indicator.value, indicator.unit).padEnd(15)}  │  ${bar(indicator.status)}  │`;

  const lines: string[] = [
    "┌────────────────────────────────────────────────────────────────┐",
    "│                    TREASURY KPI DASHBOARD                       │",
    "├────────────────────────────────────────────────────────────────┤",
    `│  Month: ${report.month.padEnd(50)} │`,
    "│                                                                 │",
    "│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐│",
    `│  │  RUNWAY ${fmt(report.indicators[0].value, "m").padEnd(8)}    │  │  REVENUE ${fmt(report.indicators[2].value, "").padEnd(9)} │  │  VOLUME ${fmt(report.indicators[1].value, "").padEnd(9)}  ││`,
    "│  └──────────────────┘  └──────────────────┘  └──────────────────┘│",
    "│                                                                 │",
    `│  STABLECOIN %: ${report.indicators[3].value.toFixed(1).padEnd(6)}   MULTISIG: ${report.multisig.threshold}-of-${report.multisig.signers}    FEE RATE: ${(report.feeRateBps / 100).toFixed(1)}%   │`,
    "│                                                                 │",
    "└────────────────────────────────────────────────────────────────┘",
  ];
  return lines.join("\n");
}
