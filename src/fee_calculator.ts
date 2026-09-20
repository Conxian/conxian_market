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
  FeatureFlags,
  ProtocolFeeRecord,
  ProtocolFeeReport,
  RailFeeBreakdown,
  RevenueProjection,
  RevenueScenario,
  SettlementRail,
  TierFeeBreakdown,
  TrustTier,
} from "./core_types";
import {
  DEFAULT_FEATURE_FLAGS,
  SettlementRail as Rail,
  TrustTier as Tier,
} from "./core_types";

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
