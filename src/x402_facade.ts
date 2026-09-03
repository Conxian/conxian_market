/**
 * x402 (HTTP 402 Payment Required) facade over the ERC-8183/CJCS escrow engine.
 *
 * Bridges the broader agent-commerce ecosystem (Coinbase x402, OKX Agent
 * Payments Protocol, XRPL Agent Commerce, Nevermined, MoltJobs) onto Conxian's
 * non-custodial escrow + SLA substrate. A job card's bounty is exposed as an
 * x402 payment demand; a validated payment receipt maps to the escrow budget
 * lock (EscrowState::Open), keeping ERC-8183/CJCS as the on-chain escrow layer.
 */

import type { JobCard } from "./core_types";
import type { EscrowCreationParams } from "./job_card_escrow";

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
}

/** x402 payment receipt - proof of payment against a prior demand. */
export interface X402PaymentReceipt {
  demandId: string;
  transactionId: string;
  amountSat: string;
  paidAt: number;
  payerDid: string;
}

/** Build an x402 payment demand from a job card's bounty. */
export function jobCardToDemand(
  job: Pick<JobCard, "id" | "title" | "description" | "bountySat" | "deadline">,
): X402PaymentDemand {
  if (job.bountySat <= 0n) {
    throw new Error("Bounty must be greater than zero satoshis");
  }
  return {
    scheme: X402_SCHEME,
    amount: job.bountySat.toString(),
    currency: X402_CURRENCY,
    paymentPointer: `$conxian.com/market/job/${job.id}`,
    resourceId: job.id,
    description: job.description || job.title,
    expiresAt: job.deadline,
  };
}

/** Validate an x402 payment receipt against its demand (id + amount + expiry). */
export function verifyPaymentReceipt(
  demand: X402PaymentDemand,
  receipt: X402PaymentReceipt,
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
  tier: EscrowCreationParams["tier"],
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
    rail,
  };
}
