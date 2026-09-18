import { describe, expect, it } from "vitest";
import {
  jobCardToDemand,
  jobCardToMultiRailDemands,
  toEscrowParams,
  verifyPaymentReceipt,
  verifyPaymentReceiptWithAttestation,
  createTrustProofArtifact,
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

  it("verifies payment receipt with TEE/ZK attestation and constructs trust proof artifact", async () => {
    const demand = jobCardToDemand(job, SettlementRail.Sbtc);
    const receipt = {
      demandId: "job-1",
      transactionId: "tx-attested-123",
      amountSat: "1000000",
      paidAt: 1_700_000_000_000,
      payerDid: "did:conxian:client:attested",
    };
    const cert = {
      tee_proof: "0xtee_proof_bytes",
      zk_proof: "0xzk_proof_bytes",
      timestamp: 1_700_000_000_000,
    };

    const verificationResult = await verifyPaymentReceiptWithAttestation(
      demand,
      receipt,
      cert,
      "did:conxian:agent:provider"
    );

    expect(verificationResult.valid).toBe(true);
    expect(verificationResult.verifiedTier).toBe(TrustTier.Strict);
    expect(verificationResult.attestationValid).toBe(true);
    expect(verificationResult.trustProof.issuer).toBe("conxian.org/trust-layer");
    expect(verificationResult.trustProof.proofHash).toBeDefined();
    expect(verificationResult.trustProof.verifiedTier).toBe(TrustTier.Strict);
  });

  it("locks escrow with attestation proof through X402EscrowGateway", async () => {
    const slaEngine = new SlaEngine();
    const escrowEngine = new JobCardEscrowEngine(slaEngine);
    const gateway = new X402EscrowGateway(escrowEngine);

    const demand = jobCardToDemand(job, SettlementRail.Sbtc);
    const receipt = {
      demandId: "job-1",
      transactionId: "tx-attested-456",
      amountSat: "1000000",
      paidAt: 1_700_000_000_000,
      payerDid: "did:conxian:client:attested",
    };
    const cert = {
      enclave_attestation: "0xenclave_attestation_bytes",
      timestamp: 1_700_000_000_000,
    };

    const { escrowRecord, trustProof } = await gateway.processPaymentAndLockEscrowWithAttestation(
      demand,
      receipt,
      "did:conxian:agent:provider",
      SettlementRail.Sbtc,
      cert
    );

    expect(escrowRecord.jobId).toBe("job-1");
    expect(escrowRecord.state).toBe(EscrowState.Open);
    expect(escrowRecord.tier).toBe(TrustTier.Managed);
    expect(trustProof.verifiedTier).toBe(TrustTier.Managed);
    expect(trustProof.attestationVerified).toBe(true);
  });
});
