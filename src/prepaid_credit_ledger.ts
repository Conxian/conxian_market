/**
 * Prepaid credit ledger — deferred-revenue draw-down for anchor clients.
 *
 * A customer prepays a discounted block of Gateway/Nexus credits; each metered
 * charge draws the block down until it is exhausted or expires. This is
 * deferred revenue, not debt: unused credits expire, and a charge that exceeds
 * the remaining credits is split into a covered part and an overage part.
 *
 * Pure and deterministic; performs no I/O and holds no funds. Expiry is
 * fail-closed: a block past its expiry covers nothing.
 *
 * See docs/commercial/PREPAID_CREDIT_ORDER_FORM_TEMPLATE.md.
 */

export interface PrepaidCreditBlock {
  blockId: string;
  /** Customer billing principal — a role, never a raw address. */
  customerRole: string;
  /** Credits purchased, in sat-denominated credit units. */
  creditsTotal: bigint;
  /** Prepay discount applied, in bps (informational). */
  discountBps: number;
  issuedAtIso: string;
  expiryIso: string;
  consumedCredits: bigint;
}

export interface CreditDrawdown {
  blockId: string;
  /** Credits drawn from this block for the charge. */
  coveredCredits: bigint;
  /** Credits left in the block afterwards. */
  remainingCredits: bigint;
  /** Charge left uncovered (billed at list rate). */
  overageCredits: bigint;
  /** True when the block is past its expiry at the charge time. */
  expired: boolean;
}

export interface CreditStatement {
  blockId: string;
  customerRole: string;
  creditsTotal: bigint;
  consumedCredits: bigint;
  remainingCredits: bigint;
  /** Fraction of the block consumed, 0.0–1.0. */
  utilisation: number;
  expired: boolean;
}

/** Net prepaid price after a discount, in sat-denominated credit units. */
export function prepaidNetPrice(listPriceSat: bigint, discountBps: number): bigint {
  if (discountBps < 0 || discountBps > 10_000) {
    throw new Error("discountBps must be in [0, 10000]");
  }
  return (listPriceSat * BigInt(10_000 - discountBps)) / 10_000n;
}

function remainingOf(block: PrepaidCreditBlock): bigint {
  const remaining = block.creditsTotal - block.consumedCredits;
  return remaining > 0n ? remaining : 0n;
}

function isExpired(block: PrepaidCreditBlock, atIso: string): boolean {
  return Date.parse(atIso) > Date.parse(block.expiryIso);
}

/**
 * Draw a metered charge against a single credit block. Expired or malformed
 * blocks fail closed: they cover nothing and the whole charge is overage.
 */
export function drawDownCredit(
  block: PrepaidCreditBlock,
  chargeCredits: bigint,
  atIso: string,
): CreditDrawdown {
  if (chargeCredits < 0n) {
    throw new Error("chargeCredits must be non-negative");
  }

  const expired = isExpired(block, atIso);
  const remaining = remainingOf(block);

  if (expired || remaining === 0n) {
    return {
      blockId: block.blockId,
      coveredCredits: 0n,
      remainingCredits: remaining,
      overageCredits: chargeCredits,
      expired,
    };
  }

  const coveredCredits = chargeCredits < remaining ? chargeCredits : remaining;
  return {
    blockId: block.blockId,
    coveredCredits,
    remainingCredits: remaining - coveredCredits,
    overageCredits: chargeCredits - coveredCredits,
    expired: false,
  };
}

/**
 * Draw a charge across several blocks, oldest-first (by `issuedAtIso`). Returns
 * the per-block draw-downs and the total overage that must be billed at list.
 */
export function drawDownAcrossBlocks(
  blocks: PrepaidCreditBlock[],
  chargeCredits: bigint,
  atIso: string,
): { drawdowns: CreditDrawdown[]; overageCredits: bigint } {
  const ordered = [...blocks].sort(
    (a, b) => Date.parse(a.issuedAtIso) - Date.parse(b.issuedAtIso),
  );
  const drawdowns: CreditDrawdown[] = [];
  let remainingCharge = chargeCredits;

  for (const block of ordered) {
    if (remainingCharge <= 0n) break;
    const draw = drawDownCredit(block, remainingCharge, atIso);
    drawdowns.push(draw);
    remainingCharge = draw.overageCredits;
  }

  return { drawdowns, overageCredits: remainingCharge };
}

/** A statement of a block's consumption, for the customer and for BOS. */
export function creditStatement(block: PrepaidCreditBlock, atIso: string): CreditStatement {
  const remainingCredits = remainingOf(block);
  const utilisation =
    block.creditsTotal > 0n
      ? Number(block.consumedCredits) / Number(block.creditsTotal)
      : 0;
  return {
    blockId: block.blockId,
    customerRole: block.customerRole,
    creditsTotal: block.creditsTotal,
    consumedCredits: block.consumedCredits,
    remainingCredits,
    utilisation,
    expired: isExpired(block, atIso),
  };
}
