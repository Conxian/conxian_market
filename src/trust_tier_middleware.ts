/**
 * Conxian Market: TrustTier Pricing & Routing Middleware Pipeline.
 *
 * Implements the 4-stage pipeline specified in docs/knowledge_base/trust_tier_pricing.md:
 * 1. Tier Detector: Evaluates attestation/proof headers and degrades tier for P0 gaps.
 * 2. Fee Calculator: Calculates tier-based fee schedule and 80/10/10 yield split.
 * 3. SLA Enforcer: Selects SLA template guarantees and penalties for the detected tier.
 * 4. Rail Router: Selects optimal settlement rail and formats wire headers.
 */

import type { FeatureFlags, SettlementRail, TrustTier } from "./core_types";
import { DEFAULT_FEATURE_FLAGS, TrustTier as Tier, SettlementRail as Rail } from "./core_types";
import { calculateRailFee, FeeResult, selectRail, RailPreference } from "./fee_calculator";
import { degradeTierForP0Gaps, detectTrustTierStatic } from "./verification";

// ── Pipeline Interfaces ──

export interface TrustTierHeaders {
  "x-conxian-tee-proof"?: string;
  "x-conxian-zk-proof"?: string;
  "x-conxian-enclave-attestation"?: string;
  "x-conxian-light-proof"?: string;
}

export interface TrustTierPipelineRequest {
  headers: TrustTierHeaders;
  amountSat: bigint;
  preferredRail?: SettlementRail;
  preference?: RailPreference;
}

export interface SlaTemplate {
  tier: TrustTier;
  guarantees: {
    uptime: string;
    latencyP95: string;
    proofType: string;
    disputeResolutionWindow: string;
  };
  penalties: {
    breachRefundPct: number;
    penaltyPct: number;
    consecutiveBreachAction: string;
  };
  monitoring: {
    heartbeatIntervalSec: number;
    proofValidationFrequency: string;
  };
  autoBountyEnabled: boolean;
  supportSla: string;
}

export interface PipelineWireHeaders {
  "x-conxian-tier": string;
  "x-conxian-rail": string;
  "x-conxian-fee-bps": string;
  "x-conxian-fee-sat": string;
  "x-conxian-sla-tier": string;
  "x-conxian-p0-degraded": string;
}

export interface TrustTierPipelineResult {
  detectedTier: TrustTier;
  effectiveTier: TrustTier;
  isDegradedForP0: boolean;
  fee: FeeResult;
  slaTemplate: SlaTemplate;
  selectedRail: SettlementRail | null;
  availableRails: SettlementRail[];
  wireHeaders: PipelineWireHeaders;
}

// ── SLA Template Definitions per KB Specs ──

export const SLA_TEMPLATES: Record<TrustTier, SlaTemplate> = {
  [Tier.Strict]: {
    tier: Tier.Strict,
    guarantees: {
      uptime: "99.99%",
      latencyP95: "100ms",
      proofType: "ZK + TEE attestation",
      disputeResolutionWindow: "1 hour",
    },
    penalties: {
      breachRefundPct: 100,
      penaltyPct: 50,
      consecutiveBreachAction: "Contract termination + full refund",
    },
    monitoring: {
      heartbeatIntervalSec: 10,
      proofValidationFrequency: "every_transaction",
    },
    autoBountyEnabled: true,
    supportSla: "15 min",
  },
  [Tier.Managed]: {
    tier: Tier.Managed,
    guarantees: {
      uptime: "99.9%",
      latencyP95: "500ms",
      proofType: "Enclave attestation",
      disputeResolutionWindow: "4 hours",
    },
    penalties: {
      breachRefundPct: 100,
      penaltyPct: 0,
      consecutiveBreachAction: "Temporary suspension",
    },
    monitoring: {
      heartbeatIntervalSec: 30,
      proofValidationFrequency: "batch_5m",
    },
    autoBountyEnabled: true,
    supportSla: "1 hour",
  },
  [Tier.Expedient]: {
    tier: Tier.Expedient,
    guarantees: {
      uptime: "99%",
      latencyP95: "2s",
      proofType: "Light client verification",
      disputeResolutionWindow: "24 hours",
    },
    penalties: {
      breachRefundPct: 50,
      penaltyPct: 0,
      consecutiveBreachAction: "Tier downgrade to ObserverOnly",
    },
    monitoring: {
      heartbeatIntervalSec: 60,
      proofValidationFrequency: "batch_hourly",
    },
    autoBountyEnabled: false,
    supportSla: "24 hours",
  },
  [Tier.ObserverOnly]: {
    tier: Tier.ObserverOnly,
    guarantees: {
      uptime: "0%",
      latencyP95: "N/A",
      proofType: "None",
      disputeResolutionWindow: "None",
    },
    penalties: {
      breachRefundPct: 0,
      penaltyPct: 0,
      consecutiveBreachAction: "None",
    },
    monitoring: {
      heartbeatIntervalSec: 300,
      proofValidationFrequency: "none",
    },
    autoBountyEnabled: false,
    supportSla: "Best effort",
  },
};

// ── Rail Routing Matrix per KB Specs ──

export const RAIL_ROUTING_MATRIX: Record<TrustTier, SettlementRail[]> = {
  [Tier.Strict]: [
    Rail.Statechain,
    Rail.Sbtc,
    Rail.Rgb,
    Rail.Babylon,
    Rail.Lightning,
    Rail.Fedimint,
    Rail.AlexStacks,
    Rail.EvmErc8183,
  ],
  [Tier.Managed]: [
    Rail.Statechain,
    Rail.Sbtc,
    Rail.Rgb,
    Rail.Babylon,
    Rail.Lightning,
    Rail.Fedimint,
    Rail.AlexStacks,
    Rail.EvmErc8183,
  ],
  [Tier.Expedient]: [
    Rail.Lightning,
    Rail.Fedimint,
    Rail.AlexStacks,
    Rail.EvmErc8183,
  ],
  [Tier.ObserverOnly]: [],
};

// ── Middleware Class Implementation ──

export class TrustTierMiddleware {
  constructor(private readonly flags: FeatureFlags = DEFAULT_FEATURE_FLAGS) {}

  /**
   * Run the full 4-stage pricing and routing pipeline.
   */
  executePipeline(request: TrustTierPipelineRequest): TrustTierPipelineResult {
    // Stage 1: Tier Detection & P0 Degradation
    const detectedTier = detectTrustTierStatic(request.headers);
    const effectiveTier = degradeTierForP0Gaps(detectedTier, this.flags);
    const isDegradedForP0 = detectedTier !== effectiveTier;

    // Stage 2: Rail Routing Selection
    const availableRails = this.getAvailableRails(effectiveTier);
    let selectedRail: SettlementRail | null = null;

    if (request.preferredRail && availableRails.includes(request.preferredRail)) {
      selectedRail = request.preferredRail;
    } else {
      selectedRail = selectRail(effectiveTier, request.preference);
      if (selectedRail && !availableRails.includes(selectedRail)) {
        selectedRail = availableRails[0] ?? null;
      }
    }

    // Stage 3: Fee Calculation & 80/10/10 Yield Split
    let fee: FeeResult;
    if (effectiveTier === Tier.ObserverOnly) {
      fee = {
        tier: Tier.ObserverOnly,
        rail: Rail.Lightning,
        amountSat: request.amountSat,
        feeSat: 0n,
        feeBps: 0,
        distribution: {
          operationsSat: 0n,
          foundersSat: 0n,
          ecosystemSat: 0n,
        },
      };
    } else {
      const targetRail = selectedRail ?? Rail.Lightning;
      fee = calculateRailFee(request.amountSat, effectiveTier, targetRail);
    }

    // Stage 4: SLA Template Resolution
    const slaTemplate = SLA_TEMPLATES[effectiveTier];

    // Stage 5: Protocol Wire Headers
    const wireHeaders: PipelineWireHeaders = {
      "x-conxian-tier": effectiveTier,
      "x-conxian-rail": selectedRail ?? "NONE",
      "x-conxian-fee-bps": String(fee.feeBps),
      "x-conxian-fee-sat": fee.feeSat.toString(),
      "x-conxian-sla-tier": slaTemplate.tier,
      "x-conxian-p0-degraded": isDegradedForP0 ? "true" : "false",
    };

    return {
      detectedTier,
      effectiveTier,
      isDegradedForP0,
      fee,
      slaTemplate,
      selectedRail,
      availableRails,
      wireHeaders,
    };
  }

  /**
   * Get available settlement rails for a given tier, filtered by P0 feature flags.
   */
  getAvailableRails(tier: TrustTier): SettlementRail[] {
    const rails = RAIL_ROUTING_MATRIX[tier] ?? [];

    return rails.filter((rail) => {
      if (rail === Rail.Statechain && !this.flags.statechainAvailable) return false;
      return true;
    });
  }

  /**
   * Helper to format HTTP response headers for a pipeline result.
   */
  static formatWireHeaders(result: TrustTierPipelineResult): PipelineWireHeaders {
    return result.wireHeaders;
  }
}
