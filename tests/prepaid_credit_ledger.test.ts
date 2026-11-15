import { describe, it, expect } from "vitest";
import {
  drawDownCredit,
  drawDownAcrossBlocks,
  creditStatement,
  prepaidNetPrice,
  type PrepaidCreditBlock,
} from "../src/prepaid_credit_ledger.js";

const block = (over: Partial<PrepaidCreditBlock> = {}): PrepaidCreditBlock => ({
  blockId: "PC-1",
  customerRole: "SP000000000000000000002Q6VF78.anchor-client",
  creditsTotal: 1_000_000n,
  discountBps: 2000,
  issuedAtIso: "2026-11-01T00:00:00Z",
  expiryIso: "2027-11-01T00:00:00Z",
  consumedCredits: 0n,
  ...over,
});

describe("prepaidNetPrice", () => {
  it("applies the prepay discount", () => {
    expect(prepaidNetPrice(1_200_000n, 2000)).toBe(960_000n); // 20% off
    expect(prepaidNetPrice(1_200_000n, 0)).toBe(1_200_000n);
  });

  it("rejects an out-of-range discount", () => {
    expect(() => prepaidNetPrice(1_000_000n, 12_000)).toThrow();
    expect(() => prepaidNetPrice(1_000_000n, -1)).toThrow();
  });
});

describe("drawDownCredit", () => {
  it("covers a charge within the remaining credits", () => {
    const draw = drawDownCredit(block({ consumedCredits: 400_000n }), 100_000n, "2026-12-01T00:00:00Z");
    expect(draw.coveredCredits).toBe(100_000n);
    expect(draw.remainingCredits).toBe(500_000n);
    expect(draw.overageCredits).toBe(0n);
    expect(draw.expired).toBe(false);
  });

  it("splits a charge that exceeds the remaining credits into covered + overage", () => {
    const draw = drawDownCredit(block({ consumedCredits: 950_000n }), 100_000n, "2026-12-01T00:00:00Z");
    expect(draw.coveredCredits).toBe(50_000n);
    expect(draw.remainingCredits).toBe(0n);
    expect(draw.overageCredits).toBe(50_000n);
  });

  it("fails closed once the block is expired", () => {
    const draw = drawDownCredit(block(), 100_000n, "2028-01-01T00:00:00Z");
    expect(draw.expired).toBe(true);
    expect(draw.coveredCredits).toBe(0n);
    expect(draw.overageCredits).toBe(100_000n);
  });

  it("fails closed on an exhausted block", () => {
    const draw = drawDownCredit(block({ consumedCredits: 1_000_000n }), 10_000n, "2026-12-01T00:00:00Z");
    expect(draw.coveredCredits).toBe(0n);
    expect(draw.overageCredits).toBe(10_000n);
  });
});

describe("drawDownAcrossBlocks", () => {
  it("draws oldest-first and reports the total overage", () => {
    const older = block({ blockId: "OLD", creditsTotal: 100_000n, consumedCredits: 60_000n, issuedAtIso: "2026-01-01T00:00:00Z" });
    const newer = block({ blockId: "NEW", creditsTotal: 100_000n, consumedCredits: 0n, issuedAtIso: "2026-06-01T00:00:00Z" });

    const { drawdowns, overageCredits } = drawDownAcrossBlocks(
      [newer, older],
      150_000n,
      "2026-12-01T00:00:00Z",
    );

    expect(drawdowns.map((d) => d.blockId)).toEqual(["OLD", "NEW"]);
    expect(drawdowns[0].coveredCredits).toBe(40_000n); // older had 40k left
    expect(drawdowns[1].coveredCredits).toBe(100_000n); // newer covers the rest
    expect(overageCredits).toBe(10_000n); // 150k charge, 140k covered
  });

  it("bills the whole charge as overage when there are no usable blocks", () => {
    const { drawdowns, overageCredits } = drawDownAcrossBlocks([], 5_000n, "2026-12-01T00:00:00Z");
    expect(drawdowns).toEqual([]);
    expect(overageCredits).toBe(5_000n);
  });
});

describe("creditStatement", () => {
  it("reports consumption and utilisation", () => {
    const stmt = creditStatement(block({ consumedCredits: 250_000n }), "2026-12-01T00:00:00Z");
    expect(stmt.remainingCredits).toBe(750_000n);
    expect(stmt.utilisation).toBeCloseTo(0.25);
    expect(stmt.expired).toBe(false);
    expect(stmt.customerRole).toBe("SP000000000000000000002Q6VF78.anchor-client");
  });
});
