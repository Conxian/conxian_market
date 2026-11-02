import { describe, expect, it } from "vitest";
import {
  HttpLightningPaymentVerifier,
  managedSubscriptionDemand,
  verifyLightningPayment,
  type LightningPaymentVerifier,
} from "../src/lightning_payment.js";
import type { X402PaymentDemand, X402PaymentReceipt } from "../src/x402_facade.js";

function fetchStub(handler: (url: string) => { status?: number; body?: unknown }) {
  return (async (url: string) => {
    const r = handler(url);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.body ?? {},
    };
  }) as never;
}

const demand: X402PaymentDemand = {
  scheme: "x402",
  amount: "5000",
  currency: "sats",
  paymentPointer: "$conxian.com/market/job/j1",
  resourceId: "j1",
};

const receipt: X402PaymentReceipt = {
  demandId: "j1",
  transactionId: "inv_123",
  amountSat: "5000",
  paidAt: 1_700_000_000,
  payerDid: "did:example:payer",
};

describe("HttpLightningPaymentVerifier", () => {
  it("fails closed when no check URL is configured", async () => {
    const v = new HttpLightningPaymentVerifier("");
    await expect(v.verifySettlement("inv_1", 5000n)).rejects.toThrow(/not configured/);
  });

  it("fails closed on non-2xx", async () => {
    const v = new HttpLightningPaymentVerifier("https://check.example", fetchStub(() => ({ status: 500 })));
    await expect(v.verifySettlement("inv_1", 5000n)).rejects.toThrow(/HTTP 500/);
  });

  it("fails closed when the response has no settled indicator", async () => {
    const v = new HttpLightningPaymentVerifier("https://check.example", fetchStub(() => ({ body: { amountSat: 5000 } })));
    await expect(v.verifySettlement("inv_1", 5000n)).rejects.toThrow(/settled indicator/);
  });

  it("fails closed on amount mismatch", async () => {
    const v = new HttpLightningPaymentVerifier(
      "https://check.example",
      fetchStub(() => ({ body: { settled: true, amountSat: 4000 } })),
    );
    await expect(v.verifySettlement("inv_1", 5000n)).rejects.toThrow(/amount mismatch/);
  });

  it("accepts settled with confirmed amount", async () => {
    const v = new HttpLightningPaymentVerifier(
      "https://check.example",
      fetchStub(() => ({ body: { settled: true, amountSat: 5000, preimage: "abc", settledAt: 99 } })),
    );
    const s = await v.verifySettlement("inv_1", 5000n);
    expect(s.settled).toBe(true);
    expect(s.amountConfirmed).toBe(true);
    expect(s.preimage).toBe("abc");
  });

  it("accepts `paid: true` shape and msat amount", async () => {
    const v = new HttpLightningPaymentVerifier(
      "https://check.example",
      fetchStub(() => ({ body: { paid: true, amount_msat: "5000000" } })),
    );
    const s = await v.verifySettlement("inv_1", 5000n);
    expect(s.settled).toBe(true);
    expect(s.amountConfirmed).toBe(true);
    expect(s.amountSat).toBe(5000n);
  });
});

describe("verifyLightningPayment", () => {
  const okVerifier: LightningPaymentVerifier = {
    async verifySettlement() {
      return { invoiceId: "inv_123", amountSat: 5000n, settled: true, amountConfirmed: true };
    },
  };

  it("rejects zero-amount demand", async () => {
    const d = { ...demand, amount: "0" };
    const r = await verifyLightningPayment(d, receipt, okVerifier);
    expect(r.paymentVerified).toBe(false);
  });

  it("rejects missing transaction id", async () => {
    const r = await verifyLightningPayment(demand, { ...receipt, transactionId: "" }, okVerifier);
    expect(r.paymentVerified).toBe(false);
  });

  it("rejects amount mismatch in receipt", async () => {
    const r = await verifyLightningPayment(demand, { ...receipt, amountSat: "1" }, okVerifier);
    expect(r.paymentVerified).toBe(false);
  });

  it("returns paymentVerified on settled backend", async () => {
    const r = await verifyLightningPayment(demand, receipt, okVerifier);
    expect(r.paymentVerified).toBe(true);
    expect(r.amountSat).toBe(5000n);
  });

  it("propagates verifier rejection as unverified", async () => {
    const failing: LightningPaymentVerifier = {
      async verifySettlement() {
        throw new Error("backend down");
      },
    };
    const r = await verifyLightningPayment(demand, receipt, failing);
    expect(r.paymentVerified).toBe(false);
    expect(r.reason).toMatch(/backend down/);
  });
});

describe("managedSubscriptionDemand", () => {
  it("builds a non-zero demand", () => {
    const d = managedSubscriptionDemand(
      { planId: "indie", amountSat: 29_000n, paymentPointer: "$conxian.com/gateway/sub/indie", description: "Indie" },
      "tenant-1",
    );
    expect(d.amount).toBe("29000");
    expect(d.currency).toBe("sats");
    expect(d.resourceId).toBe("tenant-1");
  });

  it("rejects zero plan amount", () => {
    expect(() =>
      managedSubscriptionDemand(
        { planId: "indie", amountSat: 0n, paymentPointer: "$p", description: "x" },
        "t",
      ),
    ).toThrow(/must be > 0/);
  });
});
