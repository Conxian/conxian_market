/**
 * Conxian Protocol Fee Calculator (CON-1427).
 *
 * Implements the 4-tier TrustTier fee structure and 8-rail routing matrix.
 *
 * Fee structure (per GOVERNANCE.md & trust_tier_pricing.md):
 *   - ObserverOnly: N/A (read-only monitoring, settlement disabled)
 *   - Expedient:    2.0% (200 bps) launch base rate
 *   - Managed:      1.5% (150 bps) enclave attestation verified
 *   - Strict:       1.0% (100 bps) TEE + ZK proof verified
 *
 * Revenue distribution (50/30/20):
 *   - 50% Operations Treasury
 *   - 30% Founders Vesting
 *   - 20% Ecosystem Growth
 *
 * Refs: CON-1427, MARKET-010..016, SESSION_48
 */

import type {
  AttestationCertificate,
  DynamicFeeResult,
  DynamicRevenueProjection,
  DynamicRevenueScenario,
  FeeOptions,
  FeatureFlags,
  ProtocolFeeRecord,
  ProtocolFeeReport,
  RailFeeBreakdown,
  RevenueProjection,
  RevenueScenario,
  SettlementRail,
  TierFeeBreakdown,
  TrustTier,
  VolumeDecayTier,
} from "./core_types.js";
import {
  DEFAULT_FEATURE_FLAGS,
  SettlementRail as Rail,
  TrustTier as Tier,
} from "./core_types.js";

// Re-export enums for consumers
export { Rail as SettlementRail, Tier as TrustTier };

// ── Attestation & Tier Detection ──

export interface AttestationHeaders {
  "x-conxian-tee-proof"?: string;
  "x-conxian-zk-proof"?: string;
  "x-conxian-enclave-attestation"?: string;
  "x-conxian-light-proof"?: string;
}

/**
 * Detect TrustTier from request headers.
 *
 * Priority:
 *   1. Strict    — TEE proof + ZK proof present
 *   2. Managed   — Enclave attestation present
 *   3. Expedient — Light client proof present
 *   4. ObserverOnly — No proofs provided (read-only)
 */
export function detectTrustTier(headers: AttestationHeaders): TrustTier {
  if (headers["x-conxian-tee-proof"] && headers["x-conxian-zk-proof"]) {
    return Tier.Strict;
  }
  if (headers["x-conxian-enclave-attestation"]) {
    return Tier.Managed;
  }
  if (headers["x-conxian-light-proof"]) {
    return Tier.Expedient;
  }
  return Tier.ObserverOnly;
}

// ── Fee Basis Points Matrix ──

/** Base fee in basis points per tier */
export const TIER_FEE_BPS: Record<TrustTier, number> = {
  [Tier.ObserverOnly]: 0,     // Settlement not permitted
  [Tier.Expedient]: 200,      // 2.00%
  [Tier.Managed]: 150,        // 1.50%
  [Tier.Strict]: 100,         // 1.00%
};

/** Per-rail fee adjustment in basis points (multiplier offset) */
export const RAIL_FEE_OFFSET_BPS: Record<SettlementRail, number> = {
  [Rail.Statechain]: -10,   // -0.10% (incentivize off-chain VTXO)
  [Rail.Sbtc]: 0,           // Base rate
  [Rail.Rgb]: -20,          // -0.20% (privacy incentive)
  [Rail.Babylon]: 0,        // Base rate
  [Rail.Fedimint]: -15,     // -0.15% (community pool discount)
  [Rail.Lightning]: -25,    // -0.25% (micro-settlement discount)
  [Rail.AlexStacks]: 0,     // Base rate
  [Rail.EvmErc8183]: +10,   // +0.10% (cross-chain EVM overhead)
};

export interface FeeResult {
  tier: TrustTier;
  rail: SettlementRail;
  amountSat: bigint;
  feeSat: bigint;
  feeBps: number;
  distribution: {
    operationsSat: bigint;  // 50%
    foundersSat: bigint;    // 30%
    ecosystemSat: bigint;   // 20%
  };
}

/**
 * Calculate protocol fee for a settlement.
 *
 * Formula:
 *   effective_bps = max(10, TIER_FEE_BPS[tier] + RAIL_FEE_OFFSET_BPS[rail])
 *   fee_sat = (amount_sat * effective_bps) / 10000
 */
export function calculateRailFee(
  amountSat: bigint,
  tier: TrustTier,
  rail: SettlementRail,
): FeeResult {
  if (tier === Tier.ObserverOnly) {
    throw new Error("Settlement disabled for ObserverOnly tier. Upgrade attestation.");
  }

  const baseBps = TIER_FEE_BPS[tier];
  const offsetBps = RAIL_FEE_OFFSET_BPS[rail];
  // Minimum fee floor: 10 bps (0.10%)
  const effectiveBps = Math.max(10, baseBps + offsetBps);

  const feeSat = (amountSat * BigInt(effectiveBps)) / 10000n;

  // 50/30/20 distribution
  const operationsSat = (feeSat * 50n) / 100n;
  const foundersSat = (feeSat * 30n) / 100n;
  const ecosystemSat = feeSat - operationsSat - foundersSat; // Remainder to avoid rounding loss

  return {
    tier,
    rail,
    amountSat,
    feeSat,
    feeBps: effectiveBps,
    distribution: {
      operationsSat,
      foundersSat,
      ecosystemSat,
    },
  };
}

// ── Rail Selection & Routing Matrix ──

export interface RailPreference {
  costSensitivity?: "low" | "medium" | "high";
  speedSensitivity?: "low" | "medium" | "high";
  privacyRequirement?: boolean;
}

/**
 * Select optimal settlement rail based on tier and user preferences.
 */
export function selectRail(
  tier: TrustTier,
  pref: RailPreference = {},
): SettlementRail | null {
  if (tier === Tier.ObserverOnly) return null;

  // Privacy-required → RGB > Statechain > Lightning
  if (pref.privacyRequirement) {
    if (tier === Tier.Strict || tier === Tier.Managed) return Rail.Rgb;
    return Rail.Lightning;
  }

  // High speed sensitivity → Lightning > Statechain > Fedimint
  if (pref.speedSensitivity === "high") {
    return Rail.Lightning;
  }

  // High cost sensitivity → Lightning (-25bps) > RGB (-20bps) > Fedimint (-15bps)
  if (pref.costSensitivity === "high") {
    return Rail.Lightning;
  }

  // Default rail by tier
  switch (tier) {
    case Tier.Strict:
    case Tier.Managed:
      return Rail.Sbtc;
    case Tier.Expedient:
      return Rail.Lightning;
    default:
      return null;
  }
}

// ── Fee Report Generator ──

export interface SettlementEvent {
  settlementId: string;
  tier: TrustTier;
  rail: SettlementRail;
  amountSat: bigint;
  timestamp: number;
  builderId: string;
}

export interface FeeReport {
  periodStart: number;
  periodEnd: number;
  totalSettlements: number;
  totalVolumeSat: bigint;
  totalFeeSat: bigint;
  effectiveFeeBps: number;
  distribution: {
    operationsSat: bigint;
    foundersSat: bigint;
    ecosystemSat: bigint;
  };
  byRail: Record<string, RailFeeBreakdown>;
  byTier: Record<string, TierFeeBreakdown>;
}

/**
 * Aggregate settlement events into a comprehensive Protocol Fee Report.
 */
export function generateFeeReport(
  events: SettlementEvent[],
  periodStart: number,
  periodEnd: number,
): FeeReport {
  let totalVolumeSat = 0n;
  let totalFeeSat = 0n;
  let opsSat = 0n;
  let foundersSat = 0n;
  let ecoSat = 0n;

  const byRailMap = new Map<SettlementRail, { count: number; totalAmountSat: bigint; totalFeeSat: bigint }>();
  const byTierMap = new Map<TrustTier, { count: number; totalFeeSat: bigint }>();

  for (const ev of events) {
    if (ev.tier === Tier.ObserverOnly) continue;

    const fee = calculateRailFee(ev.amountSat, ev.tier, ev.rail);

    totalVolumeSat += ev.amountSat;
    totalFeeSat += fee.feeSat;
    opsSat += fee.distribution.operationsSat;
    foundersSat += fee.distribution.foundersSat;
    ecoSat += fee.distribution.ecosystemSat;

    // Aggregate by rail
    const railEntry = byRailMap.get(ev.rail) ?? { count: 0, totalAmountSat: 0n, totalFeeSat: 0n };
    railEntry.count += 1;
    railEntry.totalAmountSat += ev.amountSat;
    railEntry.totalFeeSat += fee.feeSat;
    byRailMap.set(ev.rail, railEntry);

    // Aggregate by tier
    const tierEntry = byTierMap.get(ev.tier) ?? { count: 0, totalFeeSat: 0n };
    tierEntry.count += 1;
    tierEntry.totalFeeSat += fee.feeSat;
    byTierMap.set(ev.tier, tierEntry);
  }

  const byRail: Record<string, RailFeeBreakdown> = {};
  for (const [rail, data] of byRailMap.entries()) {
    const avgFeeBps = data.totalAmountSat > 0n ? Number((data.totalFeeSat * 10000n) / data.totalAmountSat) : 0;
    byRail[rail] = {
      rail,
      count: data.count,
      totalAmountSat: data.totalAmountSat,
      totalFeeSat: data.totalFeeSat,
      avgFeeBps,
    };
  }

  const byTier: Record<string, TierFeeBreakdown> = {};
  for (const [tier, data] of byTierMap.entries()) {
    byTier[tier] = {
      tier,
      count: data.count,
      totalFeeSat: data.totalFeeSat,
    };
  }

  const effectiveFeeBps =
    totalVolumeSat > 0n
      ? Number((totalFeeSat * 10000n) / totalVolumeSat)
      : 0;

  return {
    periodStart,
    periodEnd,
    totalSettlements: events.length,
    totalVolumeSat,
    totalFeeSat,
    effectiveFeeBps,
    distribution: {
      operationsSat: opsSat,
      foundersSat,
      ecosystemSat: ecoSat,
    },
    byRail,
    byTier,
  };
}

// ── Gateway wire format ──

export interface ProtocolFeeHeader {
  [key: string]: string;
  "x-conxian-fee-bps": string;     // "200" = 2%
  "x-conxian-fee-sat": string;     // "2000" for 100K sats @ 2%
  "x-conxian-tier": string;        // "MANAGED"
  "x-conxian-rail": string;        // "SBTC"
}

export function toWireHeaders(fee: FeeResult): ProtocolFeeHeader {
  return {
    "x-conxian-fee-bps": String(fee.feeBps),
    "x-conxian-fee-sat": fee.feeSat.toString(),
    "x-conxian-tier": fee.tier,
    "x-conxian-rail": fee.rail,
  };
}

// ── Revenue projection helpers ──

/**
 * Model monthly/annual protocol fee revenue for a volume scenario.
 */
export function projectRevenue(scenario: RevenueScenario): RevenueProjection {
  const protocolFee = Math.round(scenario.monthlyVolumeUsd * 0.02 * 100) / 100;
  const premiumSurcharge = Math.round(scenario.monthlyVolumeUsd * 0.005 * 100) / 100;
  const institutional = Math.round(scenario.monthlyVolumeUsd * 0.003 * 100) / 100;
  const communityPools = Math.round(scenario.monthlyVolumeUsd * 0.001 * 100) / 100;
  const stakingYield = Math.round(scenario.monthlyVolumeUsd * 0.001 * 100) / 100;

  const totalMonthlyUsd = Math.round((protocolFee + premiumSurcharge + institutional + communityPools + stakingYield) * 100) / 100;
  const targetMonthlyUsd = 250_000;
  const pctOfTarget = Math.round((totalMonthlyUsd / targetMonthlyUsd) * 100 * 10) / 10;

  return {
    scenario: scenario.name,
    byStream: {
      protocolFee,
      premiumSurcharge,
      institutional,
      communityPools,
      stakingYield,
    },
    totalMonthlyUsd,
    pctOfTarget,
  };
}

// ── ADR-004: Dynamic Hybrid Fee Floor & System Load Self-Adjustment ──

/** Margin over measured rail cost (bps) that sets the flat floor — interchange-plus. */
export const RAIL_FLOOR_MARGIN_BPS = 2500; // +25%

/**
 * First-principles per-rail settlement cost estimate (sats) — v0 cost model.
 * Replace with measured cost when per-rail telemetry lands (G8 calibration).
 */
export const RAIL_COST_ESTIMATE_SAT: Record<SettlementRail, bigint> = {
  [Rail.Lightning]: 8n,
  [Rail.Statechain]: 20n,
  [Rail.Fedimint]: 20n,
  [Rail.Rgb]: 16n,
  [Rail.Sbtc]: 40n,
  [Rail.AlexStacks]: 40n,
  [Rail.Babylon]: 40n,
  [Rail.EvmErc8183]: 80n,
};

/** Derive a flat floor from cost + margin: `cost × (1 + margin_bps / 10_000)`. */
export function railFloorFromCost(costSat: bigint, marginBps: bigint): bigint {
  return (costSat * (10000n + marginBps)) / 10000n;
}

/** Logarithmic 30-day volume decay tiers (basis points). */
export const VOLUME_DECAY_BPS: Record<VolumeDecayTier, number> = {
  TIER_1: 200, // 2.00% — launch / low-volume
  TIER_2: 150, // 1.50%
  TIER_3: 75,  // 0.75%
  TIER_4: 25,  // 0.25% — high-velocity M2M
};

/** Minimum percentage fee floor (basis points). */
export const MIN_PERCENTAGE_FLOOR_BPS = 10;

/** Default flat satoshi floor for a settlement rail (cost + margin). */
export function getRailDefaultFlatFloor(rail: SettlementRail): bigint {
  return railFloorFromCost(RAIL_COST_ESTIMATE_SAT[rail], BigInt(RAIL_FLOOR_MARGIN_BPS));
}

/** Decayed basis-point rate for a volume tier, never below the percentage floor. */
export function calculateVolumeDecayedBps(tier: VolumeDecayTier): number {
  return Math.max(MIN_PERCENTAGE_FLOOR_BPS, VOLUME_DECAY_BPS[tier]);
}

/** 30-day settlement volume thresholds (sats) that gate entry into each decay tier. */
export const VOLUME_TIER_THRESHOLDS_SAT: readonly bigint[] = [
  0n,              // TIER_1 entry (always eligible)
  100_000_000n,    // TIER_2 entry (~1 BTC-equivalent volume)
  1_000_000_000n,  // TIER_3 entry (~10 BTC)
  10_000_000_000n, // TIER_4 entry (~100 BTC)
];

/** Hysteresis band (±5%) applied to tier boundaries to damp oscillation. */
export const TIER_HYSTERESIS_BPS = 500;

/**
 * Select a volume-decay tier from 30-day volume with hysteresis.
 *
 * A client oscillating near a tier boundary keeps its previous tier until the
 * volume clears the boundary by the hysteresis band (moving up) or falls below
 * the boundary by the band (moving down). Movement is also step-wise (at most
 * one tier per re-evaluation) so rates cannot jump across multiple tiers.
 */
export function selectVolumeDecayTier(
  volumeSat: bigint,
  previousTier: VolumeDecayTier = "TIER_1"
): VolumeDecayTier {
  const order: readonly VolumeDecayTier[] = ["TIER_1", "TIER_2", "TIER_3", "TIER_4"];
  const prevIndex = order.indexOf(previousTier);

  let naturalIndex = 0;
  for (let i = 0; i < order.length; i++) {
    if (volumeSat >= VOLUME_TIER_THRESHOLDS_SAT[i]) naturalIndex = i;
  }

  if (naturalIndex === prevIndex) return previousTier;

  const boundary = VOLUME_TIER_THRESHOLDS_SAT[Math.max(naturalIndex, prevIndex)];
  const band = (boundary * BigInt(TIER_HYSTERESIS_BPS)) / 10000n;

  // Moving up requires clearing the boundary plus the hysteresis band; moving
  // down requires dropping below the boundary minus the band.
  if (naturalIndex > prevIndex) {
    if (volumeSat < boundary + band) return previousTier;
  } else if (volumeSat > boundary - band) {
    return previousTier;
  }

  // Step-wise movement: at most one tier per re-evaluation.
  if (naturalIndex > prevIndex + 1) return order[prevIndex + 1];
  if (naturalIndex < prevIndex - 1) return order[prevIndex - 1];
  return order[naturalIndex];
}

/** Re-derive a rail flat floor from measured per-rail settlement cost (interchange-plus). */
export function calibrateRailFloorFromMeasuredCost(
  measuredCostSat: bigint,
  marginBps: bigint
): bigint {
  return railFloorFromCost(measuredCostSat, marginBps);
}


/** Map a mempool fee percentile (0–100) to a system-load factor (1.0–3.0). */
export function loadFactorFromMempoolPercentile(percentile: number): number {
  const p = Math.min(100, Math.max(0, percentile));
  if (p < 50) return 1.0;
  if (p < 90) return 1.0 + (p - 50) / 40;
  return 2.0 + (p - 90) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculate a dynamic settlement fee.
 *
 * effective_fee_sat = max(percentage_fee_sat, flat_floor_sat) * system_load_factor
 *
 * where percentage_fee_sat = amount_sat * decayed_bps / 10_000. The enterprise
 * subscription cap replaces the percentage component with the flat floor, so
 * high-value enterprise settlements never exceed the rail floor.
 */
export function calculateDynamicFee(options: FeeOptions): DynamicFeeResult {
  const {
    tier,
    rail,
    amountSat,
    volumeDecayTier = "TIER_1",
    systemLoadFactor = 1.0,
    enterpriseSubscriptionCap = false,
  } = options;

  if (tier === Tier.ObserverOnly) {
    throw new Error("Settlement disabled for ObserverOnly tier. Upgrade attestation.");
  }

  const loadFactor = clamp(systemLoadFactor, 1.0, 3.0);
  const decayBps = calculateVolumeDecayedBps(volumeDecayTier);
  const flatFloorSat = getRailDefaultFlatFloor(rail);

  const percentageFeeSat = (amountSat * BigInt(decayBps)) / 10000n;

  const baseFeeSat = enterpriseSubscriptionCap
    ? flatFloorSat
    : percentageFeeSat > flatFloorSat
      ? percentageFeeSat
      : flatFloorSat;

  const loadScaledSat = (baseFeeSat * BigInt(Math.round(loadFactor * 100))) / 100n;

  const operationsSat = (loadScaledSat * 50n) / 100n;
  const foundersSat = (loadScaledSat * 30n) / 100n;
  const ecosystemSat = loadScaledSat - operationsSat - foundersSat;

  const effectiveBps =
    amountSat > 0n ? Number((loadScaledSat * 10000n) / amountSat) : decayBps;

  return {
    tier,
    rail,
    amountSat,
    percentageFeeSat,
    flatFloorSat,
    effectiveFeeSat: loadScaledSat,
    effectiveBps,
    systemLoadFactor: loadFactor,
    volumeDecayTier,
    distribution: {
      operationsSat,
      foundersSat,
      ecosystemSat,
    },
  };
}

/**
 * Project dynamic-fee revenue for a monthly volume scenario.
 */
export function projectDynamicRevenueScenario(
  scenario: DynamicRevenueScenario,
): DynamicRevenueProjection {
  const totalSats = (scenario.monthlyVolumeUsd * 1e8) / scenario.btcPriceUsd;
  const monthlyTxns =
    scenario.averageTxnSat > 0 ? Math.floor(totalSats / scenario.averageTxnSat) : 0;

  const avgFee = calculateDynamicFee({
    tier: Tier.Expedient,
    rail: scenario.rail,
    amountSat: BigInt(scenario.averageTxnSat),
    volumeDecayTier: scenario.volumeDecayTier,
    systemLoadFactor: scenario.systemLoadFactor,
  });

  const totalMonthlyFeeSat = BigInt(monthlyTxns) * avgFee.effectiveFeeSat;
  const totalMonthlyFeeUsd =
    Math.round(((Number(totalMonthlyFeeSat) * scenario.btcPriceUsd) / 1e8) * 100) / 100;

  return {
    scenario: scenario.name,
    monthlyTxns,
    averageFeeSat: Number(avgFee.effectiveFeeSat),
    totalMonthlyFeeSat,
    totalMonthlyFeeUsd,
  };
}

/**
 * Resolve system load factor (1.0–3.0) from a mempool fee sample or adapter config.
 * Uses percentile mapping if provided; otherwise computes load factor from fastest fee.
 */
export function resolveSystemLoadFromMempool(
  config: import("./core_types.js").LoadOracleAdapterConfig
): number {
  const { sample, baselineFastestFeeSatVb = 10, maxFastestFeeSatVb = 100 } = config;

  if (typeof sample.percentile === "number") {
    return loadFactorFromMempoolPercentile(sample.percentile);
  }

  const baseline = Math.max(1, baselineFastestFeeSatVb);
  const ceiling = Math.max(baseline + 1, maxFastestFeeSatVb);
  const current = Math.max(0, sample.fastestFeeSatVb);

  if (current <= baseline) return 1.0;
  if (current >= ceiling) return 3.0;

  const ratio = (current - baseline) / (ceiling - baseline);
  return Math.min(3.0, Math.max(1.0, Math.round((1.0 + ratio * 2.0) * 100) / 100));
}

/**
 * Aggregate dynamic settlement events into an ADR-004 Dynamic Fee Report,
 * detailing total volume, total fees, 50/30/20 distribution, rail breakdowns,
 * and floor-dominated vs percentage-dominated settlement counts.
 */
export function generateDynamicFeeReport(
  events: import("./core_types.js").DynamicSettlementEvent[],
  periodStart: number,
  periodEnd: number
): import("./core_types.js").DynamicFeeReport {
  let totalVolumeSat = 0n;
  let totalFeeSat = 0n;
  let opsSat = 0n;
  let foundersSat = 0n;
  let ecoSat = 0n;
  let floorDominatedSettlements = 0;
  let percentageDominatedSettlements = 0;
  let settlementCount = 0;

  const byRailMap = new Map<
    SettlementRail,
    {
      count: number;
      totalAmountSat: bigint;
      totalFeeSat: bigint;
      floorDominatedCount: number;
      percentageDominatedCount: number;
    }
  >();

  for (const ev of events) {
    if (ev.tier === Tier.ObserverOnly) continue;
    settlementCount += 1;

    const res = calculateDynamicFee({
      tier: ev.tier,
      rail: ev.rail,
      amountSat: ev.amountSat,
      volumeDecayTier: ev.volumeDecayTier ?? "TIER_1",
      systemLoadFactor: ev.systemLoadFactor ?? 1.0,
      enterpriseSubscriptionCap: ev.enterpriseSubscriptionCap ?? false,
    });

    totalVolumeSat += ev.amountSat;
    totalFeeSat += res.effectiveFeeSat;
    opsSat += res.distribution.operationsSat;
    foundersSat += res.distribution.foundersSat;
    ecoSat += res.distribution.ecosystemSat;

    const isFloor = ev.enterpriseSubscriptionCap
      ? true
      : res.flatFloorSat >= res.percentageFeeSat;
    if (isFloor) {
      floorDominatedSettlements += 1;
    } else {
      percentageDominatedSettlements += 1;
    }

    const railEntry = byRailMap.get(ev.rail) ?? {
      count: 0,
      totalAmountSat: 0n,
      totalFeeSat: 0n,
      floorDominatedCount: 0,
      percentageDominatedCount: 0,
    };

    railEntry.count += 1;
    railEntry.totalAmountSat += ev.amountSat;
    railEntry.totalFeeSat += res.effectiveFeeSat;
    if (isFloor) {
      railEntry.floorDominatedCount += 1;
    } else {
      railEntry.percentageDominatedCount += 1;
    }
    byRailMap.set(ev.rail, railEntry);
  }

  const byRail: Record<string, import("./core_types.js").DynamicFeeBreakdownByRail> = {};
  for (const [rail, data] of byRailMap.entries()) {
    const avgEffectiveBps =
      data.totalAmountSat > 0n
        ? Number((data.totalFeeSat * 10000n) / data.totalAmountSat)
        : 0;

    byRail[rail] = {
      rail,
      count: data.count,
      totalAmountSat: data.totalAmountSat,
      totalFeeSat: data.totalFeeSat,
      floorDominatedCount: data.floorDominatedCount,
      percentageDominatedCount: data.percentageDominatedCount,
      avgEffectiveBps,
    };
  }

  const effectiveFeeBps =
    totalVolumeSat > 0n ? Number((totalFeeSat * 10000n) / totalVolumeSat) : 0;

  return {
    periodStart,
    periodEnd,
    totalSettlements: settlementCount,
    totalVolumeSat,
    totalFeeSat,
    floorDominatedSettlements,
    percentageDominatedSettlements,
    effectiveFeeBps,
    distribution: {
      operationsSat: opsSat,
      foundersSat,
      ecosystemSat: ecoSat,
    },
    byRail,
  };
}
