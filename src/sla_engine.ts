/**
 * Conxian Market: Autonomous SLA Bounty & Gap Card Engine.
 *
 * Implements the SLA enforcement and CJCS gap card generation specifications
 * from `docs/knowledge_base/sla_bounty_system.md`.
 *
 * Key Capabilities:
 *   - SLA Rule Evaluation (`SLA-001` through `SLA-007`)
 *   - CJCS Gap Card Generation with Urgency-based Pricing & Floors
 *   - TrustTier Gating & Auto-Execution Matrix
 *   - Builder Reputation Tracking & TrustTier Mapping
 *   - Autonomous SLA Gap Card Auto-Resolution & Reputation Recovery
 */

import type { JobCard, TrustTier } from "./core_types";
import { TrustTier as Tier } from "./core_types";

// ── Types ──

export type SlaRuleId =
  | "SLA-001"
  | "SLA-002"
  | "SLA-003"
  | "SLA-004"
  | "SLA-005"
  | "SLA-006"
  | "SLA-007";

export type SlaConditionKind =
  | "deadline_exceeded"
  | "builder_unresponsive"
  | "trust_tier_mismatch"
  | "fee_shortfall"
  | "quality_dispute";

export type SlaCondition =
  | { kind: "deadline_exceeded"; gracePeriodSeconds: number }
  | { kind: "builder_unresponsive"; maxIdleSeconds: number }
  | { kind: "trust_tier_mismatch"; required: TrustTier; actual: TrustTier }
  | { kind: "fee_shortfall"; minCollectedBps: number }
  | { kind: "quality_dispute"; minDisputeCount: number };

export type SlaActionKind =
  | "generate_gap_card"
  | "reopen_job_card"
  | "flag_builder"
  | "reject_settlement"
  | "notify_treasury";

export type SlaAction =
  | { kind: "generate_gap_card"; urgency: UrgencyTier }
  | { kind: "reopen_job_card"; escalatePriority?: boolean }
  | { kind: "flag_builder"; severity: "warn" | "suspend" | "ban" }
  | { kind: "reject_settlement"; reason: string }
  | { kind: "notify_treasury"; reason: string };

export interface SlaRule {
  id: SlaRuleId;
  condition: SlaCondition;
  action: SlaAction;
  trustTierGate: TrustTier; // Minimum tier for auto-execution
}

export type UrgencyTier = "low" | "medium" | "high" | "critical";

export interface UrgencyPricing {
  multiplier: number;
  floorSats: bigint;
  maxHours: number;
}

export const URGENCY_PRICING_TABLE: Record<UrgencyTier, UrgencyPricing> = {
  low: { multiplier: 1.0, floorSats: 10_000n, maxHours: 24 },
  medium: { multiplier: 1.1, floorSats: 25_000n, maxHours: 8 },
  high: { multiplier: 1.2, floorSats: 50_000n, maxHours: 4 },
  critical: { multiplier: 1.5, floorSats: 100_000n, maxHours: 2 },
};

export interface GapCard {
  id: string;
  context: "sla_remediation";
  type: "gap_card";
  parentJobId: string;
  description: string;
  deadlineIso: string;
  budgetSats: bigint;
  urgency: UrgencyTier;
  labels: string[];
  trustTier: TrustTier;
  state: "auto_published" | "pending_approval" | "resolved";
  createdAtIso: string;
  resolvedAtIso?: string;
  resolvingBuilderId?: string;
}

export interface SlaEvaluationResult {
  jobCardId: string;
  rulesEvaluated: SlaRuleId[];
  triggeredRules: SlaRuleId[];
  actions: SlaAction[];
  generatedGapCards: GapCard[];
  reopenJobCard: boolean;
  builderFlagged?: "warn" | "suspend" | "ban";
  settlementRejected?: string;
  treasuryNotified?: string;
}

export interface BuilderReputationRecord {
  builderId: string;
  score: number; // 0..100 (can go negative under severe breach)
  slaBreachCount: number;
  abandonmentCount: number;
  gapCardsResolved: number;
  qualityDisputeCount: number;
  consecutiveCompletions: number;
  eligibleTier: TrustTier;
  status: "active" | "suspended";
}

export interface GapCardAutoResolutionInput {
  gapCard: GapCard;
  resolvingBuilderId: string;
  proofHash: string;
  currentReputation?: BuilderReputationRecord;
  currentTimeIso?: string;
}

export interface GapCardAutoResolutionResult {
  gapCardId: string;
  status: "resolved";
  resolvedAtIso: string;
  resolvingBuilderId: string;
  payoutSats: bigint;
  updatedReputation?: BuilderReputationRecord;
  reputationDelta: number;
}

// ── Default Ruleset ──

export const DEFAULT_SLA_RULESET: SlaRule[] = [
  {
    id: "SLA-001",
    condition: { kind: "deadline_exceeded", gracePeriodSeconds: 3600 }, // 1h grace
    action: { kind: "generate_gap_card", urgency: "high" },
    trustTierGate: Tier.Managed,
  },
  {
    id: "SLA-002",
    condition: { kind: "deadline_exceeded", gracePeriodSeconds: 14400 }, // 4h grace
    action: { kind: "reopen_job_card", escalatePriority: true },
    trustTierGate: Tier.Expedient,
  },
  {
    id: "SLA-003",
    condition: { kind: "builder_unresponsive", maxIdleSeconds: 172800 }, // 48h
    action: { kind: "flag_builder", severity: "warn" },
    trustTierGate: Tier.Managed,
  },
  {
    id: "SLA-004",
    condition: { kind: "builder_unresponsive", maxIdleSeconds: 259200 }, // 72h
    action: { kind: "flag_builder", severity: "suspend" },
    trustTierGate: Tier.Expedient,
  },
  {
    id: "SLA-005",
    condition: { kind: "trust_tier_mismatch", required: Tier.Managed, actual: Tier.Expedient },
    action: { kind: "reject_settlement", reason: "TrustTier mismatch between job card and attestation" },
    trustTierGate: Tier.ObserverOnly,
  },
  {
    id: "SLA-006",
    condition: { kind: "fee_shortfall", minCollectedBps: 190 }, // Expected 200 bps (2%)
    action: { kind: "notify_treasury", reason: "Protocol fee collected below 95% threshold" },
    trustTierGate: Tier.ObserverOnly,
  },
  {
    id: "SLA-007",
    condition: { kind: "quality_dispute", minDisputeCount: 3 },
    action: { kind: "flag_builder", severity: "suspend" },
    trustTierGate: Tier.Managed,
  },
];

// ── SLA Engine ──

export class SlaEngine {
  private readonly rules: SlaRule[];

  constructor(customRules?: SlaRule[]) {
    this.rules = customRules ?? DEFAULT_SLA_RULESET;
  }

  /**
   * Evaluate SLA status for a given JobCard against time, idle state, and quality metrics.
   */
  evaluateJobCard(
    jobCard: JobCard,
    currentTimeIso: string,
    options: {
      lastActivityTimeIso?: string;
      actualTrustTier?: TrustTier;
      collectedFeeBps?: number;
      disputeCount?: number;
    } = {}
  ): SlaEvaluationResult {
    const nowMs = new Date(currentTimeIso).getTime();

    // Parse deadline: numeric (unix timestamp in sec/ms) or ISO string
    let deadlineMs = nowMs;
    if (typeof jobCard.deadline === "number") {
      deadlineMs = jobCard.deadline > 1e11 ? jobCard.deadline : jobCard.deadline * 1000;
    } else if (typeof jobCard.deadline === "string") {
      deadlineMs = new Date(jobCard.deadline).getTime();
    }

    const lastActivityMs = options.lastActivityTimeIso
      ? new Date(options.lastActivityTimeIso).getTime()
      : nowMs;

    const triggeredRules: SlaRuleId[] = [];
    const actions: SlaAction[] = [];
    const gapCards: GapCard[] = [];

    let reopenJobCard = false;
    let builderFlagged: "warn" | "suspend" | "ban" | undefined;
    let settlementRejected: string | undefined;
    let treasuryNotified: string | undefined;

    for (const rule of this.rules) {
      let isTriggered = false;

      switch (rule.condition.kind) {
        case "deadline_exceeded": {
          if (jobCard.status !== ("COMPLETED" as any) && jobCard.status !== ("CANCELLED" as any)) {
            const elapsedAfterDeadlineSeconds = Math.floor((nowMs - deadlineMs) / 1000);
            if (elapsedAfterDeadlineSeconds >= rule.condition.gracePeriodSeconds) {
              isTriggered = true;
            }
          }
          break;
        }
        case "builder_unresponsive": {
          if (jobCard.status === ("IN_PROGRESS" as any)) {
            const idleSeconds = Math.floor((nowMs - lastActivityMs) / 1000);
            if (idleSeconds >= rule.condition.maxIdleSeconds) {
              isTriggered = true;
            }
          }
          break;
        }
        case "trust_tier_mismatch": {
          if (options.actualTrustTier && options.actualTrustTier !== jobCard.tier) {
            isTriggered = true;
          }
          break;
        }
        case "fee_shortfall": {
          if (options.collectedFeeBps !== undefined && options.collectedFeeBps < rule.condition.minCollectedBps) {
            isTriggered = true;
          }
          break;
        }
        case "quality_dispute": {
          if (options.disputeCount !== undefined && options.disputeCount >= rule.condition.minDisputeCount) {
            isTriggered = true;
          }
          break;
        }
      }

      if (isTriggered) {
        triggeredRules.push(rule.id);
        actions.push(rule.action);

        // Process action side-effects
        switch (rule.action.kind) {
          case "generate_gap_card": {
            const gapCard = this.generateGapCard(
              jobCard,
              rule.action.urgency,
              jobCard.tier,
              currentTimeIso
            );
            gapCards.push(gapCard);
            break;
          }
          case "reopen_job_card": {
            reopenJobCard = true;
            break;
          }
          case "flag_builder": {
            builderFlagged = rule.action.severity;
            break;
          }
          case "reject_settlement": {
            settlementRejected = rule.action.reason;
            break;
          }
          case "notify_treasury": {
            treasuryNotified = rule.action.reason;
            break;
          }
        }
      }
    }

    return {
      jobCardId: jobCard.id,
      rulesEvaluated: this.rules.map((r) => r.id),
      triggeredRules,
      actions,
      generatedGapCards: gapCards,
      reopenJobCard,
      builderFlagged,
      settlementRejected,
      treasuryNotified,
    };
  }

  /**
   * Generate a CJCS Gap Card from a parent JobCard with urgency-based budget calculation.
   */
  generateGapCard(
    parentJob: JobCard,
    urgency: UrgencyTier,
    tier: TrustTier,
    currentTimeIso: string
  ): GapCard {
    const pricing = URGENCY_PRICING_TABLE[urgency];
    const nowMs = new Date(currentTimeIso).getTime();
    const newDeadlineMs = nowMs + pricing.maxHours * 3600 * 1000;

    const baseSat = parentJob.bountySat ?? (parentJob as any).budgetSats ?? 0n;

    // Budget = max(original * multiplier, floor)
    const rawBudget = BigInt(Math.floor(Number(baseSat) * pricing.multiplier));
    const budgetSats = rawBudget > pricing.floorSats ? rawBudget : pricing.floorSats;

    // Auto-execution gate: Managed & Strict are auto-published; Expedient & ObserverOnly require manual approval.
    const isAutoPublished = tier === Tier.Managed || tier === Tier.Strict;

    return {
      id: `GC-${parentJob.id.replace(/^JC-/, "")}`,
      context: "sla_remediation",
      type: "gap_card",
      parentJobId: parentJob.id,
      description: `Complete ${parentJob.title} (SLA breach remediation)`,
      deadlineIso: new Date(newDeadlineMs).toISOString(),
      budgetSats,
      urgency,
      labels: ["gap", "sla-breach", `urgency-${urgency}`],
      trustTier: tier,
      state: isAutoPublished ? "auto_published" : "pending_approval",
      createdAtIso: currentTimeIso,
    };
  }

  /**
   * Auto-resolves a gap card upon verified completion, updating state, payout, and builder reputation.
   */
  autoResolveGapCard(input: GapCardAutoResolutionInput): GapCardAutoResolutionResult {
    if (!input.proofHash || input.proofHash.trim() === "") {
      throw new Error("Cannot auto-resolve gap card without a valid proofHash");
    }

    const resolvedAtIso = input.currentTimeIso ?? new Date().toISOString();

    let updatedReputation: BuilderReputationRecord | undefined;
    let reputationDelta = 0;

    if (input.currentReputation) {
      const initialScore = input.currentReputation.score;
      updatedReputation = SlaEngine.updateBuilderReputation(
        input.currentReputation,
        "gap_resolved"
      );
      reputationDelta = updatedReputation.score - initialScore;
    }

    // Mutate gapCard state
    input.gapCard.state = "resolved";
    input.gapCard.resolvedAtIso = resolvedAtIso;
    input.gapCard.resolvingBuilderId = input.resolvingBuilderId;

    return {
      gapCardId: input.gapCard.id,
      status: "resolved",
      resolvedAtIso,
      resolvingBuilderId: input.resolvingBuilderId,
      payoutSats: input.gapCard.budgetSats,
      updatedReputation,
      reputationDelta,
    };
  }

  /**
   * Evaluates builder reputation recovery trajectory after resolving gap cards or consecutive jobs.
   */
  evaluateReputationRecovery(
    builder: BuilderReputationRecord,
    consecutiveCompletionsToAdd = 1
  ): BuilderReputationRecord {
    let updated = { ...builder };
    for (let i = 0; i < consecutiveCompletionsToAdd; i++) {
      updated = SlaEngine.updateBuilderReputation(updated, "job_completed");
    }
    return updated;
  }

  /**
   * Calculate updated builder reputation score and eligible TrustTier.
   */
  static updateBuilderReputation(
    current: BuilderReputationRecord,
    event:
      | "sla_breach"
      | "abandonment"
      | "gap_resolved"
      | "quality_dispute"
      | "job_completed"
  ): BuilderReputationRecord {
    let score = current.score;
    let breachCount = current.slaBreachCount;
    let abandonmentCount = current.abandonmentCount;
    let gapCardsResolved = current.gapCardsResolved;
    let disputeCount = current.qualityDisputeCount;
    let streak = current.consecutiveCompletions;

    switch (event) {
      case "sla_breach":
        score -= 10;
        breachCount += 1;
        streak = 0;
        break;
      case "abandonment":
        score -= 25;
        abandonmentCount += 1;
        streak = 0;
        break;
      case "gap_resolved":
        score += 5;
        gapCardsResolved += 1;
        streak += 1;
        break;
      case "quality_dispute":
        score -= 15;
        disputeCount += 1;
        streak = 0;
        break;
      case "job_completed":
        streak += 1;
        if (streak >= 5) {
          score += 2;
        }
        break;
    }

    // Clamp score 0..100
    score = Math.max(0, Math.min(100, score));

    // Map score to eligible TrustTier
    let eligibleTier: TrustTier = Tier.ObserverOnly;
    let status: "active" | "suspended" = "active";

    if (score >= 90) {
      eligibleTier = Tier.Strict;
    } else if (score >= 70) {
      eligibleTier = Tier.Managed;
    } else if (score >= 40) {
      eligibleTier = Tier.Expedient;
    } else {
      eligibleTier = Tier.ObserverOnly;
      if (score < 20) {
        status = "suspended";
      }
    }

    return {
      builderId: current.builderId,
      score,
      slaBreachCount: breachCount,
      abandonmentCount,
      gapCardsResolved,
      qualityDisputeCount: disputeCount,
      consecutiveCompletions: streak,
      eligibleTier,
      status,
    };
  }
}
