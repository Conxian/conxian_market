/**
 * x402 (HTTP 402 Payment Required) facade over the ERC-8183/CJCS escrow engine.
 *
 * Bridges the broader agent-commerce ecosystem (Coinbase x402, OKX Agent
 * Payments Protocol, XRPL Agent Commerce, Nevermined, MoltJobs) onto Conxian's
 * non-custodial escrow + SLA substrate. A job card's bounty is exposed as an
 * x402 payment demand; a validated payment receipt maps to the escrow budget
 * lock (EscrowState::Open), keeping ERC-8183/CJCS as the on-chain escrow layer.
 */

import type { JobCard, SettlementRail, TrustTier } from "./core_types";
import type { EscrowCreationParams, EscrowRecord } from "./job_card_escrow";
import { JobCardEscrowEngine } from "./job_card_escrow";
import { BosYieldSplitter } from "./bos_yield_splitter";

export const X402_SCHEME = "x402" as const;
export const X402_CURRENCY = "sats" as const;

/** x402 payment demand (HTTP 402 response body) for an agent-labor job. */
export interface X402PaymentDemand {
  scheme: "x402";
  /** Bounty in satoshis as a decimal string (bigint-safe over JSON). */
  amount: string;
  currency: "sats";
  /** Payment pointer for the escrow resource. */
  paymentPointer: string;
  /** Echoed resource/job id. */
  resourceId: string;
  description?: string;
  expiresAt?: number;
  /** Target settlement rail. */
  rail?: SettlementRail;
}

/** x402 payment receipt - proof of payment against a prior demand. */
export interface X402PaymentReceipt {
  demandId: string;
  transactionId: string;
  amountSat: string;
  paidAt: number;
  payerDid: string;
}

/** Build an x402 payment demand from a job card's bounty and optional rail. */
export function jobCardToDemand(
  job: Pick<JobCard, "id" | "title" | "description" | "bountySat" | "deadline">,
  rail?: SettlementRail
): X402PaymentDemand {
  if (job.bountySat <= 0n) {
    throw new Error("Bounty must be greater than zero satoshis");
  }
  const railQuery = rail ? `?rail=${rail}` : "";
  return {
    scheme: X402_SCHEME,
    amount: job.bountySat.toString(),
    currency: X402_CURRENCY,
    paymentPointer: `$conxian.com/market/job/${job.id}${railQuery}`,
    resourceId: job.id,
    description: job.description || job.title,
    expiresAt: job.deadline,
    rail,
  };
}

/** Build multi-rail x402 payment demands for a set of settlement rails. */
export function jobCardToMultiRailDemands(
  job: Pick<JobCard, "id" | "title" | "description" | "bountySat" | "deadline">,
  rails: SettlementRail[]
): X402PaymentDemand[] {
  return rails.map((rail) => jobCardToDemand(job, rail));
}

/** Validate an x402 payment receipt against its demand (id + amount + expiry). */
export function verifyPaymentReceipt(
  demand: X402PaymentDemand,
  receipt: X402PaymentReceipt
): boolean {
  if (receipt.demandId !== demand.resourceId) return false;
  if (receipt.amountSat !== demand.amount) return false;
  if (receipt.payerDid.length === 0 || receipt.transactionId.length === 0) {
    return false;
  }
  if (demand.expiresAt !== undefined && receipt.paidAt > demand.expiresAt) {
    return false;
  }
  return true;
}

/** Convert a valid (demand, receipt) pair into escrow budget-lock params. */
export function toEscrowParams(
  demand: X402PaymentDemand,
  receipt: X402PaymentReceipt,
  agentProviderDid: string,
  rail: EscrowCreationParams["rail"],
  tier: EscrowCreationParams["tier"]
): EscrowCreationParams {
  if (!verifyPaymentReceipt(demand, receipt)) {
    throw new Error("x402 payment receipt does not match the demand");
  }
  return {
    jobId: demand.resourceId,
    clientDid: receipt.payerDid,
    agentProviderDid,
    budgetSat: BigInt(demand.amount),
    deadlineTimestamp: demand.expiresAt ?? 0,
    tier,
    rail: demand.rail ?? rail,
  };
}

/** Gateway processor connecting x402 payment receipts to ERC-8183 escrow locks. */
export class X402EscrowGateway {
  constructor(private readonly escrowEngine: JobCardEscrowEngine) {}

  /** Lock escrow budget upon receiving a valid x402 payment receipt. */
  processPaymentAndLockEscrow(
    demand: X402PaymentDemand,
    receipt: X402PaymentReceipt,
    agentProviderDid: string,
    rail: SettlementRail,
    tier: TrustTier
  ): EscrowRecord {
    const params = toEscrowParams(demand, receipt, agentProviderDid, rail, tier);
    return this.escrowEngine.createEscrow(params);
  }

  /** Preview 80/10/10 commercial yield split for an x402 demand amount. */
  previewYieldSplit(demand: X402PaymentDemand) {
    const grossAmount = BigInt(demand.amount);
    return BosYieldSplitter.calculateYieldSplit(grossAmount);
  }
}
