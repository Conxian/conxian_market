import { describe, expect, it } from "vitest";
import {
  jobCardToDemand,
  toEscrowParams,
  verifyPaymentReceipt,
} from "../src/x402_facade";
import { SettlementRail, TrustTier } from "../src/core_types";

describe("x402 facade", () => {
  const job = {
    id: "job-1",
    title: "Audit RGB transition",
    description: "Produce a schema-validated transition",
    bountySat: 1_000_000n,
    deadline: 1_800_000_000_000,
  };

  it("builds an x402 payment demand from a job card", () => {
    const demand = jobCardToDemand(job);
    expect(demand.scheme).toBe("x402");
    expect(demand.amount).toBe("1000000");
    expect(demand.currency).toBe("sats");
    expect(demand.resourceId).toBe("job-1");
    expect(demand.paymentPointer).toContain("job-1");
  });

  it("rejects non-positive bounty", () => {
    expect(() => jobCardToDemand({ ...job, bountySat: 0n })).toThrow();
  });

  it("verifies a matching receipt", () => {
    const demand = jobCardToDemand(job);
    const receipt = {
      demandId: "job-1",
      transactionId: "tx-abc",
      amountSat: "1000000",
      paidAt: 1_700_000_000_000,
      payerDid: "did:conxian:client:1",
    };
    expect(verifyPaymentReceipt(demand, receipt)).toBe(true);
  });

  it("rejects a receipt with a mismatched amount", () => {
    const demand = jobCardToDemand(job);
    const receipt = {
      demandId: "job-1",
      transactionId: "tx-abc",
      amountSat: "999999",
      paidAt: 1_700_000_000_000,
      payerDid: "did:conxian:client:1",
    };
    expect(verifyPaymentReceipt(demand, receipt)).toBe(false);
  });

  it("maps a valid receipt to escrow params", () => {
    const demand = jobCardToDemand(job);
    const receipt = {
      demandId: "job-1",
      transactionId: "tx-abc",
      amountSat: "1000000",
      paidAt: 1_700_000_000_000,
      payerDid: "did:conxian:client:1",
    };
    const params = toEscrowParams(
      demand,
      receipt,
      "did:conxian:agent:1",
      SettlementRail.Lightning,
      TrustTier.Managed,
    );
    expect(params.jobId).toBe("job-1");
    expect(params.clientDid).toBe("did:conxian:client:1");
    expect(params.budgetSat).toBe(1_000_000n);
  });
});
