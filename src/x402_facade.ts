/**
 * x402 (HTTP 402 Payment Required) facade over the ERC-8183/CJCS escrow engine.
 *
 * Bridges the broader agent-commerce ecosystem (Coinbase x402, OKX Agent
 * Payments Protocol, XRPL Agent Commerce, Nevermined, MoltJobs) onto Conxian's
 * non-custodial escrow + SLA substrate. A job card's bounty is exposed as an
 * x402 payment demand; a validated payment receipt maps to the escrow budget
 * lock (EscrowState::Open), keeping ERC-8183/CJCS as the on-chain escrow layer.
 *
 * Now expanded with Attestation-Backed x402 Verification & Trust Layer Proofs.
 */

import type { AttestationCertificate, JobCard, SettlementRail, TrustTier } from "./core_types";
import { TrustTier as Tier } from "./core_types";
import type { EscrowCreationParams, EscrowRecord } from "./job_card_escrow";
import { JobCardEscrowEngine } from "./job_card_escrow";
import { BosYieldSplitter } from "./bos_yield_splitter";
import { GatewayVerifier, detectTrustTierStatic } from "./verification";

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

/** "Verified by Conxian" immutable trust proof artifact for an x402 agent transaction. */
export interface X402TrustProofArtifact {
  proofId: string;
  jobId: string;
  demandId: string;
  transactionId: string;
  payerDid: string;
  agentProviderDid: string;
  verifiedTier: TrustTier;
  verifiedAt: number;
  attestationVerified: boolean;
  attestationSummary: string;
  proofHash: string;
  issuer: "conxian.org/trust-layer";
}

/** Result of attestation-backed x402 payment verification. */
export interface X402AttestationVerificationResult {
  valid: boolean;
  demand: X402PaymentDemand;
  receipt: X402PaymentReceipt;
  verifiedTier: TrustTier;
  attestationValid: boolean;
  trustProof: X402TrustProofArtifact;
  error?: string;
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

/**
 * Verify x402 payment receipt accompanied by a hardware/enclave attestation certificate.
 * Generates an immutable "Verified by Conxian" trust proof artifact.
 */
export async function verifyPaymentReceiptWithAttestation(
  demand: X402PaymentDemand,
  receipt: X402PaymentReceipt,
  cert: AttestationCertificate,
  agentProviderDid: string,
  verifier?: GatewayVerifier
): Promise<X402AttestationVerificationResult> {
  const isReceiptValid = verifyPaymentReceipt(demand, receipt);
  if (!isReceiptValid) {
    const fallbackProof = createTrustProofArtifact(
      demand,
      receipt,
      agentProviderDid,
      Tier.ObserverOnly,
      false,
      "Receipt mismatch or expired"
    );
    return {
      valid: false,
      demand,
      receipt,
      verifiedTier: Tier.ObserverOnly,
      attestationValid: false,
      trustProof: fallbackProof,
      error: "x402 payment receipt does not match demand or is expired",
    };
  }

  let verifiedTier: TrustTier = Tier.ObserverOnly;
  let attestationValid = false;

  if (verifier) {
    const res = await verifier.verifyAttestation(cert);
    verifiedTier = res.tier;
    attestationValid = res.valid;
  } else {
    // Static fallback inspection
    verifiedTier = detectTrustTierStatic({
      "x-conxian-tee-proof": cert.tee_proof,
      "x-conxian-zk-proof": cert.zk_proof,
      "x-conxian-enclave-attestation": cert.enclave_attestation,
      "x-conxian-light-proof": cert.light_proof,
    });
    attestationValid = verifiedTier !== Tier.ObserverOnly;
  }

  const summary = attestationValid
    ? `Attestation verified at TrustTier: ${verifiedTier}`
    : "Attestation unverified or fallback to ObserverOnly";

  const trustProof = createTrustProofArtifact(
    demand,
    receipt,
    agentProviderDid,
    verifiedTier,
    attestationValid,
    summary
  );

  return {
    valid: isReceiptValid && attestationValid,
    demand,
    receipt,
    verifiedTier,
    attestationValid,
    trustProof,
  };
}

/** Helper to construct immutable trust proof artifact */
export function createTrustProofArtifact(
  demand: X402PaymentDemand,
  receipt: X402PaymentReceipt,
  agentProviderDid: string,
  verifiedTier: TrustTier,
  attestationVerified: boolean,
  summary: string
): X402TrustProofArtifact {
  const verifiedAt = Date.now();
  const proofId = `proof-x402-${demand.resourceId}-${verifiedAt}`;
  const rawData = `${proofId}:${demand.resourceId}:${receipt.transactionId}:${receipt.payerDid}:${agentProviderDid}:${verifiedTier}:${attestationVerified}`;

  // Simple deterministic string hash for proof artifact
  let hashVal = 0;
  for (let i = 0; i < rawData.length; i++) {
    hashVal = (hashVal << 5) - hashVal + rawData.charCodeAt(i);
    hashVal |= 0;
  }
  const proofHash = `0x${Math.abs(hashVal).toString(16).padStart(16, "0")}`;

  return {
    proofId,
    jobId: demand.resourceId,
    demandId: demand.resourceId,
    transactionId: receipt.transactionId,
    payerDid: receipt.payerDid,
    agentProviderDid,
    verifiedTier,
    verifiedAt,
    attestationVerified,
    attestationSummary: summary,
    proofHash,
    issuer: "conxian.org/trust-layer",
  };
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

  /**
   * Lock escrow budget upon receiving a valid x402 payment receipt AND verifying
   * hardware/enclave attestation certificate. Attaches trust proof artifact.
   */
  async processPaymentAndLockEscrowWithAttestation(
    demand: X402PaymentDemand,
    receipt: X402PaymentReceipt,
    agentProviderDid: string,
    rail: SettlementRail,
    cert: AttestationCertificate,
    verifier?: GatewayVerifier
  ): Promise<{ escrowRecord: EscrowRecord; trustProof: X402TrustProofArtifact }> {
    const verificationResult = await verifyPaymentReceiptWithAttestation(
      demand,
      receipt,
      cert,
      agentProviderDid,
      verifier
    );

    if (!verificationResult.valid) {
      throw new Error(
        `Attestation-backed x402 payment verification failed: ${verificationResult.error || "Invalid attestation"}`
      );
    }

    const escrowRecord = this.processPaymentAndLockEscrow(
      demand,
      receipt,
      agentProviderDid,
      rail,
      verificationResult.verifiedTier
    );

    return {
      escrowRecord,
      trustProof: verificationResult.trustProof,
    };
  }

  /** Preview 80/10/10 commercial yield split for an x402 demand amount. */
  previewYieldSplit(demand: X402PaymentDemand) {
    const grossAmount = BigInt(demand.amount);
    return BosYieldSplitter.calculateYieldSplit(grossAmount);
  }
}
