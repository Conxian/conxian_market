/**
 * Conxian Market: TrustTier Pricing, Routing & Lifecycle Middleware.
 *
 * Implements the 4-stage pipeline specified in docs/knowledge_base/trust_tier_pricing.md:
 * 1. Tier Detector: Evaluates attestation/proof headers and degrades tier for P0 gaps.
 * 2. Fee Calculator: Calculates tier-based fee schedule and 80/10/10 yield split.
 * 3. SLA Enforcer: Selects SLA template guarantees and penalties for the detected tier.
 * 4. Rail Router: Selects optimal settlement rail and formats wire headers.
 * 5. Lifecycle Engine: Evaluates tier upgrade thresholds (Reputation >= 40, 70, 90) and downgrade triggers.
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

// ── Tier Lifecycle & Upgrade/Downgrade Interfaces (KB Section 6) ──

export interface TierUpgradeRequest {
  currentTier: TrustTier;
  targetTier: TrustTier;
  reputationScore: number;
  headers?: TrustTierHeaders;
  auditPassed?: boolean;
}

export type TierTransitionStatus =
  | "APPROVED"
  | "REJECTED"
  | "INSUFFICIENT_REPUTATION"
  | "MISSING_ATTESTATION"
  | "NO_CHANGE";

export interface TierUpgradeResult {
  status: TierTransitionStatus;
  previousTier: TrustTier;
  newTier: TrustTier;
  reputationScore: number;
  requiredReputation: number;
  reason: string;
  requiredActions: string[];
}

export interface TierDowngradeRequest {
  currentTier: TrustTier;
  consecutiveBreaches: number;
  hasActiveP0Gap?: boolean;
  manualTrigger?: boolean;
}

export interface TierDowngradeResult {
  previousTier: TrustTier;
  newTier: TrustTier;
  downgraded: boolean;
  reason: string;
  recoveryRequirements: string[];
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

// ── TrustTier Lifecycle Engine Implementation (KB Section 6) ──

export class TrustTierLifecycleEngine {
  constructor(private readonly flags: FeatureFlags = DEFAULT_FEATURE_FLAGS) {}

  /**
   * Return upgrade threshold rules for target tier per KB Section 6.1.
   */
  static getUpgradeRequirements(targetTier: TrustTier): {
    minReputation: number;
    requiredProofType: string;
    costDescription: string;
  } {
    switch (targetTier) {
      case Tier.Strict:
        return {
          minReputation: 90,
          requiredProofType: "TEE + ZK Attestation + Audit",
          costDescription: "Variable Audit Fee",
        };
      case Tier.Managed:
        return {
          minReputation: 70,
          requiredProofType: "Enclave Attestation",
          costDescription: "Enclave Provisioning",
        };
      case Tier.Expedient:
        return {
          minReputation: 40,
          requiredProofType: "Basic API Key / Light Proof",
          costDescription: "Free",
        };
      case Tier.ObserverOnly:
      default:
        return {
          minReputation: 0,
          requiredProofType: "None",
          costDescription: "Free",
        };
    }
  }

  /**
   * Evaluate whether a builder/client can upgrade to a target tier.
   */
  evaluateTierUpgrade(req: TierUpgradeRequest): TierUpgradeResult {
    const tierRank: Record<TrustTier, number> = {
      [Tier.ObserverOnly]: 0,
      [Tier.Expedient]: 1,
      [Tier.Managed]: 2,
      [Tier.Strict]: 3,
    };

    if (tierRank[req.currentTier] >= tierRank[req.targetTier]) {
      return {
        status: "NO_CHANGE",
        previousTier: req.currentTier,
        newTier: req.currentTier,
        reputationScore: req.reputationScore,
        requiredReputation: TrustTierLifecycleEngine.getUpgradeRequirements(req.targetTier).minReputation,
        reason: `Current tier (${req.currentTier}) is already equal to or higher than target tier (${req.targetTier}).`,
        requiredActions: [],
      };
    }

    const reqs = TrustTierLifecycleEngine.getUpgradeRequirements(req.targetTier);

    // 1. Reputation Check
    if (req.reputationScore < reqs.minReputation) {
      return {
        status: "INSUFFICIENT_REPUTATION",
        previousTier: req.currentTier,
        newTier: req.currentTier,
        reputationScore: req.reputationScore,
        requiredReputation: reqs.minReputation,
        reason: `Reputation score (${req.reputationScore}) is below required threshold (${reqs.minReputation}) for target tier ${req.targetTier}.`,
        requiredActions: [
          `Increase reputation score to at least ${reqs.minReputation} via successful job completions and SLA gap resolutions.`,
        ],
      };
    }

    // 2. Attestation Proof Check
    const headers = req.headers ?? {};
    if (req.targetTier === Tier.Strict) {
      const hasTee = Boolean(headers["x-conxian-tee-proof"]);
      const hasZk = Boolean(headers["x-conxian-zk-proof"]);
      const auditOk = req.auditPassed ?? true;

      if (!hasTee || !hasZk || !auditOk) {
        const missing: string[] = [];
        if (!hasTee) missing.push("x-conxian-tee-proof header");
        if (!hasZk) missing.push("x-conxian-zk-proof header");
        if (!auditOk) missing.push("Third-party TEE + ZK audit");

        return {
          status: "MISSING_ATTESTATION",
          previousTier: req.currentTier,
          newTier: req.currentTier,
          reputationScore: req.reputationScore,
          requiredReputation: reqs.minReputation,
          reason: `Missing required attestation proofs for Strict tier: ${missing.join(", ")}.`,
          requiredActions: missing.map((m) => `Provide ${m}`),
        };
      }
    } else if (req.targetTier === Tier.Managed) {
      const hasEnclave = Boolean(headers["x-conxian-enclave-attestation"]);
      if (!hasEnclave) {
        return {
          status: "MISSING_ATTESTATION",
          previousTier: req.currentTier,
          newTier: req.currentTier,
          reputationScore: req.reputationScore,
          requiredReputation: reqs.minReputation,
          reason: `Missing required x-conxian-enclave-attestation header for Managed tier.`,
          requiredActions: ["Deploy enclave SDK and provide x-conxian-enclave-attestation header."],
        };
      }
    }

    // 3. P0 Enclave Gap Degradation Circuit Breaker
    if (req.targetTier === Tier.Strict || req.targetTier === Tier.Managed) {
      if (!this.flags.attestationAvailable) {
        const degradedTier = degradeTierForP0Gaps(req.targetTier, this.flags);
        return {
          status: "APPROVED",
          previousTier: req.currentTier,
          newTier: degradedTier,
          reputationScore: req.reputationScore,
          requiredReputation: reqs.minReputation,
          reason: `Upgrade approved but degraded to ${degradedTier} due to active enclave P0 attestation gaps.`,
          requiredActions: ["Resolve upstream enclave SDK P0 attestation issues (#242, #241, #240)."],
        };
      }
    }

    return {
      status: "APPROVED",
      previousTier: req.currentTier,
      newTier: req.targetTier,
      reputationScore: req.reputationScore,
      requiredReputation: reqs.minReputation,
      reason: `Successfully upgraded to ${req.targetTier}.`,
      requiredActions: [],
    };
  }

  /**
   * Evaluate whether a builder/client should be downgraded based on SLA breaches or P0 gaps.
   */
  evaluateTierDowngrade(req: TierDowngradeRequest): TierDowngradeResult {
    let newTier = req.currentTier;
    let downgraded = false;
    const reasons: string[] = [];
    const recoveryRequirements: string[] = [];

    if (req.consecutiveBreaches >= 3) {
      newTier = Tier.ObserverOnly;
      downgraded = true;
      reasons.push(`${req.consecutiveBreaches} consecutive SLA breaches triggered downgrade to ObserverOnly.`);
      recoveryRequirements.push("Resolve open gap cards and restore reputation score above 40.");
    } else if (req.consecutiveBreaches >= 2) {
      if (req.currentTier === Tier.Strict) {
        newTier = Tier.Managed;
        downgraded = true;
        reasons.push(`${req.consecutiveBreaches} consecutive SLA breaches triggered downgrade from Strict to Managed.`);
      } else if (req.currentTier === Tier.Managed) {
        newTier = Tier.Expedient;
        downgraded = true;
        reasons.push(`${req.consecutiveBreaches} consecutive SLA breaches triggered downgrade from Managed to Expedient.`);
      } else if (req.currentTier === Tier.Expedient) {
        newTier = Tier.ObserverOnly;
        downgraded = true;
        reasons.push(`${req.consecutiveBreaches} consecutive SLA breaches triggered downgrade from Expedient to ObserverOnly.`);
      }
      recoveryRequirements.push("Maintain 0 SLA breaches for at least 5 consecutive job executions.");
    }

    if (req.hasActiveP0Gap && (newTier === Tier.Strict || newTier === Tier.Managed)) {
      const beforeP0 = newTier;
      newTier = degradeTierForP0Gaps(newTier, this.flags);
      if (newTier !== beforeP0) {
        downgraded = true;
        reasons.push(`Active P0 enclave attestation gap degraded tier from ${beforeP0} to ${newTier}.`);
        recoveryRequirements.push("Resolve upstream enclave SDK attestation gaps.");
      }
    }

    return {
      previousTier: req.currentTier,
      newTier,
      downgraded,
      reason: reasons.length > 0 ? reasons.join(" ") : "No downgrade required.",
      recoveryRequirements,
    };
  }
}

// ── Middleware Class Implementation ──

export class TrustTierMiddleware {
  readonly lifecycleEngine: TrustTierLifecycleEngine;

  constructor(private readonly flags: FeatureFlags = DEFAULT_FEATURE_FLAGS) {
    this.lifecycleEngine = new TrustTierLifecycleEngine(flags);
  }

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
   * Evaluate tier upgrade request.
   */
  evaluateTierUpgrade(req: TierUpgradeRequest): TierUpgradeResult {
    return this.lifecycleEngine.evaluateTierUpgrade(req);
  }

  /**
   * Evaluate tier downgrade request.
   */
  evaluateTierDowngrade(req: TierDowngradeRequest): TierDowngradeResult {
    return this.lifecycleEngine.evaluateTierDowngrade(req);
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
