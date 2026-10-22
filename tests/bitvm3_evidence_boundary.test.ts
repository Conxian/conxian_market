import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FEATURE_FLAGS, TrustTier, type BitVM3GarbledCircuitProof } from "../src/core_types.js";
import type { GatewayClient } from "../src/gateway_client.js";
import { GatewayVerifier, UniversalVerificationAdapter } from "../src/verification.js";

const metadata: BitVM3GarbledCircuitProof = {
  proofId: "research-only",
  circuitDigest: "x",
  garbledTableHash: "x",
  challengeResponse: "x",
  nexusEngineVersion: "v0.4.23",
  estimatedChallengeCostUsd: 0,
  timestampIso: "2000-01-01T00:00:00Z",
};

describe.each([false, true])("BitVM3 evidence boundary (attestation flag %s)", (attestationAvailable) => {
  const flags = { ...DEFAULT_FEATURE_FLAGS, attestationAvailable };

  it.each([0, 42.5, 150, -1, NaN, Infinity])("never treats a claimed cost %s as verification", async (cost) => {
    const call = vi.fn().mockRejectedValue(new Error("unavailable"));
    const verifier = new GatewayVerifier({ verifyAttestation: call } as unknown as GatewayClient, flags);
    const proof = { ...metadata, estimatedChallengeCostUsd: cost };
    expect(await verifier.verifyBitVM3Proof(proof)).toMatchObject({
      valid: false, tier: TrustTier.ObserverOnly,
      error: "BitVM3 verification unavailable: qualified cryptographic backend required",
    });
    expect(await verifier.verifyAttestation({ bitvm3_proof: proof })).toMatchObject({
      valid: false, tier: TrustTier.ObserverOnly,
    });
    expect(await new UniversalVerificationAdapter(verifier).verifyUniversalProof({ bitvm3_proof: proof }))
      .toMatchObject({ valid: false, tier: TrustTier.ObserverOnly, methodUsed: "NONE" });
    expect(call).not.toHaveBeenCalled();
  });

  it("does not trust empty, version-shaped or replayed metadata", async () => {
    const verifier = new GatewayVerifier({} as GatewayClient, flags);
    for (const proof of [metadata, metadata, { ...metadata, circuitDigest: "", nexusEngineVersion: "trusted-v0.4.23-extra" }]) {
      expect(await verifier.detectTier({ bitvm3_proof: proof })).toBe(TrustTier.ObserverOnly);
    }
  });

  it("allows a separately verified light proof to establish only its own tier", async () => {
    const call = vi.fn().mockResolvedValue({ valid: true, tier: TrustTier.Expedient });
    const verifier = new GatewayVerifier({ verifyAttestation: call } as unknown as GatewayClient, flags);
    const result = await new UniversalVerificationAdapter(verifier).verifyUniversalProof({
      bitvm3_proof: metadata, light_proof: "independently-checked",
    });
    expect(result).toMatchObject({ valid: true, tier: TrustTier.Expedient, methodUsed: "LIGHT_SPV" });
    expect(call).toHaveBeenCalledExactlyOnceWith({ lightProof: "independently-checked" });
  });

  it("retains rejection when a separate gateway verification fails", async () => {
    const call = vi.fn().mockRejectedValue(new Error("unavailable"));
    const verifier = new GatewayVerifier({ verifyAttestation: call } as unknown as GatewayClient, flags);
    expect(await verifier.verifyAttestation({ bitvm3_proof: metadata, light_proof: "unverified" }))
      .toMatchObject({ valid: false, tier: TrustTier.ObserverOnly });
  });
});
