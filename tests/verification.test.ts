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

    it("verifies valid BitVM3 garbled circuit fraud proof", async () => {
      const result = await verifier.verifyBitVM3Proof(validBitVM3Proof);
      expect(result.valid).toBe(true);
      expect(result.tier).toBe(TrustTier.Strict);
      expect(result.challengeCostUsd).toBe(42.50);
    });

    it("rejects BitVM3 proof if challenge cost exceeds $50 CXIP-1317 threshold", async () => {
      const expensiveProof: BitVM3GarbledCircuitProof = {
        ...validBitVM3Proof,
        estimatedChallengeCostUsd: 150.00,
      };

      const result = await verifier.verifyBitVM3Proof(expensiveProof);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds CXIP-1317 $50 compression limit");
    });

    it("detects Strict tier from certificate with BitVM3 proof", async () => {
      const tier = await verifier.detectTier({
        bitvm3_proof: validBitVM3Proof,
      });
      expect(tier).toBe(TrustTier.Strict);
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

    it("verifies proof using BitVM3 garbled circuit method", async () => {
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

      expect(result.valid).toBe(true);
      expect(result.tier).toBe(TrustTier.Strict);
      expect(result.methodUsed).toBe("BITVM3_GARBLED_CIRCUIT");
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
