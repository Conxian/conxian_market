/**
 * Indie AI Agent Commerce — "3-Line Quickstart" Developer Integration Snippet
 *
 * Turnkey x402 (HTTP 402) + ERC-8183 escrow integration for ElizaOS, LangGraph,
 * AutoGen, and CrewAI builders using `@conxian/market-sdk`.
 *
 * Run (from this directory, after `npm install`):
 *   node --experimental-strip-types indie-agent-quickstart.ts
 * or:
 *   npx tsx indie-agent-quickstart.ts
 */

import {
  ConxianMarketSDK,
  SettlementRail,
  type AttestationCertificate,
  type X402PaymentReceipt,
} from "@conxian/market-sdk";

export async function runIndieAgentQuickstart() {
  console.log("=== Conxian Managed SaaS Gateway: Indie Agent Quickstart ===");

  // Step 1: Initialize ConxianMarketSDK against the Managed Subscriber Endpoint.
  const sdk = await ConxianMarketSDK.connect({
    baseUrl: "https://api.conxian-labs.com/v1/agent",
    apiToken: "cxn_agent_managed_quickstart_demo_token",
  });
  console.log(
    "Step 1: ConxianMarketSDK initialized → https://api.conxian-labs.com/v1/agent"
  );

  // Step 2: Issue an x402 payment demand for agent task execution.
  const job = {
    id: "job-indie-agent-001",
    title: "Autonomous Data Analysis Task",
    description: "ElizaOS / LangGraph agent research labor",
    bountySat: 1000n, // 1,000 sats (~$0.01)
    deadline: Date.now() + 3_600_000,
  };
  const demand = sdk.createX402Demand(job, SettlementRail.Lightning);
  console.log("Step 2: x402 Payment Demand Issued →", demand.paymentPointer);

  // Simulated x402 payment receipt returned by the client agent's wallet.
  const receipt: X402PaymentReceipt = {
    demandId: job.id,
    transactionId: "tx_lightning_pay_001_sats",
    amountSat: "1000",
    paidAt: Date.now(),
    payerDid: "did:conxian:client:indie_builder_01",
  };

  // TEE / enclave attestation certificate (AWS Nitro + light-client proof).
  const attestationCert: AttestationCertificate = {
    enclave_attestation: "enclave_aws_nitro_attestation_proof_001",
    light_proof: "spv_light_client_header_proof_001",
    proof_height: 850_000,
  };

  // Step 3: Lock ERC-8183 job-card escrow and verify TEE/Nitro hardware proofs.
  const { escrowRecord, trustProof } =
    await sdk.processX402PaymentAndLockEscrowWithAttestation(
      demand,
      receipt,
      "did:conxian:agent:provider_01",
      SettlementRail.Lightning,
      attestationCert
    );

  console.log(
    "Step 3: ERC-8183 Job Card Escrow Locked →",
    escrowRecord.jobId,
    escrowRecord.state
  );
  console.log(
    "Immutable Trust Proof Artifact Generated →",
    trustProof.proofId,
    trustProof.proofHash
  );

  return { demand, escrowRecord, trustProof };
}

// Execute the quickstart when run directly (not when imported).
import { fileURLToPath } from "node:url";
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  runIndieAgentQuickstart()
    .then(() => console.log("\nQuickstart complete."))
    .catch((err) => {
      console.error("Quickstart failed:", err);
      process.exit(1);
    });
}
