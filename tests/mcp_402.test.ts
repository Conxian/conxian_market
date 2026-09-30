import { describe, it, expect } from "vitest";
import { Mcp402Facade } from "../src/mcp_402";

const job = {
  id: "job-1",
  title: "Build adapter",
  description: "Build a chain adapter",
  bountySat: 1000n,
  deadline: 1750005000,
};

function receipt(overrides: Partial<{ demandId: string; amountSat: string; paidAt: number; transactionId: string; payerDid: string }> = {}) {
  return {
    demandId: "job-1",
    transactionId: "tx-1",
    amountSat: "1000",
    paidAt: 1750000100,
    payerDid: "did:conxian:payer:1",
    ...overrides,
  };
}

const call = { tool: "submit_job", arguments: {}, job, payerDid: "did:conxian:payer:1" };

describe("Mcp402Facade", () => {
  it("gates dispatch on a valid receipt", () => {
    const facade = new Mcp402Facade();
    const result = facade.authorize(call, receipt());
    expect(result.authorized).toBe(true);
    expect(facade.isSettled("job-1")).toBe(true);
  });

  it("fails closed on an amount mismatch", () => {
    const facade = new Mcp402Facade();
    const result = facade.authorize(call, receipt({ amountSat: "1" }));
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/receipt/);
    expect(facade.isSettled("job-1")).toBe(false);
  });
});
