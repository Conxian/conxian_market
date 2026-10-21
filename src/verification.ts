/**
 * Conxian Gateway Verifier — Attestation & TrustTier Detection.
 *
 * Integrates with conxian-gateway / conxian-nexus for TEE, ZK, Enclave, Light, and BitVM3 proof
 * verification. Degrades tiers gracefully when P0 attestation gaps exist.
 *
 * Tiers:
 *   - Strict:       Gateway-verified TEE (Nitro/KeyMint) + ZK proof
 *   - BitVM3:       Research input only; qualified verification backend unavailable
 *   - Managed:      Enclave attestation without ZK proof
 *   - Expedient:    Light client proof (SPV/MMR)
 *   - ObserverOnly: No proof (read-only)
 */

import type {
  AttestationCertificate,
  BitVM3GarbledCircuitProof,
  FeatureFlags,
  TrustTier,
} from "./core_types.js";
import { TrustTier as Tier } from "./core_types.js";
import { DEFAULT_FEATURE_FLAGS } from "./core_types.js";
import type { GatewayClient } from "./gateway_client.js";

export interface AttestationCapabilities {
  attestationAvailable: boolean;
  supportedTiers: TrustTier[];
  p0Gaps: string[];
}

export interface Verifier {
  detectTier(cert: AttestationCertificate): Promise<TrustTier>;
  verifyAttestation(cert: AttestationCertificate): Promise<{ valid: boolean; tier: TrustTier; error?: string }>;
  verifyTeeZk(teeProof: string, zkProof: string): Promise<boolean>;
  verifyEnclave(proof: string): Promise<boolean>;
  verifyLight(proof: string): Promise<boolean>;
  verifyBitVM3Proof(proof: BitVM3GarbledCircuitProof): Promise<{ valid: boolean; tier: TrustTier; challengeCostUsd: number; error?: string }>;
  getCapabilities(): AttestationCapabilities;
}

export class GatewayVerifier implements Verifier {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly flags: FeatureFlags = DEFAULT_FEATURE_FLAGS,
  ) {}

  getCapabilities(): AttestationCapabilities {
    const p0Gaps: string[] = [];
    if (!this.flags.attestationAvailable) {
      p0Gaps.push(
        "enclave-sdk#242 (AWS Nitro TEE)",
        "enclave-sdk#241 (Android KeyMint TEE)",
        "enclave-sdk#240 (Attestation Roots)"
      );
    }
    return {
      attestationAvailable: this.flags.attestationAvailable,
      supportedTiers: this.flags.attestationAvailable
        ? [Tier.ObserverOnly, Tier.Expedient, Tier.Managed, Tier.Strict]
        : [Tier.ObserverOnly, Tier.Expedient],
      p0Gaps,
    };
  }

  async verifyTeeZk(teeProof: string, zkProof: string): Promise<boolean> {
    if (!this.flags.attestationAvailable) return false; // P0-1..P0-3 gate
    try {
      const result = await this.gateway.verifyAttestation({ teeProof, zkProof });
      return result.valid === true && result.tier === Tier.Strict;
    } catch {
      return false;
    }
  }

  async verifyEnclave(proof: string): Promise<boolean> {
    if (!this.flags.attestationAvailable) return false; // P0-1..P0-3 gate
    try {
      const result = await this.gateway.verifyAttestation({ enclaveAttestation: proof });
      return result.valid === true && result.tier === Tier.Managed;
    } catch {
      return false;
    }
  }

  async verifyLight(proof: string): Promise<boolean> {
    // Light client verification is always available (SPV/MMR)
    try {
      const result = await this.gateway.verifyAttestation({ lightProof: proof });
      return result.valid === true && result.tier === Tier.Expedient;
    } catch {
      return false;
    }
  }

  async verifyBitVM3Proof(
    proof: BitVM3GarbledCircuitProof
  ): Promise<{ valid: boolean; tier: TrustTier; challengeCostUsd: number; error?: string }> {
    return this.verifyBitVM3ProofWithBoundary(proof);
  }

  /**
   * Retains the proposed BitVM3 boundary API for research compatibility.
   * Always fails closed until independently authenticated verification is wired.
   */
  async verifyBitVM3ProofWithBoundary(
    proof: BitVM3GarbledCircuitProof
  ): Promise<{ valid: boolean; tier: TrustTier; challengeCostUsd: number; error?: string }> {
    // The envelope and any embedded result are caller-controlled research data.
    // No qualified issuer/signature/freshness/replay verifier is wired here.
    // Preserve the candidate API without allowing metadata to establish trust.
    return {
      valid: false,
      tier: Tier.ObserverOnly,
      challengeCostUsd: proof.estimatedChallengeCostUsd,
      error: "BitVM3 verification unavailable: qualified cryptographic backend required",
    };
  }

  async verifyAttestation(cert: AttestationCertificate): Promise<{ valid: boolean; tier: TrustTier; error?: string }> {
    const tier = await this.detectTier(cert);
    const valid = tier !== Tier.ObserverOnly;
    return {
      valid,
      tier,
      error: valid ? undefined : "Attestation certificate could not be verified for higher trust tier",
    };
  }

  async detectTier(cert: AttestationCertificate): Promise<TrustTier> {
    // BitVM3 garbled circuit fraud proof (CXIP-1317)
    if (cert.bitvm3_proof) {
      const bitvmRes = await this.verifyBitVM3ProofWithBoundary(cert.bitvm3_proof);
      if (bitvmRes.valid) {
        return bitvmRes.tier;
      }
    }

    // Strict: TEE + ZK proof
    if (cert.tee_proof && cert.zk_proof) {
      if (await this.verifyTeeZk(cert.tee_proof, cert.zk_proof)) {
        return Tier.Strict;
      }
    }

    // Managed: enclave attestation
    if (cert.enclave_attestation) {
      if (await this.verifyEnclave(cert.enclave_attestation)) {
        return Tier.Managed;
      }
    }

    // Expedient: light client proof
    if (cert.light_proof) {
      if (await this.verifyLight(cert.light_proof)) {
        return Tier.Expedient;
      }
    }

    return Tier.ObserverOnly;
  }
}

/**
 * Universal Verification Adapter (CXIP-1317)
 * Routes existing gateway verification methods. BitVM3 envelopes confer no trust.
 */
export class UniversalVerificationAdapter {
  constructor(private readonly verifier: GatewayVerifier) {}

  async verifyUniversalProof(cert: AttestationCertificate): Promise<{
    valid: boolean;
    tier: TrustTier;
    methodUsed: "TEE_ZK" | "ENCLAVE" | "LIGHT_SPV" | "BITVM3_GARBLED_CIRCUIT" | "NONE";
    details: string;
  }> {
    if (cert.bitvm3_proof) {
      const res = await this.verifier.verifyBitVM3ProofWithBoundary(cert.bitvm3_proof);
      if (res.valid) {
        return {
          valid: true,
          tier: res.tier,
          methodUsed: "BITVM3_GARBLED_CIRCUIT",
          details: `Verified BitVM3 garbled circuit fraud proof on Nexus ${cert.bitvm3_proof.nexusEngineVersion} (Cost: $${res.challengeCostUsd})`,
        };
      }
    }

    if (cert.tee_proof && cert.zk_proof) {
      const valid = await this.verifier.verifyTeeZk(cert.tee_proof, cert.zk_proof);
      if (valid) {
        return {
          valid: true,
          tier: Tier.Strict,
          methodUsed: "TEE_ZK",
          details: "Verified TEE + ZK hardware attestation proof",
        };
      }
    }

    if (cert.enclave_attestation) {
      const valid = await this.verifier.verifyEnclave(cert.enclave_attestation);
      if (valid) {
        return {
          valid: true,
          tier: Tier.Managed,
          methodUsed: "ENCLAVE",
          details: "Verified Enclave SDK attestation proof",
        };
      }
    }

    if (cert.light_proof) {
      const valid = await this.verifier.verifyLight(cert.light_proof);
      if (valid) {
        return {
          valid: true,
          tier: Tier.Expedient,
          methodUsed: "LIGHT_SPV",
          details: "Verified SPV/MMR light client proof",
        };
      }
    }

    return {
      valid: false,
      tier: Tier.ObserverOnly,
      methodUsed: "NONE",
      details: "No valid attestation proof found",
    };
  }
}

// ── Feature-Flag Aware Detection ──

/**
 * Detect tier with awareness of P0 gaps.
 *
 * Until P0-1..P0-3 resolve:
 *   - Strict → downgrades to Managed (or Expedient if Managed also gated)
 *   - Managed → downgrades to Expedient
 *   - Expedient → always available
 *   - ObserverOnly → always available
 */
export function degradeTierForP0Gaps(tier: TrustTier, flags: FeatureFlags): TrustTier {
  if (tier === Tier.Strict && !flags.attestationAvailable) {
    return flags.attestationAvailable ? Tier.Strict : Tier.Expedient;
  }
  if (tier === Tier.Managed && !flags.attestationAvailable) {
    return Tier.Expedient;
  }
  return tier;
}

// ── Static Tier Detection (no API calls — for offline use) ──

export function detectTrustTierStatic(headers: {
  "x-conxian-tee-proof"?: string;
  "x-conxian-zk-proof"?: string;
  "x-conxian-enclave-attestation"?: string;
  "x-conxian-light-proof"?: string;
}): TrustTier {
  if (headers["x-conxian-tee-proof"] && headers["x-conxian-zk-proof"]) {
    return Tier.Strict;
  }
  if (headers["x-conxian-enclave-attestation"]) {
    return Tier.Managed;
  }
  if (headers["x-conxian-light-proof"]) {
    return Tier.Expedient;
  }
  return Tier.ObserverOnly;
}
