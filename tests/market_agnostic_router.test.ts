import { describe, expect, it } from "vitest";
import { SettlementRail } from "../src/core_types";
import { MarketAgnosticRouter } from "../src/market_agnostic_router";

describe("MarketAgnosticRouter", () => {
  it("validates zero-custody compliance correctly", () => {
    // Compliant zero-custody request
    const validRequest = MarketAgnosticRouter.validateZeroCustody({
      id: "settle-001",
      sourceWalletAddress: "bc1qsource...",
      destinationWalletAddress: "bc1qdest...",
      amountSat: 100_000n,
      rail: SettlementRail.Lightning,
      isClientKeyIsolated: true,
      storesClientDataOnHub: false,
    });

    expect(validRequest.isZeroCustodyCompliant).toBe(true);
    expect(validRequest.custodyRiskLevel).toBe("ZERO");
    expect(validRequest.violations.length).toBe(0);

    // Non-compliant request (key on server & data stored)
    const invalidRequest = MarketAgnosticRouter.validateZeroCustody({
      id: "settle-002",
      sourceWalletAddress: "bc1qsame...",
      destinationWalletAddress: "bc1qsame...",
      amountSat: 100_000n,
      rail: SettlementRail.Lightning,
      isClientKeyIsolated: false,
      storesClientDataOnHub: true,
    });

    expect(invalidRequest.isZeroCustodyCompliant).toBe(false);
    expect(invalidRequest.custodyRiskLevel).toBe("CRITICAL");
    expect(invalidRequest.violations.length).toBeGreaterThan(0);
  });

  it("resolves external BYO DeFi protocol adapters", () => {
    const sbtcAdapter = MarketAgnosticRouter.resolveDefiAdapter(SettlementRail.Sbtc);
    expect(sbtcAdapter.protocolName).toContain("ALEX");
    expect(sbtcAdapter.isExternalAuditedProtocol).toBe(true);

    const evmAdapter = MarketAgnosticRouter.resolveDefiAdapter(SettlementRail.EvmErc8183);
    expect(evmAdapter.protocolName).toContain("Uniswap");
    expect(evmAdapter.type).toBe("ESCROW_STANDARD");

    const customAdapter = MarketAgnosticRouter.resolveDefiAdapter(SettlementRail.EvmErc8183, "Custom Aerodrome Pool");
    expect(customAdapter.protocolName).toBe("Custom Aerodrome Pool");
  });

  it("routes M2M agent settlements non-custodially via MCP context", () => {
    const route = MarketAgnosticRouter.routeM2mSettlement(
      "did:conxian:agent-alice",
      "did:conxian:agent-bob",
      50_000n,
      SettlementRail.Lightning
    );

    expect(route.isNonCustodial).toBe(true);
    expect(route.mcpContextWire["x-conxian-m2m-from"]).toBe("did:conxian:agent-alice");
    expect(route.mcpContextWire["x-conxian-zero-custody"]).toBe("true");
  });

  it("exposes formal deprecation advisory for Conxian/Conxian", () => {
    const advisory = MarketAgnosticRouter.getDeprecationAdvisory();

    expect(advisory.targetRepo).toBe("Conxian/Conxian");
    expect(advisory.status).toBe("DEPRECATED_RECOMMENDED_ARCHIVE");
    expect(advisory.keyBenefits.length).toBeGreaterThan(0);
  });
});
