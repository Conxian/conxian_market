import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FEATURE_FLAGS, TrustTier, type BitVM3GarbledCircuitProof } from "../src/core_types.js";
import { GatewayClient } from "../src/gateway_client.js";
import { GatewayVerifier, UniversalVerificationAdapter, degradeTierForP0Gaps, detectTrustTierStatic } from "../src/verification.js";

describe("verification", () => {
  describe("detectTrustTierStatic", () => {
    it("returns Strict if TEE and ZK proof headers present", () => {
      expect(
        detectTrustTierStatic({
          "x-conxian-tee-proof": "tee",
          "x-conxian-zk-proof": "zk",
        }),
      ).toBe(TrustTier.Strict);
    });

    it("returns Managed if enclave attestation header present", () => {
      expect(
        detectTrustTierStatic({
          "x-conxian-enclave-attestation": "enclave",
        }),
      ).toBe(TrustTier.Managed);
    });

    it("returns Expedient if light proof header present", () => {
      expect(
        detectTrustTierStatic({
          "x-conxian-light-proof": "light",
        }),
      ).toBe(TrustTier.Expedient);
    });

    it("returns ObserverOnly if no attestation header present", () => {
      expect(detectTrustTierStatic({})).toBe(TrustTier.ObserverOnly);
    });
  });

  describe("degradeTierForP0Gaps", () => {
    it("downgrades Strict to Expedient when attestation is disabled", () => {
      const flags = { ...DEFAULT_FEATURE_FLAGS, attestationAvailable: false };
      expect(degradeTierForP0Gaps(TrustTier.Strict, flags)).toBe(TrustTier.Expedient);
    });

    it("downgrades Managed to Expedient when attestation is disabled", () => {
      const flags = { ...DEFAULT_FEATURE_FLAGS, attestationAvailable: false };
      expect(degradeTierForP0Gaps(TrustTier.Managed, flags)).toBe(TrustTier.Expedient);
    });

    it("keeps tier unchanged when attestation is available", () => {
      const flags = { ...DEFAULT_FEATURE_FLAGS, attestationAvailable: true };
      expect(degradeTierForP0Gaps(TrustTier.Strict, flags)).toBe(TrustTier.Strict);
      expect(degradeTierForP0Gaps(TrustTier.Managed, flags)).toBe(TrustTier.Managed);
    });
  });

  describe("GatewayVerifier & BitVM3 Proofs", () => {
    const mockGateway = {} as GatewayClient;
    const verifier = new GatewayVerifier(mockGateway, {
      ...DEFAULT_FEATURE_FLAGS,
      attestationAvailable: true,
    });

    const validBitVM3Proof: BitVM3GarbledCircuitProof = {
      proofId: "proof-123",
      circuitDigest: "0x123abc",
      garbledTableHash: "0x456def",
      challengeResponse: "0x789ghi",
      nexusEngineVersion: "conxian-nexus-v0.4.23",
      estimatedChallengeCostUsd: 42.50, // under $50 limit
      timestampIso: new Date().toISOString(),
    };

    it("reports unavailable for structurally populated research input", async () => {
      const result = await verifier.verifyBitVM3Proof(validBitVM3Proof);
      expect(result.valid).toBe(false);
      expect(result.tier).toBe(TrustTier.ObserverOnly);
      expect(result.challengeCostUsd).toBe(42.50);
    });

    it("rejects BitVM3 proof if challenge cost exceeds $50 CXIP-1317 threshold", async () => {
      const expensiveProof: BitVM3GarbledCircuitProof = {
        ...validBitVM3Proof,
        estimatedChallengeCostUsd: 150.00,
      };

      const result = await verifier.verifyBitVM3Proof(expensiveProof);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("qualified cryptographic backend required");
    });

    it("does not elevate a certificate from BitVM3 metadata", async () => {
      const tier = await verifier.detectTier({
        bitvm3_proof: validBitVM3Proof,
      });
      expect(tier).toBe(TrustTier.ObserverOnly);
    });

    it.each([
      { verified: true },
      { verified: true, signerPublicKey: "attacker", signature: "forged" },
      { verified: true, commitmentHash: "0x123abc", executionInputHash: "input", nonce: "reused", measuredChallengeCostUsd: 1, verifiedAtIso: "2000-01-01T00:00:00Z" },
      { verified: true, measuredChallengeCostUsd: Number.NaN },
      { verified: true, measuredChallengeCostUsd: -1 },
    ])("never trusts caller-supplied verification claims: %j", async (authenticatedResult) => {
      const proof = { ...validBitVM3Proof, executionInputHash: "input", nonce: "reused", authenticatedResult };
      for (let attempt = 0; attempt < 2; attempt++) {
        for (const result of [await verifier.verifyBitVM3Proof(proof), await verifier.verifyBitVM3ProofWithBoundary(proof)]) {
          expect(result.valid).toBe(false);
          expect(result.tier).toBe(TrustTier.ObserverOnly);
          expect(result.error).toContain("qualified cryptographic backend required");
        }
        expect(await verifier.detectTier({ bitvm3_proof: proof })).toBe(TrustTier.ObserverOnly);
        expect((await verifier.verifyAttestation({ bitvm3_proof: proof })).valid).toBe(false);
        const universal = await new UniversalVerificationAdapter(verifier).verifyUniversalProof({ bitvm3_proof: proof });
        expect(universal.valid).toBe(false);
        expect(universal.tier).toBe(TrustTier.ObserverOnly);
      }
    });
  });

  describe("UniversalVerificationAdapter", () => {
    const mockGateway = {
      verifyAttestation: vi.fn().mockImplementation(async (params) => {
        if (params.lightProof) return { valid: true, tier: TrustTier.Expedient };
        return { valid: false };
      }),
    } as unknown as GatewayClient;

    const verifier = new GatewayVerifier(mockGateway, {
      ...DEFAULT_FEATURE_FLAGS,
      attestationAvailable: true,
    });
    const adapter = new UniversalVerificationAdapter(verifier);

    it("rejects a BitVM3-only certificate", async () => {
      const result = await adapter.verifyUniversalProof({
        bitvm3_proof: {
          proofId: "p1",
          circuitDigest: "cd1",
          garbledTableHash: "gth1",
          challengeResponse: "cr1",
          nexusEngineVersion: "v0.4.23",
          estimatedChallengeCostUsd: 25.0,
          timestampIso: new Date().toISOString(),
        },
      });

      expect(result.valid).toBe(false);
      expect(result.tier).toBe(TrustTier.ObserverOnly);
      expect(result.methodUsed).toBe("NONE");
    });

    it("verifies proof using SPV light client fallback method", async () => {
      const result = await adapter.verifyUniversalProof({
        light_proof: "spv-proof-header",
      });

      expect(result.valid).toBe(true);
      expect(result.tier).toBe(TrustTier.Expedient);
      expect(result.methodUsed).toBe("LIGHT_SPV");
    });
  });

  describe("GatewayVerifier Capabilities", () => {
    it("reports P0 gaps when attestation is disabled", () => {
      const mockGateway = {} as GatewayClient;
      const verifier = new GatewayVerifier(mockGateway, {
        ...DEFAULT_FEATURE_FLAGS,
        attestationAvailable: false,
      });

      const caps = verifier.getCapabilities();
      expect(caps.attestationAvailable).toBe(false);
      expect(caps.supportedTiers).toEqual([TrustTier.ObserverOnly, TrustTier.Expedient]);
      expect(caps.p0Gaps.length).toBeGreaterThan(0);
      expect(caps.p0Gaps[0]).toContain("enclave-sdk#242");
    });

    it("reports full tier support when attestation is enabled", () => {
      const mockGateway = {} as GatewayClient;
      const verifier = new GatewayVerifier(mockGateway, {
        ...DEFAULT_FEATURE_FLAGS,
        attestationAvailable: true,
      });

      const caps = verifier.getCapabilities();
      expect(caps.attestationAvailable).toBe(true);
      expect(caps.supportedTiers).toEqual([
        TrustTier.ObserverOnly,
        TrustTier.Expedient,
        TrustTier.Managed,
        TrustTier.Strict,
      ]);
      expect(caps.p0Gaps.length).toBe(0);
    });
  });
});
