import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayClient } from "../src/gateway_client";
import { SettlementRail, TrustTier } from "../src/core_types";

describe("GatewayClient", () => {
  afterEach(() => vi.restoreAllMocks());

  it("serializes bigint settlement amounts as decimal strings", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        settlementId: "settle-1",
        fee: {
          settlementId: "settle-1",
          rail: SettlementRail.Lightning,
          tier: TrustTier.Expedient,
          amountSat: "10000",
          feeSat: "175",
          feeBps: 175,
          timestamp: 1,
          builderId: "builder-1",
        },
        rail: SettlementRail.Lightning,
      })),
    );
    const client = new GatewayClient({ baseUrl: "https://gateway.example" });

    await client.settleJobCard({
      id: "settle-1",
      title: "Settlement settle-1",
      description: "",
      bountySat: 10_000n,
      rail: SettlementRail.Lightning,
      tier: TrustTier.Expedient,
      status: "COMPLETED",
      builderId: "builder-1",
      createdAt: 1,
    });

    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.body).toContain('"bountySat":"10000"');
  });

  it("emits X-Conxian-Fee headers on a job-card settlement (#361)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        settlementId: "settle-1",
        fee: {
          settlementId: "settle-1",
          rail: SettlementRail.Lightning,
          tier: TrustTier.Expedient,
          amountSat: "10000",
          feeSat: "175",
          feeBps: 175,
          timestamp: 1,
          builderId: "builder-1",
        },
        rail: SettlementRail.Lightning,
      })),
    );
    const client = new GatewayClient({ baseUrl: "https://gateway.example" });

    await client.settleJobCard({
      id: "settle-1",
      title: "Settlement settle-1",
      description: "",
      bountySat: 10_000n,
      rail: SettlementRail.Lightning,
      tier: TrustTier.Expedient,
      status: "COMPLETED",
      builderId: "builder-1",
      createdAt: 1,
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    // 50 bps of 10,000 = 50 sat, above the 10-sat Lightning floor.
    expect(headers["x-conxian-fee-bps"]).toBe("50");
    expect(headers["x-conxian-fee-sat"]).toBe("50");
    expect(headers["x-conxian-tier"]).toBe(TrustTier.Expedient);
    expect(headers["x-conxian-rail"]).toBe(SettlementRail.Lightning);
  });

  it("does not report the fee when reporting is disabled (#359)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        settlementId: "settle-1",
        fee: {
          settlementId: "settle-1",
          rail: SettlementRail.Lightning,
          tier: TrustTier.Expedient,
          amountSat: "10000",
          feeSat: "50",
          feeBps: 50,
          timestamp: 1,
          builderId: "builder-1",
        },
        rail: SettlementRail.Lightning,
      })),
    );
    const client = new GatewayClient({ baseUrl: "https://gateway.example" });

    await client.settleJobCard({
      id: "settle-1",
      title: "Settlement settle-1",
      description: "",
      bountySat: 10_000n,
      rail: SettlementRail.Lightning,
      tier: TrustTier.Expedient,
      status: "COMPLETED",
      builderId: "builder-1",
      createdAt: 1,
    });

    const paths = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(paths.some((p) => p.includes("/v1/billing/fee-report"))).toBe(false);
  });

  it("submits the priced fee when reporting is enabled, fail-closed (#359)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/v1/billing/fee-report")) {
        return new Response(JSON.stringify({ received: true }));
      }
      return new Response(JSON.stringify({
        success: true,
        settlementId: "settle-1",
        fee: {
          settlementId: "settle-1",
          rail: SettlementRail.Lightning,
          tier: TrustTier.Expedient,
          amountSat: "10000",
          feeSat: "50",
          feeBps: 50,
          timestamp: 1,
          builderId: "builder-1",
        },
        rail: SettlementRail.Lightning,
      }));
    });
    const client = new GatewayClient({
      baseUrl: "https://gateway.example",
      feeReporting: { enabled: true },
    });

    await client.settleJobCard({
      id: "settle-1",
      title: "Settlement settle-1",
      description: "",
      bountySat: 10_000n,
      rail: SettlementRail.Lightning,
      tier: TrustTier.Expedient,
      status: "COMPLETED",
      builderId: "builder-1",
      createdAt: 1,
    });

    const reportCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/v1/billing/fee-report"));
    expect(reportCall).toBeDefined();
    const body = JSON.parse(String(reportCall?.[1]?.body));
    expect(body.totalFeesSat).toBe("50");
    expect(body.byRail[0].rail).toBe(SettlementRail.Lightning);
  });
});