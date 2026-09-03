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
});