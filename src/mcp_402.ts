/**
 * MCP-402: attach an x402 (HTTP 402 Payment Required) demand to an MCP tool
 * call and gate dispatch on a verified receipt.
 *
 * Reuses the x402 facade (jobCardToDemand / verifyPaymentReceipt) so MCP tool
 * invocations settle through the same non-custodial escrow + SLA substrate as
 * direct x402 commerce.
 */
import type { JobCard } from "./core_types";
import {
  jobCardToDemand,
  verifyPaymentReceipt,
  type X402PaymentDemand,
  type X402PaymentReceipt,
} from "./x402_facade";

export interface McpToolCall {
  tool: string;
  arguments: Record<string, unknown>;
  /** Job card the tool invocation is billed against. */
  job: Pick<JobCard, "id" | "title" | "description" | "bountySat" | "deadline">;
  payerDid: string;
}

export interface Mcp402PaymentGateResult {
  authorized: boolean;
  demand: X402PaymentDemand;
  receipt?: X402PaymentReceipt;
  reason?: string;
}

export class Mcp402Facade {
  private readonly settled = new Set<string>();

  /** Build the x402 payment demand for an MCP tool invocation. */
  demand(call: McpToolCall): X402PaymentDemand {
    return jobCardToDemand(call.job);
  }

  /** Validate a receipt before the tool dispatches (fail-closed). */
  authorize(call: McpToolCall, receipt: X402PaymentReceipt): Mcp402PaymentGateResult {
    const demand = this.demand(call);
    if (!verifyPaymentReceipt(demand, receipt)) {
      return { authorized: false, demand, reason: "invalid or mismatched x402 receipt" };
    }
    this.settled.add(receipt.demandId);
    return { authorized: true, demand, receipt };
  }

  isSettled(demandId: string): boolean {
    return this.settled.has(demandId);
  }
}
