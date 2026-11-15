// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Conxian Labs (Pty) Ltd
//
// Part of the @conxian/market-sdk revenue moat. This file is licensed
// AGPL-3.0-or-later, NOT MIT: see LICENSING.md. Running a modified version
// of this file as a network service obliges you to offer the corresponding
// source to your users (AGPL-3.0 section 13), or to obtain a commercial
// licence from Conxian Labs.
/**
 * Conxian Market: Business Operating System (BOS) Yield Splitter & Thin Orchestrator Guard.
 *
 * Implements the commercial packaging and economic rules specified in docs/knowledge_base/operating_manual.md:
 * 1. Two-product rate model (ADR-007): the platform take is 10% of gross on a
 *    matched job (builder keeps 90%); the rail product uses the ADR-005 dynamic
 *    fee. The take is then split 50/30/20 (one split rule).
 * 2. Protocol fee: the ONLY fee rate model is the dynamic hybrid model in
 *    `fee_calculator.ts` (ADR-004/ADR-005) — a single volume-decay percentage
 *    (0.50%/0.25%/0.15%/0.10%) composed with a per-rail flat floor, distributed
 *    50% Ops / 30% Founders / 20% Ecosystem. The former static 2.0/1.5/1.0%
 *    decay here was a second, conflicting regime and has been removed (ADR-005).
 * 3. Founder Compensation & Vesting: 4-year vesting with cliff, 50/50 base/bonus cap, 6-month emergency escrow limit.
 * 4. Sovereign OS Thin Orchestrator & BYOK Guard: Prohibits centralized AI inference and mandates enclave key security.
 * 5. Treasury Multi-Sig Governance Timelock & Founder Compensation Escrow Controller (Session 60):
 *    - Enforces 48-hour timelock delay for treasury transfers > $50,000 (100,000,000 satoshis).
 *    - Enforces 3-of-5 multisig quorum verification.
 *    - Manages founder compensation escrow payouts with DAO bonus validation.
 * 6. Real-Time Yield Split Validation (Session 75): Validates take splits against live multi-cloud telemetry.
 */

import type {
  FounderEscrowPayoutResult,
  FounderEscrowSchedule,
  MultiCloudTelemetryScorecard,
  TimelockTransactionRequest,
  TimelockValidationResult,
} from "./core_types.js";
import { type FeeProduct, computeProductTake } from "./fee_product.js";

export interface YieldSplit {
  grossAmountSat: bigint;
  product: FeeProduct;
  /** Builder share: `gross − take` (90% on a matched job). */
  builderSat: bigint;
  /** The platform's take (10% of gross on a matched job; the dynamic fee on a rail). */
  takeSat: bigint;
  /** Single split rule (50/30/20) applied to the take. */
  operationsSat: bigint;
  foundersSat: bigint;
  ecosystemSat: bigint;
}

export interface RealtimeYieldSplitValidation {
  yieldSplit: YieldSplit;
  telemetryStatus: "GREEN" | "YELLOW" | "RED";
  authorized: boolean;
  warnings: string[];
}

/**
 * 50/30/20 split of a protocol fee that was already computed by the canonical
 * dynamic fee model (`fee_calculator.ts`). This type carries no rate: the rate
 * lives only in `VOLUME_DECAY_BPS` + the per-rail floor.
 */
export interface ProtocolFeeDistribution {
  feeSat: bigint;
  operationsTreasurySat: bigint; // 50%
  founderCompensationSat: bigint; // 30%
  ecosystemGrowthSat: bigint;    // 20%
}

export interface FounderVestingInput {
  monthsElapsed: number;
  totalAllocatedSat: bigint;
  monthlyBaseCapSat: bigint;
  daoBonusSat: bigint;
  escrowSat: bigint;
}

export interface FounderVestingResult {
  isVested: boolean;              // False if before 12-month cliff
  vestedRatio: number;            // 0.0 to 1.0 based on 48 months
  vestedAmountSat: bigint;
  authorizedMonthlyBaseSat: bigint;
  authorizedBonusSat: bigint;     // Capped at 50% of total comp
  emergencyLimitSat: bigint;      // Max 6-month base compensation
  isEscrowWithinLimit: boolean;
  violations: string[];
}

export interface InferencePolicyInput {
  isCentralizedInference: boolean;
  handlesPrivateKeys: boolean;
  usesMcpHandoff: boolean;
  usesEnclaveSdk: boolean;
}

export interface InferencePolicyResult {
  compliant: boolean;
  isThinOrchestrator: boolean;
  isByokSecured: boolean;
  violations: string[];
}

export class BosYieldSplitter {
  /**
   * Calculate the take split for a settlement under the two-product model
   * (ADR-007). Matched jobs take 10% of gross (builder keeps 90%); rails use the
   * ADR-005 dynamic fee. The take is split 50/30/20. Classification is
   * fail-closed to the matched-job rate when it cannot be determined.
   */
  static calculateYieldSplit(
    grossAmountSat: bigint,
    options: {
      product?: FeeProduct;
      signals?: import("./fee_product.js").ProductSignals;
      tier?: import("./core_types.js").TrustTier;
      rail?: import("./core_types.js").SettlementRail;
      volumeDecayTier?: import("./core_types.js").VolumeDecayTier;
      systemLoadFactor?: number;
      matchedJobTakeBps?: number;
    } = {},
  ): YieldSplit {
    const take = computeProductTake({
      product: options.product,
      signals: options.signals,
      grossAmountSat,
      tier: options.tier,
      rail: options.rail,
      volumeDecayTier: options.volumeDecayTier,
      systemLoadFactor: options.systemLoadFactor,
      matchedJobTakeBps: options.matchedJobTakeBps,
    });

    return {
      grossAmountSat: take.grossAmountSat,
      product: take.product,
      builderSat: take.builderSat,
      takeSat: take.takeSat,
      operationsSat: take.operationsSat,
      foundersSat: take.foundersSat,
      ecosystemSat: take.ecosystemSat,
    };
  }

  /**
   * Validate a take split in real-time backed by a multi-cloud telemetry scorecard.
   */
  static validateYieldSplitRealtime(input: {
    grossAmountSat: bigint;
    telemetry: MultiCloudTelemetryScorecard;
    evaluatedAtIso?: string;
    product?: FeeProduct;
    signals?: import("./fee_product.js").ProductSignals;
    tier?: import("./core_types.js").TrustTier;
    rail?: import("./core_types.js").SettlementRail;
    volumeDecayTier?: import("./core_types.js").VolumeDecayTier;
    systemLoadFactor?: number;
  }): RealtimeYieldSplitValidation {
    const yieldSplit = BosYieldSplitter.calculateYieldSplit(input.grossAmountSat, {
      product: input.product,
      signals: input.signals,
      tier: input.tier,
      rail: input.rail,
      volumeDecayTier: input.volumeDecayTier,
      systemLoadFactor: input.systemLoadFactor,
    });
    const warnings: string[] = [...input.telemetry.alerts];
    const evaluatedAtMs = Date.parse(input.evaluatedAtIso ?? new Date().toISOString());
    const capturedAtMs = Date.parse(input.telemetry.capturedAtIso);
    const maxTelemetryAgeMs = 5 * 60 * 1000;
    const maxFutureSkewMs = 30 * 1000;
    let telemetryIsFresh = Number.isFinite(evaluatedAtMs) && Number.isFinite(capturedAtMs);

    if (!telemetryIsFresh) {
      warnings.push("Yield split settlement paused: telemetry timestamps are missing or invalid");
    } else if (capturedAtMs > evaluatedAtMs + maxFutureSkewMs) {
      telemetryIsFresh = false;
      warnings.push("Yield split settlement paused: telemetry capture time is in the future");
    } else if (evaluatedAtMs - capturedAtMs > maxTelemetryAgeMs) {
      telemetryIsFresh = false;
      warnings.push("Yield split settlement paused: telemetry is older than the five-minute freshness window");
    }

    const authorized = telemetryIsFresh && input.telemetry.overallStatus !== "RED";

    if (input.telemetry.overallStatus === "RED") {
      warnings.push("Yield split settlement paused due to CRITICAL multi-cloud telemetry alert");
    }

    return {
      yieldSplit,
      telemetryStatus: input.telemetry.overallStatus,
      authorized,
      warnings,
    };
  }

  /**
   * Evaluate founder compensation vesting and emergency escrow compliance.
   */
  static evaluateFounderVesting(input: FounderVestingInput): FounderVestingResult {
    const violations: string[] = [];

    // 4-year vesting schedule = 48 months
    const isVested = input.monthsElapsed >= 12; // 1-year cliff
    const vestedRatio = isVested ? Math.min(1.0, input.monthsElapsed / 48) : 0.0;
    const vestedAmountSat = BigInt(Math.floor(Number(input.totalAllocatedSat) * vestedRatio));

    const authorizedMonthlyBaseSat = isVested ? input.monthlyBaseCapSat : 0n;

    // Performance Cap: Base 50%, DAO bonus cap at 50% of total compensation (bonus cannot exceed base)
    let authorizedBonusSat = input.daoBonusSat;
    if (authorizedBonusSat > authorizedMonthlyBaseSat) {
      authorizedBonusSat = authorizedMonthlyBaseSat;
      violations.push("DAO bonus capped at 50% of total monthly compensation");
    }

    // Emergency limit: Maximum 6 months base compensation in escrow
    const emergencyLimitSat = authorizedMonthlyBaseSat * 6n;
    const isEscrowWithinLimit = input.escrowSat <= emergencyLimitSat;
    if (!isEscrowWithinLimit) {
      violations.push("Escrow balance exceeds maximum 6-month compensation limit");
    }

    if (!isVested) {
      violations.push("Founder compensation locked before 12-month vesting cliff");
    }

    return {
      isVested,
      vestedRatio,
      vestedAmountSat,
      authorizedMonthlyBaseSat,
      authorizedBonusSat,
      emergencyLimitSat,
      isEscrowWithinLimit,
      violations,
    };
  }

  /**
   * Enforce Sovereign OS Thin Orchestrator & BYOK security requirements.
   */
  static verifyInferencePolicy(input: InferencePolicyInput): InferencePolicyResult {
    const violations: string[] = [];

    // Rule 1: Thin Orchestrator Pattern — Never perform heavy AI inference on centralized infrastructure
    const isThinOrchestrator = !input.isCentralizedInference && input.usesMcpHandoff;
    if (input.isCentralizedInference) {
      violations.push("Centralized heavy AI inference prohibited; must run at edge or via user keys");
    }
    if (!input.usesMcpHandoff) {
      violations.push("Agent handoffs must use Model Context Protocol (MCP)");
    }

    // Rule 2: BYOK Security — Sensitive key handling requires conxius-enclave-sdk
    const isByokSecured = !input.handlesPrivateKeys || input.usesEnclaveSdk;
    if (input.handlesPrivateKeys && !input.usesEnclaveSdk) {
      violations.push("Sensitive key handling requires conxius-enclave-sdk integration");
    }

    const compliant = isThinOrchestrator && isByokSecured && violations.length === 0;

    return {
      compliant,
      isThinOrchestrator,
      isByokSecured,
      violations,
    };
  }

  /**
   * Validates Treasury Multi-Sig 48-Hour Timelock & Signature Quorum.
   * Specification: docs/knowledge_base/operating_manual.md Section 3.C
   * Rule: Transfers > 100,000,000 sats ($50K equivalent) require a 48-hour delay and >= 3-of-5 signatures.
   */
  static validateTimelockAndMultisig(
    req: TimelockTransactionRequest,
    options: {
      highValueThresholdSats?: bigint;
      requiredQuorum?: number;
    } = {}
  ): TimelockValidationResult {
    const highValueThresholdSats = options.highValueThresholdSats ?? 100_000_000n; // 100M sats ($50k)
    const requiredQuorum = options.requiredQuorum ?? 3;
    const violations: string[] = [];

    const requiresTimelock = req.amountSat > highValueThresholdSats;

    const proposedMs = new Date(req.proposedAtTimestampIso).getTime();
    const executionMs = new Date(req.executionTimestampIso).getTime();
    const elapsedMs = executionMs - proposedMs;
    const timeElapsedHours = elapsedMs / (1000 * 3600);

    let timelockSatisfied = true;
    if (requiresTimelock && timeElapsedHours < 48.0) {
      timelockSatisfied = false;
      violations.push(
        `High-value transaction (${req.amountSat} sats) requires 48-hour timelock delay; only ${timeElapsedHours.toFixed(1)} hours elapsed`
      );
    }

    // Unique non-empty signatures
    const validSignatures = req.signerSignatures.filter(
      (sig, index, self) => sig && sig.trim().length > 0 && self.indexOf(sig) === index
    );
    const validSignerCount = validSignatures.length;
    const signerQuorumMet = validSignerCount >= requiredQuorum;

    if (!signerQuorumMet) {
      violations.push(
        `Insufficient multisig signatures: received ${validSignerCount}, required ${requiredQuorum}`
      );
    }

    const authorized = timelockSatisfied && signerQuorumMet && violations.length === 0;

    return {
      transactionId: req.transactionId,
      requiresTimelock,
      timelockSatisfied,
      timeElapsedHours,
      signerQuorumMet,
      validSignerCount,
      requiredQuorum,
      authorized,
      violations,
    };
  }

  /**
   * Processes Founder Compensation Escrow Payouts with vesting and DAO bonus caps.
   * Specification: docs/knowledge_base/operating_manual.md Section 3.D
   */
  static processFounderEscrowPayout(
    schedule: FounderEscrowSchedule
  ): FounderEscrowPayoutResult {
    const vestingResult = BosYieldSplitter.evaluateFounderVesting({
      monthsElapsed: schedule.monthsElapsed,
      totalAllocatedSat: schedule.totalAllocatedSat,
      monthlyBaseCapSat: schedule.monthlyBaseCapSat,
      daoBonusSat: schedule.requestedBonusSat,
      escrowSat: schedule.escrowBalanceSat,
    });

    const violations = [...vestingResult.violations];

    let authorizedBonusSat = 0n;
    if (schedule.daoApprovedBonus) {
      authorizedBonusSat = vestingResult.authorizedBonusSat;
    } else if (schedule.requestedBonusSat > 0n) {
      violations.push("Requested bonus rejected: DAO vote approval required");
    }

    const totalPayoutSat = vestingResult.authorizedMonthlyBaseSat + authorizedBonusSat;

    return {
      founderId: schedule.founderId,
      isVested: vestingResult.isVested,
      vestedRatio: vestingResult.vestedRatio,
      vestedAmountSat: vestingResult.vestedAmountSat,
      authorizedMonthlyBaseSat: vestingResult.authorizedMonthlyBaseSat,
      authorizedBonusSat,
      totalPayoutSat,
      emergencyLimitSat: vestingResult.emergencyLimitSat,
      isEscrowWithinLimit: vestingResult.isEscrowWithinLimit,
      violations,
    };
  }
}
