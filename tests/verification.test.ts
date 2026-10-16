import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FEATURE_FLAGS, TrustTier } from "../src/core_types";
import { GatewayClient } from "../src/gateway_client";
import { GatewayVerifier, degradeTierForP0Gaps, detectTrustTierStatic } from "../src/verification";

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

  describe("GatewayVerifier", () => {
    it("verifyTeeZk returns false when attestationAvailable is false", async () => {
      const mockGateway = {} as GatewayClient;
      const verifier = new GatewayVerifier(mockGateway, {
        ...DEFAULT_FEATURE_FLAGS,
        attestationAvailable: false,
      });

      const res = await verifier.verifyTeeZk("tee", "zk");
      expect(res).toBe(false);
    });

    it("verifyTeeZk calls gateway and returns true when valid and Strict", async () => {
      const mockGateway = {
        verifyAttestation: vi.fn().mockResolvedValue({ valid: true, tier: TrustTier.Strict }),
      } as unknown as GatewayClient;

      const verifier = new GatewayVerifier(mockGateway, {
        ...DEFAULT_FEATURE_FLAGS,
        attestationAvailable: true,
      });

      const res = await verifier.verifyTeeZk("tee", "zk");
      expect(res).toBe(true);
      expect(mockGateway.verifyAttestation).toHaveBeenCalledWith({ teeProof: "tee", zkProof: "zk" });
    });
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

  describe("BitVM3 Garbled Circuit Proofs & Universal Verification Adapter (CXIP-1317)", () => {
    it("verifies valid BitVM3 garbled circuit proof with sub-$50 challenge cost on Nexus v0.4.23", async () => {
      const { UniversalVerificationAdapter } = await import("../src/verification.js");
      const mockGateway = {} as GatewayClient;
      const verifier = new GatewayVerifier(mockGateway);
      const adapter = new UniversalVerificationAdapter(verifier);

      const res = await adapter.verifyUniversalProof({
        bitvm3_proof: {
          circuitDigest: "0xabcdef1234567890",
          garbledTableHash: "0x9876543210fedcba",
          wireCommitments: ["0xwire1", "0xwire2"],
          challengeResponse: "0xchallengeresponse",
          estimatedChallengeCostUsd: 42.50, // sub-$50
          nexusEngineVersion: "v0.4.23-bitvm3",
        },
      });

      expect(res.valid).toBe(true);
      expect(res.tier).toBe(TrustTier.Strict);
      expect(res.methodUsed).toBe("BITVM3_GARBLED_CIRCUIT");
      expect(res.details).toContain("Nexus v0.4.23-bitvm3");
      expect(res.details).toContain("Cost: $42.5");
    });

    it("rejects BitVM3 proof if challenge cost exceeds $50 target", async () => {
      const mockGateway = {} as GatewayClient;
      const verifier = new GatewayVerifier(mockGateway);

      const res = await verifier.verifyBitVM3Proof({
        circuitDigest: "0xabcdef",
        garbledTableHash: "0x987654",
        wireCommitments: ["0xwire1"],
        challengeResponse: "0xresponse",
        estimatedChallengeCostUsd: 150.00, // Exceeds $50
        nexusEngineVersion: "v0.4.23",
      });

      expect(res.valid).toBe(false);
      expect(res.error).toContain("exceeds CXIP-1317 $50 compression limit");
    });
  });
