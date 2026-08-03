/**
 * Conxian Verification Module.
 *
 * Real verification of attestation proofs via conxian-gateway
 * and conxian-nexus REST APIs. Replaces the stub verifier functions
 * in fee_calculator.ts with actual API-driven verification.
 *
 * P0-gated: attestation verification returns ObserverOnly until
 * enclave-sdk P0-1..P0-3 (AWS Nitro, Android KeyMint, attestation roots) resolve.
 */

import type { AttestationCertificate, FeatureFlags, TrustTier } from "./core_types.ts";
import { TrustTier as Tier } from "./core_types.ts";
import { DEFAULT_FEATURE_FLAGS } from "./core_types.ts";
import type { GatewayClient } from "./gateway_client.ts";

// ── Verifier Interface ──

export interface Verifier {
  verifyTeeZk(teeProof: string, zkProof: string): Promise<boolean>;
  verifyEnclave(proof: string): Promise<boolean>;
  verifyLight(proof: string): Promise<boolean>;
  detectTier(cert: AttestationCertificate): Promise<TrustTier>;
}

// ── Gateway-Backed Verifier ──

export class GatewayVerifier implements Verifier {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly flags: FeatureFlags = DEFAULT_FEATURE_FLAGS,
  ) {}

  async verifyTeeZk(teeProof: string, zkProof: string): Promise<boolean> {
    if (!this.flags.attestationAvailable) return false; // P0-1..P0-3 gate
    try {
      const result = await this.gateway.verifyAttestation({ teeProof, zkProof });
      return result.valid && result.tier === Tier.Strict;
    } catch {
      return false;
    }
  }

  async verifyEnclave(proof: string): Promise<boolean> {
    if (!this.flags.attestationAvailable) return false; // P0-1..P0-3 gate
    try {
      const result = await this.gateway.verifyAttestation({ enclaveAttestation: proof });
      return result.valid && result.tier === Tier.Managed;
    } catch {
      return false;
    }
  }

  async verifyLight(proof: string): Promise<boolean> {
    // Light client verification is always available (SPV/MMR)
    try {
      const result = await this.gateway.verifyAttestation({ lightProof: proof });
      return result.valid && result.tier === Tier.Expedient;
    } catch {
      return false;
    }
  }

  async detectTier(cert: AttestationCertificate): Promise<TrustTier> {
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
