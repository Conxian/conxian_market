import { describe, it, expect } from "vitest";
import {
  buildRevenueShareAssignment,
  assignmentProgress,
  ASSIGNABLE_BUCKET,
  type RevenueShareAssignment,
} from "../src/revenue_share_assignment.js";

const LENDER = "SP000000000000000000002Q6VF78.sats-lender";

const assignment = (
  over: Partial<RevenueShareAssignment> = {}
): RevenueShareAssignment => ({
  assignmentId: "RS-1",
  lender: { role: "LENDER", principal: LENDER },
  sourceBucket: "OPERATIONS",
  shareBps: 2500, // 25% of the OPERATIONS bucket
  repaymentCapSat: 1_300_000n, // 1.3x a 1M-sat advance
  repaidToDateSat: 0n,
  ...over,
});

describe("buildRevenueShareAssignment", () => {
  it("assigns a capped slice of the OPERATIONS bucket and leaves the rest retained", () => {
    const result = buildRevenueShareAssignment({
      operationsSat: 100_000n,
      assignments: [assignment()],
    });

    expect(result.isApplicable).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].amountSat).toBe(25_000n); // 25% of 100k
    expect(result.assignments[0].recipientPrincipal).toBe(LENDER);
    expect(result.totalAssignedSat).toBe(25_000n);
    expect(result.retainedOperationsSat).toBe(75_000n);
  });

  it("clamps the final payment to the remaining cap and marks it capped", () => {
    const result = buildRevenueShareAssignment({
      operationsSat: 100_000n,
      assignments: [assignment({ repaymentCapSat: 1_280_000n, repaidToDateSat: 1_270_000n })],
    });

    // remaining room is 10k; the 25% share (25k) is clamped to it
    expect(result.assignments[0].amountSat).toBe(10_000n);
    expect(result.assignments[0].capped).toBe(true);
    expect(result.retainedOperationsSat).toBe(90_000n);
  });

  it("routes nothing once the cap is already reached (100% reverts to Conxian)", () => {
    const result = buildRevenueShareAssignment({
      operationsSat: 100_000n,
      assignments: [assignment({ repaymentCapSat: 1_000_000n, repaidToDateSat: 1_000_000n })],
    });

    expect(result.assignments[0].amountSat).toBe(0n);
    expect(result.assignments[0].capped).toBe(true);
    expect(result.retainedOperationsSat).toBe(100_000n);
  });

  it("fails closed on a non-OPERATIONS bucket, leaving the bucket intact", () => {
    const result = buildRevenueShareAssignment({
      operationsSat: 100_000n,
      assignments: [assignment({ sourceBucket: "FOUNDERS" }), assignment({ sourceBucket: "ECOSYSTEM" })],
    });

    expect(result.isApplicable).toBe(false);
    expect(result.blockers).toHaveLength(2);
    expect(result.assignments.every((leg) => leg.amountSat === 0n)).toBe(true);
    expect(result.retainedOperationsSat).toBe(100_000n);
  });

  it("fails closed on an unconfigured lender principal", () => {
    const result = buildRevenueShareAssignment({
      operationsSat: 100_000n,
      assignments: [assignment({ lender: { role: "LENDER" } })],
    });

    expect(result.isApplicable).toBe(false);
    expect(result.assignments[0].amountSat).toBe(0n);
    expect(result.retainedOperationsSat).toBe(100_000n);
  });

  it("fails closed on a bad shareBps or non-positive cap", () => {
    const bad = buildRevenueShareAssignment({
      operationsSat: 100_000n,
      assignments: [assignment({ shareBps: 12_000 }), assignment({ repaymentCapSat: 0n })],
    });
    expect(bad.isApplicable).toBe(false);
    expect(bad.blockers).toHaveLength(2);
  });

  it("gives an earlier assignment priority and caps the total at the bucket", () => {
    const result = buildRevenueShareAssignment({
      operationsSat: 100_000n,
      assignments: [
        assignment({ assignmentId: "A", shareBps: 6000 }), // 60k
        assignment({ assignmentId: "B", shareBps: 6000 }), // wants 60k, only 40k left
      ],
    });

    expect(result.assignments[0].amountSat).toBe(60_000n);
    expect(result.assignments[1].amountSat).toBe(40_000n);
    expect(result.totalAssignedSat).toBe(100_000n);
    expect(result.retainedOperationsSat).toBe(0n);
  });

  it("leaves the bucket fully intact when no assignments are configured (off by default)", () => {
    const result = buildRevenueShareAssignment({ operationsSat: 42_000n });
    expect(result.assignments).toEqual([]);
    expect(result.totalAssignedSat).toBe(0n);
    expect(result.retainedOperationsSat).toBe(42_000n);
    expect(result.isApplicable).toBe(true);
  });

  it("names OPERATIONS as the only assignable bucket", () => {
    expect(ASSIGNABLE_BUCKET).toBe("OPERATIONS");
  });
});

describe("assignmentProgress", () => {
  it("reports remaining room and cap state from the ledger", () => {
    expect(assignmentProgress(assignment({ repaidToDateSat: 300_000n }))).toEqual({
      remainingSat: 1_000_000n,
      reachedCap: false,
    });
    expect(assignmentProgress(assignment({ repaidToDateSat: 1_300_000n }))).toEqual({
      remainingSat: 0n,
      reachedCap: true,
    });
  });
});
