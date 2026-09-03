/**
 * ERC-8183 Job Card Escrow & Programmable Settlement Engine.
 *
 * Implements non-custodial programmable escrow lifecycle for autonomous AI agent labor
 * per ERC-8183 / CJCS specifications in docs/knowledge_base/trust_tier_pricing.md
 * and docs/knowledge_base/operating_manual.md.
 */

import {
  TrustTier,
  SettlementRail,
  JobCardStatus,
  type JobCard,
  type AttestationCertificate,
  type SlaTemplate,
} from "./core_types";
import { calculateRailFee } from "./fee_calculator";
import { SlaEngine, type SlaEvaluationResult } from "./sla_engine";
import { BosYieldSplitter, type YieldSplit } from "./bos_yield_splitter";
import {
  MarketAgnosticRouter,
  type M2mRouteResult,
  type NonCustodialSettlementRequest,
} from "./market_agnostic_router";

export enum EscrowState {
  Open = "OPEN",
  Submitted = "SUBMITTED",
  Released = "RELEASED",
  Disputed = "DISPUTED",
  Refunded = "REFUNDED",
}

export interface EscrowCreationParams {
  jobId: string;
  clientDid: string;
  agentProviderDid: string;
  evaluatorDid?: string;
  budgetSat: bigint;
  deadlineTimestamp: number;
  tier: TrustTier;
  rail: SettlementRail;
  preferredProtocol?: string;
  slaTemplate?: SlaTemplate;
  clientWalletAddress?: string;
}

export interface JobOutputSubmission {
  jobId: string;
  outputHash: string;
  outputPayload?: string;
  completedAtTimestamp: number;
  attestation?: AttestationCertificate;
}

export interface EscrowReleaseResult {
  jobId: string;
  status: EscrowState;
  grossBudgetSat: bigint;
  feeSat: bigint;
  netPayoutSat: bigint;
  yieldSplit: YieldSplit;
  m2mRoute: M2mRouteResult;
  slaResult: SlaEvaluationResult;
  releasedAt: number;
}

export interface EscrowRefundResult {
  jobId: string;
  status: EscrowState;
  refundAmountSat: bigint;
  bountyAmountSat: bigint;
  m2mRoute: M2mRouteResult;
  slaResult: SlaEvaluationResult;
  refundedAt: number;
  reason: string;
}

export interface EscrowRecord {
  jobId: string;
  clientDid: string;
  agentProviderDid: string;
  evaluatorDid: string;
  budgetSat: bigint;
  deadlineTimestamp: number;
  tier: TrustTier;
  rail: SettlementRail;
  preferredProtocol?: string;
  clientWalletAddress?: string;
  state: EscrowState;
  createdAt: number;
  submission?: JobOutputSubmission;
  releaseResult?: EscrowReleaseResult;
  refundResult?: EscrowRefundResult;
}

export class JobCardEscrowEngine {
  private escrows: Map<string, EscrowRecord> = new Map();
  private slaEngine: SlaEngine;

  constructor(slaEngine?: SlaEngine) {
    this.slaEngine = slaEngine || new SlaEngine();
  }

  /**
   * Create a new non-custodial ERC-8183 Job Card Escrow.
   */
  createEscrow(params: EscrowCreationParams): EscrowRecord {
    if (this.escrows.has(params.jobId)) {
      throw new Error(`Escrow already exists for jobId: ${params.jobId}`);
    }

    if (params.budgetSat <= 0n) {
      throw new Error("Budget must be greater than zero satoshis");
    }

    // Zero custody validation
    const zeroCustodyReq: NonCustodialSettlementRequest = {
      id: `escrow-req-${params.jobId}`,
      sourceWalletAddress: params.clientWalletAddress || params.clientDid,
      destinationWalletAddress: params.agentProviderDid,
      amountSat: params.budgetSat,
      rail: params.rail,
      preferredDefiProtocol: params.preferredProtocol,
      isClientKeyIsolated: true,
      storesClientDataOnHub: false,
    };

    const validation = MarketAgnosticRouter.validateZeroCustody(zeroCustodyReq);
    if (!validation.isZeroCustodyCompliant) {
      throw new Error(`Zero-custody validation failed: ${validation.violations.join(", ")}`);
    }

    const record: EscrowRecord = {
      jobId: params.jobId,
      clientDid: params.clientDid,
      agentProviderDid: params.agentProviderDid,
      evaluatorDid: params.evaluatorDid || "did:conxian:evaluator:default",
      budgetSat: params.budgetSat,
      deadlineTimestamp: params.deadlineTimestamp,
      tier: params.tier,
      rail: params.rail,
      preferredProtocol: params.preferredProtocol,
      clientWalletAddress: params.clientWalletAddress,
      state: EscrowState.Open,
      createdAt: Date.now(),
    };

    this.escrows.set(params.jobId, record);
    return record;
  }

  /**
   * Submit job completion output by agent provider.
   */
  submitJobOutput(submission: JobOutputSubmission): EscrowRecord {
    const record = this.escrows.get(submission.jobId);
    if (!record) {
      throw new Error(`Escrow not found for jobId: ${submission.jobId}`);
    }

    if (record.state !== EscrowState.Open) {
      throw new Error(`Cannot submit output for escrow in state: ${record.state}`);
    }

    if (!submission.outputHash) {
      throw new Error("Output hash is required for submission");
    }

    record.submission = submission;
    record.state = EscrowState.Submitted;
    return record;
  }

  /**
   * Evaluate SLA & release escrow funds via non-custodial router and 80/10/10 yield split.
   */
  evaluateAndRelease(
    jobId: string,
    currentTimeIso: string,
    options?: { actualTrustTier?: TrustTier }
  ): EscrowReleaseResult {
    const record = this.escrows.get(jobId);
    if (!record) {
      throw new Error(`Escrow not found for jobId: ${jobId}`);
    }

    if (record.state !== EscrowState.Submitted && record.state !== EscrowState.Open) {
      throw new Error(`Cannot release escrow in state: ${record.state}`);
    }

    const completedAtIso = record.submission
      ? new Date(record.submission.completedAtTimestamp).toISOString()
      : currentTimeIso;

    // SLA Evaluation
    const mockJobCard: JobCard = {
      id: record.jobId,
      title: `Job ${record.jobId}`,
      description: "M2M Agent Labor Task",
      bountySat: record.budgetSat,
      rail: record.rail,
      tier: record.tier,
      status: JobCardStatus.Completed,
      createdAt: record.createdAt,
      deadline: record.deadlineTimestamp,
    };

    const slaResult = this.slaEngine.evaluateJobCard(mockJobCard, currentTimeIso, {
      lastActivityTimeIso: completedAtIso,
      actualTrustTier: options?.actualTrustTier || record.tier,
    });

    // Calculate Protocol Fee
    const feeInfo = calculateRailFee(record.budgetSat, record.tier, record.rail);
    const feeSat = feeInfo.feeSat;
    const netPayoutSat = record.budgetSat > feeSat ? record.budgetSat - feeSat : 0n;

    // Calculate Yield Split (80% Builder, 10% Treasury, 10% Ecosystem)
    const yieldSplit = BosYieldSplitter.calculateYieldSplit(netPayoutSat);

    // Route Non-Custodial M2M Payment
    const m2mRoute = MarketAgnosticRouter.routeM2mSettlement(
      record.clientDid,
      record.agentProviderDid,
      yieldSplit.builderSat,
      record.rail,
      record.preferredProtocol
    );

    const releaseResult: EscrowReleaseResult = {
      jobId: record.jobId,
      status: EscrowState.Released,
      grossBudgetSat: record.budgetSat,
      feeSat,
      netPayoutSat,
      yieldSplit,
      m2mRoute,
      slaResult,
      releasedAt: Date.now(),
    };

    record.state = EscrowState.Released;
    record.releaseResult = releaseResult;
    return releaseResult;
  }

  /**
   * Dispute escrow and issue non-custodial refund / auto-bounty.
   */
  disputeAndRefund(
    jobId: string,
    reason: string,
    currentTimeIso: string
  ): EscrowRefundResult {
    const record = this.escrows.get(jobId);
    if (!record) {
      throw new Error(`Escrow not found for jobId: ${jobId}`);
    }

    if (record.state === EscrowState.Released || record.state === EscrowState.Refunded) {
      throw new Error(`Cannot dispute escrow in final state: ${record.state}`);
    }

    const mockJobCard: JobCard = {
      id: record.jobId,
      title: `Job ${record.jobId}`,
      description: "M2M Agent Labor Task",
      bountySat: record.budgetSat,
      rail: record.rail,
      tier: record.tier,
      status: JobCardStatus.Disputed,
      createdAt: record.createdAt,
      deadline: record.deadlineTimestamp,
    };

    const slaResult = this.slaEngine.evaluateJobCard(mockJobCard, currentTimeIso, {
      disputeCount: 1,
    });

    // Auto-bounty or gap card penalty calculation
    const bountyAmountSat = slaResult.triggeredRules.length === 0 ? 0n : (record.budgetSat * 10n) / 100n; // 10% penalty
    const refundAmountSat = record.budgetSat - bountyAmountSat;

    const m2mRoute = MarketAgnosticRouter.routeM2mSettlement(
      record.agentProviderDid,
      record.clientDid,
      refundAmountSat,
      record.rail,
      record.preferredProtocol
    );

    const refundResult: EscrowRefundResult = {
      jobId: record.jobId,
      status: EscrowState.Refunded,
      refundAmountSat,
      bountyAmountSat,
      m2mRoute,
      slaResult,
      refundedAt: Date.now(),
      reason,
    };

    record.state = EscrowState.Refunded;
    record.refundResult = refundResult;
    return refundResult;
  }

  /**
   * Fetch an existing escrow record by ID.
   */
  getEscrowRecord(jobId: string): EscrowRecord | undefined {
    return this.escrows.get(jobId);
  }

  /**
   * List all stored escrow records.
   */
  listEscrows(): EscrowRecord[] {
    return Array.from(this.escrows.values());
  }
}
