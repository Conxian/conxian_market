/**
 * CON-1427: Protocol Fee Calculator
 *
 * Implements tier detection and fee calculation as specified in
 * `docs/knowledge_base/trust_tier_pricing.md` §2-3.
 *
 * Part of the 4-component fee collection pipeline:
 *   SettlementEvent → FeeCalculator → billing.rs → Clarity contracts
 */

// ── Trust Tier (matches enclave-sdk + trust_tier_pricing.md §2) ──

export enum TrustTier {
  ObserverOnly = "OBSERVER_ONLY",
  Expedient = "EXPEDIENT",
  Managed = "MANAGED",
  Strict = "STRICT",
}

// ── Settlement Rails (matches SETTLEMENT_RAILS.md §1) ──

export enum SettlementRail {
  Statechain = "STATECHAIN",
  Sbtc = "SBTC",
  Rgb = "RGB",
  Babylon = "BABYLON",
  Fedimint = "FEDIMINT",
  Lightning = "LIGHTNING",
  AlexStacks = "ALEX_STACKS",
  EvmErc8183 = "EVM_ERC8183",
}

// ── Fee rates by rail and tier (trust_tier_pricing.md §3, SETTLEMENT_RAILS.md §9) ──

const RAIL_FEE_BPS: Record<SettlementRail, Partial<Record<TrustTier, number>>> = {
  [SettlementRail.AlexStacks]:   { [TrustTier.Expedient]: 200, [TrustTier.Managed]: 200 },
  [SettlementRail.Sbtc]:         { [TrustTier.Expedient]: 200, [TrustTier.Managed]: 250 },
  [SettlementRail.Lightning]:    { [TrustTier.Expedient]: 100, [TrustTier.Managed]: 100 },
  [SettlementRail.Fedimint]:     { [TrustTier.Expedient]: 100, [TrustTier.Managed]: 100 },
  [SettlementRail.EvmErc8183]:   { [TrustTier.Expedient]: 200, [TrustTier.Managed]: 250 },
  [SettlementRail.Statechain]:   { [TrustTier.Managed]: 200 },
  [SettlementRail.Rgb]:          { [TrustTier.Managed]: 200 },
  [SettlementRail.Babylon]:      { [TrustTier.Managed]: 50 },     // yield share, not settlement fee
};

const RAILS_BY_TIER: Record<TrustTier, SettlementRail[]> = {
  [TrustTier.ObserverOnly]: [],
  [TrustTier.Expedient]: [
    SettlementRail.Lightning, SettlementRail.Fedimint,
    SettlementRail.AlexStacks, SettlementRail.EvmErc8183,
  ],
  [TrustTier.Managed]: [
    SettlementRail.Statechain, SettlementRail.Sbtc,
    SettlementRail.Rgb, SettlementRail.Babylon,
    SettlementRail.Lightning, SettlementRail.Fedimint,
    SettlementRail.AlexStacks, SettlementRail.EvmErc8183,
  ],
  [TrustTier.Strict]: [
    SettlementRail.Statechain, SettlementRail.Sbtc,
    SettlementRail.Rgb, SettlementRail.Babylon,
    SettlementRail.Lightning, SettlementRail.Fedimint,
    SettlementRail.AlexStacks, SettlementRail.EvmErc8183,
  ],
};

// ── Tier Detection (trust_tier_pricing.md §2) ──

export interface AttestationHeaders {
  "x-conxian-tee-proof"?: string;
  "x-conxian-zk-proof"?: string;
  "x-conxian-enclave-attestation"?: string;
  "x-conxian-light-proof"?: string;
}

export async function detectTrustTier(
  headers: AttestationHeaders,
  verifyTeeZk: (tee: string, zk: string) => Promise<boolean> = async () => false,
  verifyEnclave: (proof: string) => Promise<boolean> = async () => false,
  verifyLight: (proof: string) => Promise<boolean> = async () => false,
): Promise<TrustTier> {
  // Strict: TEE proof + ZK proof, both verified
  if (headers["x-conxian-tee-proof"] && headers["x-conxian-zk-proof"]) {
    if (await verifyTeeZk(headers["x-conxian-tee-proof"], headers["x-conxian-zk-proof"])) {
      return TrustTier.Strict;
    }
  }

  // Managed: enclave attestation verified
  if (headers["x-conxian-enclave-attestation"]) {
    if (await verifyEnclave(headers["x-conxian-enclave-attestation"])) {
      return TrustTier.Managed;
    }
  }

  // Expedient: light client proof verified
  if (headers["x-conxian-light-proof"]) {
    if (await verifyLight(headers["x-conxian-light-proof"])) {
      return TrustTier.Expedient;
    }
  }

  return TrustTier.ObserverOnly;
}

// ── Fee Calculation (trust_tier_pricing.md §3) ──

export interface FeeResult {
  amountSat: bigint;
  feeBps: number;
  feeSat: bigint;
  tier: TrustTier;
  rail: SettlementRail;
  effectiveRate: number; // as decimal, e.g. 0.02 for 2%
}

/**
 * Calculate protocol fee for a settlement on a specific rail at a specific tier.
 *
 * Formula: fee = amount * feeBps / 10000
 *
 * Strict tier returns 0 fee (negotiated separately).
 * ObserverOnly tier returns 0 fee and will reject settlement at gateway level.
 */
export function calculateRailFee(
  amountSat: bigint,
  tier: TrustTier,
  rail: SettlementRail,
): FeeResult {
  // Strict: negotiated separately, not computed here
  if (tier === TrustTier.Strict) {
    return {
      amountSat,
      feeBps: 0,
      feeSat: 0n,
      tier,
      rail,
      effectiveRate: 0,
    };
  }

  // ObserverOnly: no settlement allowed
  if (tier === TrustTier.ObserverOnly) {
    return {
      amountSat,
      feeBps: 0,
      feeSat: 0n,
      tier,
      rail,
      effectiveRate: 0,
    };
  }

  const railRates = RAIL_FEE_BPS[rail];
  const feeBps = railRates[tier];

  if (feeBps === undefined) {
    // Rail not available at this tier (e.g., Statechain at Expedient)
    throw new Error(
      `Rail ${rail} not available at tier ${tier}. ` +
      `Available rails: ${RAILS_BY_TIER[tier].join(", ")}`
    );
  }

  const feeSat = (amountSat * BigInt(feeBps)) / 10000n;

  return {
    amountSat,
    feeBps,
    feeSat,
    tier,
    rail,
    effectiveRate: feeBps / 10000,
  };
}

// ── Rail Routing (trust_tier_pricing.md §4) ──

export type RailPreference = "cost" | "speed" | "privacy";

const RAIL_COST_RANK: SettlementRail[] = [
  SettlementRail.Lightning, SettlementRail.Fedimint,
  SettlementRail.AlexStacks, SettlementRail.Sbtc,
  SettlementRail.EvmErc8183, SettlementRail.Statechain,
  SettlementRail.Rgb,
];

const RAIL_SPEED_RANK: SettlementRail[] = [
  SettlementRail.Lightning, SettlementRail.Fedimint,
  SettlementRail.Statechain, SettlementRail.Sbtc,
  SettlementRail.AlexStacks, SettlementRail.EvmErc8183,
  SettlementRail.Rgb,
];

const RAIL_PRIVACY_RANK: SettlementRail[] = [
  SettlementRail.Fedimint, SettlementRail.Statechain,
  SettlementRail.Lightning, SettlementRail.Rgb,
  SettlementRail.Sbtc, SettlementRail.AlexStacks,
  SettlementRail.EvmErc8183,
];

export function selectRail(
  tier: TrustTier,
  preference: RailPreference = "cost",
): SettlementRail | null {
  const available = RAILS_BY_TIER[tier];
  if (available.length === 0) return null;

  const rank = preference === "speed" ? RAIL_SPEED_RANK
    : preference === "privacy" ? RAIL_PRIVACY_RANK
    : RAIL_COST_RANK;

  return rank.find((r) => available.includes(r)) ?? available[0];
}

// ── Fee Report Generation (for billing.rs ProtocolFeeReport) ──

export interface SettlementEvent {
  id: string;
  rail: SettlementRail;
  amountSat: bigint;
  tier: TrustTier;
  builderId: string;
  timestamp: number; // unix seconds
  txId?: string;
}

export interface RailFeeBreakdown {
  rail: SettlementRail;
  count: number;
  totalAmountSat: bigint;
  totalFeeSat: bigint;
  avgFeeBps: number;
}

export interface TierFeeBreakdown {
  tier: TrustTier;
  count: number;
  totalFeeSat: bigint;
}

export interface FeeReport {
  periodStart: number;
  periodEnd: number;
  totalSettled: bigint;
  totalFeesSat: bigint;
  effectiveFeePercent: number;
  byRail: RailFeeBreakdown[];
  byTier: TierFeeBreakdown[];
  events: SettlementEvent[];
}

export function generateFeeReport(
  events: SettlementEvent[],
  periodStart: number,
  periodEnd: number,
): FeeReport {
  const byRail = new Map<SettlementRail, RailFeeBreakdown>();
  const byTier = new Map<TrustTier, TierFeeBreakdown>();
  let totalSettled = 0n;
  let totalFeesSat = 0n;

  for (const event of events) {
    if (event.timestamp < periodStart || event.timestamp > periodEnd) continue;

    const fee = calculateRailFee(event.amountSat, event.tier, event.rail);
    totalSettled += event.amountSat;
    totalFeesSat += fee.feeSat;

    // By rail
    const railBreakdown = byRail.get(event.rail) ?? {
      rail: event.rail, count: 0, totalAmountSat: 0n, totalFeeSat: 0n, avgFeeBps: 0,
    };
    railBreakdown.count++;
    railBreakdown.totalAmountSat += event.amountSat;
    railBreakdown.totalFeeSat += fee.feeSat;
    railBreakdown.avgFeeBps = Number(
      (railBreakdown.totalFeeSat * 10000n) / (railBreakdown.totalAmountSat || 1n)
    );
    byRail.set(event.rail, railBreakdown);

    // By tier
    const tierBreakdown = byTier.get(event.tier) ?? {
      tier: event.tier, count: 0, totalFeeSat: 0n,
    };
    tierBreakdown.count++;
    tierBreakdown.totalFeeSat += fee.feeSat;
    byTier.set(event.tier, tierBreakdown);
  }

  return {
    periodStart,
    periodEnd,
    totalSettled,
    totalFeesSat,
    effectiveFeePercent: totalSettled > 0n
      ? Number((totalFeesSat * 10000n) / totalSettled) / 100
      : 0,
    byRail: [...byRail.values()],
    byTier: [...byTier.values()],
    events,
  };
}

// ── Gateway wire format ──

export interface ProtocolFeeHeader {
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

export interface RevenueScenario {
  name: string;
  monthlyVolumeUsd: number;
  btcPriceUsd: number; // BTC price for sat conversion
}

export interface RevenueProjection {
  scenario: string;
  byStream: {
    protocolFee: number;
    premiumSurcharge: number;
    institutional: number;
    communityPools: number;
    stakingYield: number;
  };
  totalMonthlyUsd: number;
  pctOfTarget: number; // vs $21,100 target
}

const TARGET_MONTHLY_USD = 21_100;

export function projectRevenue(scenario: RevenueScenario): RevenueProjection {
  const v = scenario.monthlyVolumeUsd;
  const satsPerUsd = 100_000_000 / scenario.btcPriceUsd;

  return {
    scenario: scenario.name,
    byStream: {
      protocolFee: Math.round(v * 0.02 * 0.50),           // 2% protocol × 50% volume share
      premiumSurcharge: Math.round(v * 0.005 * 0.15),      // 0.5% premium × 15% share
      institutional: 0,                                     // negotiated
      communityPools: Math.round(v * 0.01 * 0.05),         // 1% Fedimint × 5% share
      stakingYield: Math.round(scenario.btcPriceUsd * satsPerUsd * 0.04 * 0.05 / 12), // 4% APY on 5 BTC
    },
    totalMonthlyUsd: Math.round(
      v * 0.02 * 0.50 + v * 0.005 * 0.15 + v * 0.01 * 0.05
    ),
    pctOfTarget: Math.round(
      ((v * 0.02 * 0.50 + v * 0.005 * 0.15 + v * 0.01 * 0.05) / TARGET_MONTHLY_USD) * 100
    ),
  };
}
