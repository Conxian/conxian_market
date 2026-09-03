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
});
