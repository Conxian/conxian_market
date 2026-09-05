import { describe, expect, it } from "vitest";
import {
  jobCardToDemand,
  jobCardToMultiRailDemands,
  toEscrowParams,
  verifyPaymentReceipt,
  X402EscrowGateway,
} from "../src/x402_facade";
import { SettlementRail, TrustTier } from "../src/core_types";
import { JobCardEscrowEngine, EscrowState } from "../src/job_card_escrow";
import { SlaEngine } from "../src/sla_engine";

describe("x402 facade & gateway", () => {
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

  it("builds rail-specific and multi-rail x402 payment demands", () => {
    const sbtcDemand = jobCardToDemand(job, SettlementRail.Sbtc);
    expect(sbtcDemand.rail).toBe(SettlementRail.Sbtc);
    expect(sbtcDemand.paymentPointer).toContain("?rail=SBTC");

    const multiDemands = jobCardToMultiRailDemands(job, [
      SettlementRail.Sbtc,
      SettlementRail.Lightning,
      SettlementRail.Fedimint,
    ]);
    expect(multiDemands).toHaveLength(3);
    expect(multiDemands[1].rail).toBe(SettlementRail.Lightning);
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
    const demand = jobCardToDemand(job, SettlementRail.Lightning);
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
      TrustTier.Managed
    );
    expect(params.jobId).toBe("job-1");
    expect(params.clientDid).toBe("did:conxian:client:1");
    expect(params.budgetSat).toBe(1_000_000n);
    expect(params.rail).toBe(SettlementRail.Lightning);
  });

  it("locks escrow and previews 80/10/10 yield split through X402EscrowGateway", () => {
    const slaEngine = new SlaEngine();
    const escrowEngine = new JobCardEscrowEngine(slaEngine);
    const gateway = new X402EscrowGateway(escrowEngine);

    const demand = jobCardToDemand(job, SettlementRail.Sbtc);
    const receipt = {
      demandId: "job-1",
      transactionId: "tx-xyz",
      amountSat: "1000000",
      paidAt: 1_700_000_000_000,
      payerDid: "did:conxian:client:1",
    };

    const escrow = gateway.processPaymentAndLockEscrow(
      demand,
      receipt,
      "did:conxian:agent:1",
      SettlementRail.Sbtc,
      TrustTier.Strict
    );

    expect(escrow.jobId).toBe("job-1");
    expect(escrow.state).toBe(EscrowState.Open);
    expect(escrow.budgetSat).toBe(1_000_000n);

    const yieldSplit = gateway.previewYieldSplit(demand);
    expect(yieldSplit.builderSat).toBe(800_000n);
    expect(yieldSplit.platformTreasurySat).toBe(100_000n);
    expect(yieldSplit.ecosystemStakeholdersSat).toBe(100_000n);
  });
});
