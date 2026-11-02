/**
 * Lightning payment verification — the missing "real money" primitive.
 *
 * The x402 facade (`x402_facade.ts`) accepts a caller-supplied receipt and only
 * checks field consistency; it never proves a payment actually settled. This
 * module closes that gap: it verifies a Lightning invoice's settled state against
 * a configurable, operator-owned invoice-check endpoint, FAIL-CLOSED.
 *
 * Design mirrors the Nexus #400 remediation (`LIGHTNING_INVOICE_CHECK_URL`):
 * without a real verifier, verification REJECTS — it never trusts a
 * caller-supplied receipt as proof of payment.
 *
 * This is the turnkey-core primitive for the managed gateway subscription lane:
 *   pay (Lightning invoice) -> verify settlement -> mint key / issue entitlement.
 */

import type { X402PaymentDemand, X402PaymentReceipt } from "./x402_facade.js";

/** Settled state of a Lightning invoice, as returned by an invoice-check backend. */
export interface LightningInvoiceStatus {
  invoiceId: string;
  /** Settled amount in satoshis (from the backend, when reported). */
  amountSat?: bigint;
  settled: boolean;
  settledAt?: number;
  preimage?: string;
  /** True when the backend confirmed an amount matching the demand. */
  amountConfirmed: boolean;
}

/** Verifies that a Lightning invoice actually settled for a given amount. */
export interface LightningPaymentVerifier {
  verifySettlement(invoiceId: string, amountSat: bigint): Promise<LightningInvoiceStatus>;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** Extract a non-negative bigint amount from a variety of Lightning backend shapes. */
function readAmount(body: unknown): bigint | undefined {
  if (body == null || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  for (const key of ["amountSat", "valueSat", "value", "amount"]) {
    const v = b[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return BigInt(Math.trunc(v));
    if (typeof v === "bigint") return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
  }
  // millisatoshi form (LND): amount_msat / value_msat
  for (const key of ["amountMsat", "valueMsat", "amount_msat", "value_msat"]) {
    const v = b[key];
    if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v) / 1000n;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return BigInt(Math.trunc(v)) / 1000n;
  }
  return undefined;
}

function readSettled(body: unknown): boolean | undefined {
  if (body == null || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  if (typeof b.settled === "boolean") return b.settled;
  if (typeof b.paid === "boolean") return b.paid;
  if (typeof b.status === "string") {
    const s = b.status.toLowerCase();
    if (["paid", "settled", "succeeded", "complete", "completed"].includes(s)) return true;
    if (["open", "pending", "unpaid", "expired", "cancelled", "canceled"].includes(s)) return false;
  }
  return undefined;
}

/**
 * Fail-closed HTTP Lightning invoice verifier.
 *
 * Rejects (throws) when the check URL is unset, the backend is unreachable, the
 * backend returns a non-2xx, the response has no explicit settled indicator, or
 * the reported amount disagrees with the expected amount. It never infers
 * "settled" from the absence of an error.
 */
export class HttpLightningPaymentVerifier implements LightningPaymentVerifier {
  constructor(
    private readonly checkUrl: string,
    private readonly fetchImpl: FetchLike = globalThis.fetch as FetchLike,
  ) {}

  async verifySettlement(invoiceId: string, amountSat: bigint): Promise<LightningInvoiceStatus> {
    if (!this.checkUrl || this.checkUrl.trim().length === 0) {
      throw new Error("Lightning invoice check URL not configured (fail-closed)");
    }
    if (!invoiceId || invoiceId.length === 0) {
      throw new Error("invoice id required");
    }
    const base = this.checkUrl.replace(/\/+$/, "");
    const url = `${base}/${encodeURIComponent(invoiceId)}`;

    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchImpl(url, { headers: { accept: "application/json" } });
    } catch (cause) {
      throw new Error(`Lightning invoice check unreachable: ${(cause as Error).message}`);
    }
    if (!res.ok) {
      throw new Error(`Lightning invoice check returned HTTP ${res.status} (fail-closed)`);
    }
    const body = await res.json();
    const settled = readSettled(body);
    if (settled === undefined) {
      // Backend gave us nothing we can treat as authoritative -> do not trust.
      throw new Error("invoice-check response lacks an explicit settled indicator (fail-closed)");
    }
    const reported = readAmount(body);
    const amountConfirmed = reported !== undefined && reported === amountSat;
    if (amountSat > 0n && reported !== undefined && reported !== amountSat) {
      throw new Error(
        `Lightning amount mismatch: expected ${amountSat} sat, backend reported ${reported} sat`,
      );
    }
    return {
      invoiceId,
      amountSat: reported ?? amountSat,
      settled,
      settledAt: typeof (body as Record<string, unknown>).settledAt === "number"
        ? (body as Record<string, unknown>).settledAt as number
        : undefined,
      preimage: typeof (body as Record<string, unknown>).preimage === "string"
        ? (body as Record<string, unknown>).preimage as string
        : undefined,
      amountConfirmed,
    };
  }
}

/** Result of binding an x402 demand + receipt to a verified Lightning settlement. */
export interface LightningPaymentVerification {
  paymentVerified: boolean;
  settled: boolean;
  amountSat: bigint;
  settledAt?: number;
  preimage?: string;
  reason?: string;
}

/**
 * Verify that the receipt's Lightning invoice actually settled for the demand
 * amount. This is the authoritative payment gate; it must pass before any
 * entitlement is issued or escrow is locked.
 *
 * The receipt's `transactionId` is treated as the Lightning invoice id / payment
 * hash. `verifyPaymentReceipt` (field consistency) remains a cheap pre-check; this
 * function is the real-money proof.
 */
export async function verifyLightningPayment(
  demand: X402PaymentDemand,
  receipt: X402PaymentReceipt,
  verifier: LightningPaymentVerifier,
): Promise<LightningPaymentVerification> {
  const amountSat = BigInt(demand.amount);
  if (amountSat <= 0n) {
    return { paymentVerified: false, settled: false, amountSat, reason: "demand amount must be > 0 sat" };
  }
  if (!receipt || !receipt.transactionId || receipt.transactionId.length === 0) {
    return { paymentVerified: false, settled: false, amountSat, reason: "receipt missing transaction id" };
  }
  if (receipt.amountSat !== demand.amount) {
    return { paymentVerified: false, settled: false, amountSat, reason: "receipt amount does not match demand" };
  }
  let status: LightningInvoiceStatus;
  try {
    status = await verifier.verifySettlement(receipt.transactionId, amountSat);
  } catch (cause) {
    return { paymentVerified: false, settled: false, amountSat, reason: (cause as Error).message };
  }
  if (!status.settled) {
    return { paymentVerified: false, settled: false, amountSat, reason: "Lightning invoice not settled" };
  }
  if (!status.amountConfirmed) {
    // Settled, but we could not confirm the exact amount — remain fail-closed.
    return { paymentVerified: false, settled: true, amountSat, reason: "settled amount unconfirmed by backend" };
  }
  return {
    paymentVerified: true,
    settled: true,
    amountSat,
    settledAt: status.settledAt,
    preimage: status.preimage,
  };
}

/** A non-zero managed-tier subscription demand (Market #159: real pointer + non-zero demand). */
export interface ManagedSubscriptionPlan {
  planId: string;
  /** Billing amount in satoshis for the plan period. */
  amountSat: bigint;
  paymentPointer: string;
  description: string;
}

export function managedSubscriptionDemand(
  plan: ManagedSubscriptionPlan,
  resourceId: string,
  expiresAt?: number,
): X402PaymentDemand {
  if (plan.amountSat <= 0n) {
    throw new Error("subscription amount must be > 0 sat");
  }
  return {
    scheme: "x402",
    amount: plan.amountSat.toString(),
    currency: "sats",
    paymentPointer: plan.paymentPointer,
    resourceId,
    description: plan.description,
    expiresAt,
  };
}
