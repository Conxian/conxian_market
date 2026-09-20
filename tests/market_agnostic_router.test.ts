import { describe, expect, it, vi } from "vitest";
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

  it("emits runtime deprecation notice with console warning logging", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const notice = MarketAgnosticRouter.emitDeprecationNotice("Conxian/Conxian:legacy-vault", false);

    expect(notice.targetContract).toBe("Conxian/Conxian:legacy-vault");
    expect(notice.warning).toContain("DEPRECATION NOTICE");
    expect(notice.actionTaken).toContain("re-routed");
    expect(notice.advisory.targetRepo).toBe("Conxian/Conxian");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[CONXIAN_DEPRECATION_WARNING]"));

    consoleSpy.mockRestore();
  });

  it("detects direct contract call in validateZeroCustody and attaches deprecation notice", () => {
    const res = MarketAgnosticRouter.validateZeroCustody({
      id: "settle-direct-01",
      sourceWalletAddress: "0xalice",
      destinationWalletAddress: "0xbob",
      amountSat: 25_000n,
      rail: SettlementRail.EvmErc8183,
      isClientKeyIsolated: true,
      storesClientDataOnHub: false,
      isDirectContractCall: true,
      targetContractAddress: "0xLegacyProprietaryContract",
      suppressConsole: true,
    });

    expect(res.isZeroCustodyCompliant).toBe(true);
    expect(res.isDirectContractCallDetected).toBe(true);
    expect(res.deprecationNotice).toBeDefined();
    expect(res.deprecationNotice?.targetContract).toBe("0xLegacyProprietaryContract");
  });

  it("intercepts direct contract call during M2M settlement routing and redirects via BYO adapter", () => {
    const route = MarketAgnosticRouter.routeM2mSettlement(
      "did:conxian:agent-alice",
      "did:conxian:agent-bob",
      100_000n,
      SettlementRail.Sbtc,
      undefined,
      {
        isDirectContractCall: true,
        targetContractAddress: "SP3K8...legacy-clarity-amm",
        suppressConsole: true,
      }
    );

    expect(route.isDirectContractCallIntercepted).toBe(true);
    expect(route.deprecationNotice).toBeDefined();
    expect(route.adapter.protocolName).toContain("ALEX");
    expect(route.mcpContextWire["x-conxian-direct-contract-intercepted"]).toBe("true");
  });

  it("executes routeDirectContractCall to intercept direct contract calls and produce complete route result", () => {
    const result = MarketAgnosticRouter.routeDirectContractCall({
      targetContractAddress: "0xProprietaryVaultContract",
      methodName: "depositAndSwap",
      rail: SettlementRail.EvmErc8183,
      fromAgentDid: "did:conxian:agent-alice",
      toAgentDid: "did:conxian:agent-bob",
      amountSat: 75_000n,
      suppressConsole: true,
    });

    expect(result.isDirectCallIntercepted).toBe(true);
    expect(result.originalTargetContract).toBe("0xProprietaryVaultContract");
    expect(result.deprecationNotice.actionTaken).toContain("re-routed");
    expect(result.assignedAdapter.protocolName).toContain("Uniswap");
    expect(result.m2mRoute.isNonCustodial).toBe(true);
    expect(result.m2mRoute.isDirectContractCallIntercepted).toBe(true);
  });
});
