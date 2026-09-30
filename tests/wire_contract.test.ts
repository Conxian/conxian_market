import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayClient } from "../src/gateway_client";
import { SettlementRail, TrustTier, type JobCard } from "../src/core_types";
import { SettlementResultSchema } from "../src/wire_contract";

const validSettlementResponse = {
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
};

const jobCard: JobCard = {
  id: "settle-1",
  title: "Settlement settle-1",
  description: "",
  bountySat: 10_000n,
  rail: SettlementRail.Lightning,
  tier: TrustTier.Expedient,
  status: "COMPLETED",
  builderId: "builder-1",
  createdAt: 1,
};

describe("SettlementResultSchema (wire contract)", () => {
  it("restores bigint monetary fields from the decimal-string wire format", () => {
    const parsed = SettlementResultSchema.parse(validSettlementResponse);
    expect(parsed.fee.amountSat).toBe(10_000n);
    expect(parsed.fee.feeSat).toBe(175n);
    expect(parsed.rail).toBe(SettlementRail.Lightning);
  });

  it("rejects a response missing the fee record", () => {
    const { fee: _fee, ...rest } = validSettlementResponse;
    expect(() => SettlementResultSchema.parse(rest)).toThrow();
  });

  it("rejects a negative or fractional amount string", () => {
    const negative = {
      ...validSettlementResponse,
      fee: { ...validSettlementResponse.fee, amountSat: "-1" },
    };
    expect(() => SettlementResultSchema.parse(negative)).toThrow();

    const fractional = {
      ...validSettlementResponse,
      fee: { ...validSettlementResponse.fee, feeSat: "1.5" },
    };
    expect(() => SettlementResultSchema.parse(fractional)).toThrow();
  });

  it("rejects an unknown settlement rail (forged tier/rail)", () => {
    const forged = { ...validSettlementResponse, rail: "FORGED_RAIL" };
    expect(() => SettlementResultSchema.parse(forged)).toThrow();
  });
});

describe("GatewayClient settlement wire hardening", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends Idempotency-Key and X-Request-Id headers on settlement", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(validSettlementResponse)),
    );
    const client = new GatewayClient({ baseUrl: "https://gateway.example" });

    await client.settleJobCard(jobCard, { idempotencyKey: "idem-1", correlationId: "corr-1" });

    const request = fetchMock.mock.calls[0]?.[1];
    const headers = request?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("idem-1");
    expect(headers["X-Request-Id"]).toBe("corr-1");
  });

  it("auto-generates an idempotency key when none is supplied", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(validSettlementResponse)),
    );
    const client = new GatewayClient({ baseUrl: "https://gateway.example" });

    await client.settleJobCard(jobCard);

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBeTruthy();
    expect(headers["X-Request-Id"]).toBeTruthy();
  });

  it("throws when the settlement response fails runtime validation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: "not-a-boolean" })),
    );
    const client = new GatewayClient({ baseUrl: "https://gateway.example" });

    await expect(client.settleJobCard(jobCard)).rejects.toThrow(/validation/);
  });

  it("still serializes bigint settlement amounts as decimal strings", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(validSettlementResponse)),
    );
    const client = new GatewayClient({ baseUrl: "https://gateway.example" });

    await client.settleJobCard(jobCard);

    const body = fetchMock.mock.calls[0]?.[1]?.body as string;
    expect(body).toContain('"bountySat":"10000"');
  });
});
