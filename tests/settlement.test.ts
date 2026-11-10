import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FEATURE_FLAGS, SettlementRail, TrustTier } from "../src/core_types";
import { GatewayClient } from "../src/gateway_client";
import { RAIL_CAPABILITIES, SettlementOrchestrator } from "../src/settlement";
import { GatewayVerifier } from "../src/verification";

describe("settlement", () => {
  it("RAIL_CAPABILITIES exposes 8 settlement rails with metadata", () => {
    expect(RAIL_CAPABILITIES.length).toBe(8);
    const sbtc = RAIL_CAPABILITIES.find((r) => r.rail === SettlementRail.Sbtc);
    expect(sbtc).toBeDefined();
    expect(sbtc?.ready).toBe(true);
  });

  describe("SettlementOrchestrator", () => {
    it("isRailAvailable checks tier permissions correctly", () => {
      const orchestrator = new SettlementOrchestrator(
        {} as GatewayClient,
        {} as GatewayVerifier,
      );

      expect(orchestrator.isRailAvailable(TrustTier.ObserverOnly, SettlementRail.Sbtc)).toBe(false);
      expect(orchestrator.isRailAvailable(TrustTier.Expedient, SettlementRail.Lightning)).toBe(true);
      expect(orchestrator.isRailAvailable(TrustTier.Managed, SettlementRail.Statechain)).toBe(false);
    });

    it("verifyNonCustodialSettlementProof handles attestation validation", async () => {
      const mockVerifier = {
        verifyAttestation: vi.fn().mockResolvedValue({
          valid: true,
          tier: TrustTier.Managed,
        }),
      } as unknown as GatewayVerifier;

      const orchestrator = new SettlementOrchestrator({} as GatewayClient, mockVerifier);

      const res = await orchestrator.verifyNonCustodialSettlementProof("settle-proof-1", {
        tee_proof: "0xtee_proof_bytes",
      });

      expect(res.settlementId).toBe("settle-proof-1");
      expect(res.verified).toBe(true);
      expect(res.proofType).toBe("TEE");
      expect(res.isZeroCustodyConfirmed).toBe(true);
    });

    it("execute handles rail unavailable error", async () => {
      const orchestrator = new SettlementOrchestrator(
        {} as GatewayClient,
        {} as GatewayVerifier,
      );

      const res = await orchestrator.execute({
        id: "req-1",
        amountSat: 10_000n,
        rail: SettlementRail.Statechain, // Not available in Expedient
        tier: TrustTier.Expedient,
        builderId: "builder-1",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("not available at tier");
    });

    it("execute calls gateway settleJobCard on valid request", async () => {
      const mockGateway = {
        settleJobCard: vi.fn().mockResolvedValue({
          success: true,
          settlementId: "req-1",
          fee: {
            settlementId: "req-1",
            rail: SettlementRail.Lightning,
            tier: TrustTier.Expedient,
            amountSat: 10_000n,
            feeSat: 175n,
            feeBps: 175,
            timestamp: 1000,
            builderId: "builder-1",
          },
          rail: SettlementRail.Lightning,
        }),
      } as unknown as GatewayClient;

      const mockVerifier = {
        detectTier: vi.fn().mockResolvedValue(TrustTier.Expedient),
      } as unknown as GatewayVerifier;

      const orchestrator = new SettlementOrchestrator(mockGateway, mockVerifier);

      const res = await orchestrator.execute({
        id: "req-1",
        amountSat: 10_000n,
        rail: SettlementRail.Lightning,
        tier: TrustTier.Expedient,
        builderId: "builder-1",
        attestation: { light_proof: "light-proof" },
      });

      expect(res.success).toBe(true);
      expect(mockGateway.settleJobCard).toHaveBeenCalled();
    });

    it("does not trust a requested tier without verified attestation", async () => {
      const mockGateway = {
        settleJobCard: vi.fn(),
      } as unknown as GatewayClient;
      const orchestrator = new SettlementOrchestrator(mockGateway, {} as GatewayVerifier);

      const res = await orchestrator.execute({
        id: "forged-tier",
        amountSat: 10_000n,
        rail: SettlementRail.Lightning,
        tier: TrustTier.Expedient,
        builderId: "builder-1",
      });

      expect(res.success).toBe(false);
      expect(mockGateway.settleJobCard).not.toHaveBeenCalled();
    });

    it("does not execute a feature-gated rail", async () => {
      const mockGateway = { settleJobCard: vi.fn() } as unknown as GatewayClient;
      const mockVerifier = {
        detectTier: vi.fn().mockResolvedValue(TrustTier.Managed),
      } as unknown as GatewayVerifier;
      const orchestrator = new SettlementOrchestrator(mockGateway, mockVerifier);

      const res = await orchestrator.execute({
        id: "gated-rail",
        amountSat: 10_000n,
        rail: SettlementRail.Statechain,
        tier: TrustTier.Managed,
        builderId: "builder-1",
        attestation: { enclave_attestation: "enclave-proof" },
      });

      expect(res.success).toBe(false);
      expect(mockGateway.settleJobCard).not.toHaveBeenCalled();
    });
  });

  describe("DLC CET path", () => {
    it("createDlcCet fails closed when the gateway does not advertise DLC support", async () => {
      const mockGateway = { createDlcCet: vi.fn() } as unknown as GatewayClient;
      const mockVerifier = {} as GatewayVerifier;
      const orchestrator = new SettlementOrchestrator(mockGateway, mockVerifier, {
        ...DEFAULT_FEATURE_FLAGS,
        dlcCetAvailable: false,
      });

      await expect(
        orchestrator.createDlcCet({
          contractId: "dlc-1",
          outcome: "up",
          oracleNonce: "02".repeat(33),
          signerSecret: "11".repeat(32),
          signerNonce: "22".repeat(32),
          spec: {
            partyAPubkey: "a",
            partyBPubkey: "b",
            partyAPayoutAddress: "bc1qa",
            partyBPayoutAddress: "bc1qb",
            totalCollateralSats: 100_000,
            oraclePubkey: "02".repeat(33),
            eventId: "evt",
            refundLocktime: 1,
            fundingInputs: [],
            outcomes: [{ outcome: "up", partyAPayoutSats: 1, partyBPayoutSats: 1 }],
          },
        }),
      ).rejects.toThrow(/does not advertise DLC support/);
      expect(mockGateway.createDlcCet).not.toHaveBeenCalled();
    });

    it("createDlcCet delegates to the gateway when DLC support is enabled", async () => {
      const expected = {
        contractId: "dlc-1",
        outcome: "up",
        cetTxid: "tx",
        cetSighash: "sh",
        adaptedNonce: "02".repeat(33),
        adaptorScalar: "33".repeat(32),
        completedSignature: null,
        broadcastReady: false,
      };
      const mockGateway = {
        createDlcCet: vi.fn().mockResolvedValue(expected),
      } as unknown as GatewayClient;
      const orchestrator = new SettlementOrchestrator(mockGateway, {} as GatewayVerifier, {
        ...DEFAULT_FEATURE_FLAGS,
        dlcCetAvailable: true,
      });

      const res = await orchestrator.createDlcCet({
        contractId: "dlc-1",
        outcome: "up",
        oracleNonce: "02".repeat(33),
        signerSecret: "11".repeat(32),
        signerNonce: "22".repeat(32),
        spec: {
          partyAPubkey: "a",
          partyBPubkey: "b",
          partyAPayoutAddress: "bc1qa",
          partyBPayoutAddress: "bc1qb",
          totalCollateralSats: 100_000,
          oraclePubkey: "02".repeat(33),
          eventId: "evt",
          refundLocktime: 1,
          fundingInputs: [],
          outcomes: [{ outcome: "up", partyAPayoutSats: 1, partyBPayoutSats: 1 }],
        },
      });

      expect(res.broadcastReady).toBe(false);
      expect(mockGateway.createDlcCet).toHaveBeenCalledTimes(1);
    });
  });
});
