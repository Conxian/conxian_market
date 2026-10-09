/**
 * End-to-end integration test for the Indie AI Agent "3-Line Quickstart".
 *
 * Mirrors the exact flow of examples/indie-agent-quickstart.ts:
 *   1. connect to the managed subscriber endpoint
 *   2. issue an x402 payment demand
 *   3. lock ERC-8183 job-card escrow + verify TEE/Nitro attestation proofs
 */
import { describe, expect, it } from "vitest";
import { ConxianMarketSDK } from "../src/sdk_bridge";
import { SettlementRail, TrustTier } from "../src/core_types";
import { EscrowState } from "../src/job_card_escrow";

describe("Indie Agent Quickstart (x402 + ERC-8183)", () => {
  it("runs the 3-step quickstart end-to-end against the SDK bridge", async () => {
    // Step 1 — Initialize the SDK against the managed subscriber endpoint.
    const sdk = await ConxianMarketSDK.connect({
      baseUrl: "https://api.conxian-labs.com/v1/agent",
      apiToken: "cxn_agent_managed_quickstart_demo_token",
    });
    expect(sdk.gateway).toBeDefined();
    expect(sdk.x402EscrowGateway).toBeDefined();

    // Step 2 — Issue an x402 payment demand.
    const demand = sdk.createX402Demand(
      {
        id: "job-indie-agent-001",
        title: "Autonomous Data Analysis Task",
        description: "ElizaOS / LangGraph agent research labor",
        bountySat: 1000n,
        deadline: Date.now() + 3_600_000,
      },
      SettlementRail.Lightning
    );
    expect(demand.scheme).toBe("x402");
    expect(demand.amount).toBe("1000");
    expect(demand.rail).toBe(SettlementRail.Lightning);
    expect(demand.paymentPointer).toContain("job-indie-agent-001");
    expect(demand.paymentPointer).toContain("rail=LIGHTNING");

    const receipt = {
      demandId: "job-indie-agent-001",
      transactionId: "tx_lightning_pay_001_sats",
      amountSat: "1000",
      paidAt: Date.now(),
      payerDid: "did:conxian:client:indie_builder_01",
    };

    const attestationCert = {
      enclave_attestation: "enclave_aws_nitro_attestation_proof_001",
      light_proof: "spv_light_client_header_proof_001",
      proof_height: 850_000,
    };

    // Step 3 — Lock ERC-8183 escrow + verify TEE/Nitro hardware proofs.
    const { escrowRecord, trustProof } =
      await sdk.processX402PaymentAndLockEscrowWithAttestation(
        demand,
        receipt,
        "did:conxian:agent:provider_01",
        SettlementRail.Lightning,
        attestationCert
      );

    expect(escrowRecord.jobId).toBe("job-indie-agent-001");
    expect(escrowRecord.state).toBe(EscrowState.Open);
    expect(escrowRecord.rail).toBe(SettlementRail.Lightning);
    expect(escrowRecord.budgetSat).toBe(1000n);

    expect(trustProof.attestationVerified).toBe(true);
    expect(trustProof.verifiedTier).toBe(TrustTier.Managed);
    expect(trustProof.proofHash).toBeDefined();
    expect(trustProof.issuer).toBe("conxian.org/trust-layer");
  });
});
