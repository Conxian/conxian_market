import { describe, it, expect } from "vitest";
import {
  classifyFeeProduct,
  resolveFeeProduct,
  hasMarketplaceSignal,
  splitPlatformTake,
  computeProductTake,
  MATCHED_JOB_TAKE_BPS,
} from "../src/fee_product.js";
import { SettlementRail, TrustTier } from "../src/core_types.js";

describe("fee_product — classification (ADR-007)", () => {
  it("classifies a settlement with any marketplace signal as a matched job", () => {
    expect(classifyFeeProduct({ hasJobCard: true })).toBe("matched_job");
    expect(classifyFeeProduct({ hasEscrow: true })).toBe("matched_job");
    expect(classifyFeeProduct({ hasAttestation: true })).toBe("matched_job");
    expect(classifyFeeProduct({ hasSla: true })).toBe("matched_job");
    expect(classifyFeeProduct({ hasDisputePath: true })).toBe("matched_job");
  });

  it("classifies a settlement with no marketplace signal as a rail call", () => {
    expect(classifyFeeProduct({})).toBe("rail");
    expect(hasMarketplaceSignal({})).toBe(false);
  });

  it("fails closed to the matched-job rate when unclassifiable", () => {
    // No explicit product and no signals => matched job (the higher rate).
    expect(resolveFeeProduct(undefined, undefined)).toBe("matched_job");
    // An explicit product always wins.
    expect(resolveFeeProduct("rail", { hasJobCard: true })).toBe("rail");
    expect(resolveFeeProduct("matched_job", {})).toBe("matched_job");
  });
});

describe("fee_product — take split (one split rule)", () => {
  it("splits a take 50/30/20 and lets the ecosystem bucket absorb dust", () => {
    expect(splitPlatformTake(10_000n)).toEqual({
      operationsSat: 5_000n,
      foundersSat: 3_000n,
      ecosystemSat: 2_000n,
    });
    const s = splitPlatformTake(10_001n);
    expect(s.operationsSat + s.foundersSat + s.ecosystemSat).toBe(10_001n);
  });

  it("returns zeros for a non-positive take", () => {
    expect(splitPlatformTake(0n)).toEqual({ operationsSat: 0n, foundersSat: 0n, ecosystemSat: 0n });
  });
});

describe("fee_product — product take", () => {
  it("takes 10% of gross on a matched job (builder keeps 90%)", () => {
    const take = computeProductTake({ product: "matched_job", grossAmountSat: 1_000_000n });
    expect(take.takeSat).toBe(100_000n);
    expect(take.builderSat).toBe(900_000n);
    expect(take.takeBps).toBe(1000);
    expect(take.operationsSat).toBe(50_000n);
  });

  it("uses the ADR-005 dynamic fee on a rail call", () => {
    const take = computeProductTake({
      product: "rail",
      grossAmountSat: 1_000_000n,
      tier: TrustTier.Expedient,
      rail: SettlementRail.Lightning,
    });
    expect(take.takeSat).toBe(5_000n); // 50 bps, above the floor
    expect(take.builderSat).toBe(995_000n);
  });

  it("shows the 20x rate difference between the two products", () => {
    const rail = computeProductTake({
      product: "rail",
      grossAmountSat: 1_000_000n,
      tier: TrustTier.Expedient,
      rail: SettlementRail.Lightning,
    });
    const matched = computeProductTake({ product: "matched_job", grossAmountSat: 1_000_000n });
    expect(matched.takeSat / rail.takeSat).toBe(20n);
  });

  it("never lets the take exceed the gross (a rail floor on dust)", () => {
    // 1 sat gross, Lightning floor is 10 sat (8 × 1.25) — take is clamped to gross.
    const take = computeProductTake({
      product: "rail",
      grossAmountSat: 1n,
      tier: TrustTier.Expedient,
      rail: SettlementRail.Lightning,
    });
    expect(take.takeSat).toBe(1n);
    expect(take.builderSat).toBe(0n);
  });

  it("requires tier and rail for a rail take", () => {
    expect(() =>
      computeProductTake({ product: "rail", grossAmountSat: 1_000n }),
    ).toThrow(/Rail take requires/);
  });

  it("honours a matched-job take override", () => {
    const take = computeProductTake({
      product: "matched_job",
      grossAmountSat: 1_000_000n,
      matchedJobTakeBps: 2000,
    });
    expect(take.takeSat).toBe(200_000n);
    expect(MATCHED_JOB_TAKE_BPS).toBe(1000); // default unchanged
  });
});
