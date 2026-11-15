/**
 * Capped revenue-share assignment — a non-dilutive financing primitive.
 *
 * A lender advances sats today; in return they receive a fixed slice of the
 * OPERATIONS bucket of future protocol take until a repayment cap is reached.
 * After the cap, 100% of the assignment reverts to Conxian-Labs. Only the
 * OPERATIONS bucket is assignable: FOUNDERS (vesting) and ECOSYSTEM (DAO) are
 * ring-fenced so a financing cannot touch vested or reserve funds.
 *
 * Pure and deterministic; performs no I/O and confers no spend authority — it
 * produces a routing instruction the caller may act on. Off by default: the
 * `assignments` list is optional, and an empty list leaves the bucket intact.
 *
 * See ADR-007 for the fee split. Financing analysis lives in the private funding hub
 * (`.github-private`), not in this public repo.
 */

/** Only the OPERATIONS bucket may be assigned (ADR-007 split). */
export const ASSIGNABLE_BUCKET = "OPERATIONS" as const;

export type AssignmentBucket = "OPERATIONS" | "FOUNDERS" | "ECOSYSTEM";

export interface RevenueShareAssignment {
  /** Stable identifier for the note/agreement. */
  assignmentId: string;
  lender: { role: "LENDER"; principal?: string };
  /** The treasury bucket the assignment draws from. Only OPERATIONS is allowed. */
  sourceBucket: AssignmentBucket;
  /** Share of the source bucket routed to the lender, in bps (0..10000). */
  shareBps: number;
  /** Total sats the lender receives before the assignment ends (principal × cap multiple). */
  repaymentCapSat: bigint;
  /** Sats already delivered to the lender, from the off-chain repayment ledger. */
  repaidToDateSat: bigint;
}

export interface AssignedLeg {
  assignmentId: string;
  recipientRole: "LENDER";
  recipientPrincipal?: string;
  amountSat: bigint;
  sourceBucket: AssignmentBucket;
  /** True once `repaidToDateSat + amountSat` reaches `repaymentCapSat`. */
  capped: boolean;
}

export interface AssignmentResult {
  assignments: AssignedLeg[];
  /** OPERATIONS sats left with Conxian-Labs after the assignments. */
  retainedOperationsSat: bigint;
  totalAssignedSat: bigint;
  blockers: string[];
  /** True only when every assignment is well-formed and no blocker was raised. */
  isApplicable: boolean;
}

/** Remaining room under an assignment's cap, for the off-chain ledger. */
export function assignmentProgress(assignment: RevenueShareAssignment): {
  remainingSat: bigint;
  reachedCap: boolean;
} {
  const remaining = assignment.repaymentCapSat - assignment.repaidToDateSat;
  return { remainingSat: remaining > 0n ? remaining : 0n, reachedCap: remaining <= 0n };
}

/**
 * Apply capped revenue-share assignments to an OPERATIONS bucket amount.
 *
 * Assignments are evaluated in order and draw against the same bucket, so an
 * earlier assignment has priority over a later one. Any malformed assignment
 * fails closed (it routes nothing) and raises a blocker.
 */
export function buildRevenueShareAssignment(input: {
  operationsSat: bigint;
  assignments?: RevenueShareAssignment[];
}): AssignmentResult {
  const blockers: string[] = [];
  const assignments = input.assignments ?? [];
  const operationsSat = input.operationsSat;

  if (operationsSat < 0n) {
    blockers.push("operationsSat must be non-negative");
  }

  const legs: AssignedLeg[] = [];
  let remaining = operationsSat > 0n ? operationsSat : 0n;

  const reject = (assignment: RevenueShareAssignment, message: string): void => {
    blockers.push(`assignment ${assignment.assignmentId}: ${message}`);
    legs.push({
      assignmentId: assignment.assignmentId,
      recipientRole: "LENDER",
      recipientPrincipal: assignment.lender.principal,
      amountSat: 0n,
      sourceBucket: assignment.sourceBucket,
      capped: false,
    });
  };

  for (const assignment of assignments) {
    if (assignment.sourceBucket !== ASSIGNABLE_BUCKET) {
      reject(assignment, `only the ${ASSIGNABLE_BUCKET} bucket may be assigned`);
      continue;
    }
    if (
      !Number.isInteger(assignment.shareBps) ||
      assignment.shareBps < 0 ||
      assignment.shareBps > 10_000
    ) {
      reject(assignment, "shareBps must be an integer in [0, 10000]");
      continue;
    }
    if (assignment.repaymentCapSat <= 0n) {
      reject(assignment, "repaymentCapSat must be greater than zero");
      continue;
    }
    const lenderPrincipal = assignment.lender.principal;
    if (!lenderPrincipal || lenderPrincipal.trim().length === 0) {
      reject(assignment, "lender principal is not configured");
      continue;
    }

    const { remainingSat, reachedCap } = assignmentProgress(assignment);
    if (reachedCap) {
      legs.push({
        assignmentId: assignment.assignmentId,
        recipientRole: "LENDER",
        recipientPrincipal: lenderPrincipal,
        amountSat: 0n,
        sourceBucket: assignment.sourceBucket,
        capped: true,
      });
      continue;
    }

    const shareSat = (operationsSat * BigInt(assignment.shareBps)) / 10_000n;
    let amountSat = shareSat < remainingSat ? shareSat : remainingSat;
    if (amountSat > remaining) amountSat = remaining;
    remaining -= amountSat;

    legs.push({
      assignmentId: assignment.assignmentId,
      recipientRole: "LENDER",
      recipientPrincipal: lenderPrincipal,
      amountSat,
      sourceBucket: assignment.sourceBucket,
      capped: assignment.repaidToDateSat + amountSat >= assignment.repaymentCapSat,
    });
  }

  const totalAssignedSat = legs.reduce((sum, leg) => sum + leg.amountSat, 0n);

  return {
    assignments: legs,
    retainedOperationsSat: (operationsSat > 0n ? operationsSat : 0n) - totalAssignedSat,
    totalAssignedSat,
    blockers,
    isApplicable: blockers.length === 0,
  };
}
