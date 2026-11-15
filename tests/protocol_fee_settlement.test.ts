import { describe, it, expect } from "vitest";
import {
  buildProtocolFeeSettlement,
  planTreasuryUtilisation,
  type FeeSettlementConfig,
} from "../src/protocol_fee_settlement.js";
import { SettlementRail, TrustTier } from "../src/core_types.js";

const PRINCIPALS = {
  builder: "SP000000000000000000002Q6VF78.builder-registry",
  vault: "SP000000000000000000002Q6VF78.protocol-fee-vault",
  ecosystem: "SP000000000000000000002Q6VF78.ecosystem-grants",
  operations: "SP000000000000000000002Q6VF78.sab-treasury-ms",
  founders: "SP000000000000000000002Q6VF78.founder-vesting",
};

const FULL_CONFIG: FeeSettlementConfig = {
  builder: { role: "BUILDER", principal: PRINCIPALS.builder },
  vault: { role: "TREASURY_VAULT", principal: PRINCIPALS.vault },
  ecosystem: { role: "ECOSYSTEM", principal: PRINCIPALS.ecosystem },
  operations: { role: "OPERATIONS", principal: PRINCIPALS.operations },
  founders: { role: "FOUNDERS", principal: PRINCIPALS.founders },
};

const input = (gross: bigint) => ({
  settlementId: "s-1",
  rail: SettlementRail.Lightning,
  tier: TrustTier.Expedient,
  grossAmountSat: gross,
  product: "matched_job" as const,
});

describe("buildProtocolFeeSettlement (ADR-007)", () => {
  it("routes the builder and the vault take for a 100k matched job (no dropped legs)", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n), FULL_CONFIG);

    expect(plan.isSettleable).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.product).toBe("matched_job");
    expect(plan.protocolTakeSat).toBe(10_000n); // 10% take
    expect(plan.builderSat).toBe(90_000n);      // builder keeps 90%

    expect(plan.instructions.map((i) => [i.leg, i.amountSat, i.destination])).toEqual([
      ["builder", 90_000n, "direct"],
      ["treasury", 10_000n, "vault-intake"],
    ]);

    // Vault sweep 50/30/20 of the 10,000 take
    expect(plan.vaultSweep).toEqual({
      intakeSat: 10_000n,
      operationsSat: 5_000n,
      foundersSat: 3_000n,
      ecosystemSat: 2_000n,
      operationsBps: 5000,
      foundersBps: 3000,
      ecosystemBps: 2000,
    });
  });

  it("makes the platform take visible (1000 bps, not the retired 80/10/10)", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n), FULL_CONFIG);
    expect(plan.effectiveProtocolTakeBps).toBe(1000); // 10%
  });

  it("prices a raw rail call with the ADR-005 dynamic fee", () => {
    const plan = buildProtocolFeeSettlement(
      { ...input(1_000_000n), product: "rail" },
      FULL_CONFIG,
    );
    expect(plan.product).toBe("rail");
    expect(plan.protocolTakeSat).toBe(5_000n); // 50 bps
    expect(plan.builderSat).toBe(995_000n);
    expect(plan.vaultSweep.intakeSat).toBe(5_000n);
  });

  it("fails closed to the matched-job rate when the product is unknown", () => {
    const plan = buildProtocolFeeSettlement(
      { settlementId: "s-2", rail: SettlementRail.Lightning, tier: TrustTier.Expedient, grossAmountSat: 1_000_000n },
      FULL_CONFIG,
    );
    // No product/signals => classified as a matched job (the higher rate).
    expect(plan.product).toBe("matched_job");
    expect(plan.protocolTakeSat).toBe(100_000n);
  });

  it("fails closed when the vault principal is unconfigured", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n), {
      ...FULL_CONFIG,
      vault: { role: "TREASURY_VAULT" },
    });
    expect(plan.isSettleable).toBe(false);
    expect(plan.blockers).toContain("TREASURY_VAULT principal is not configured");
  });

  it("fails closed when a sweep recipient is unconfigured", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n), {
      ...FULL_CONFIG,
      operations: { role: "OPERATIONS" },
    });
    expect(plan.isSettleable).toBe(false);
    expect(plan.blockers).toContain("OPERATIONS principal is not configured");
  });

  it("fails closed when every principal is unconfigured", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n), {
      builder: { role: "BUILDER" },
      vault: { role: "TREASURY_VAULT" },
      ecosystem: { role: "ECOSYSTEM" },
      operations: { role: "OPERATIONS" },
      founders: { role: "FOUNDERS" },
    });
    expect(plan.isSettleable).toBe(false);
    expect(plan.blockers).toHaveLength(5);
  });

  it("rejects a vault split that does not sum to 10000 bps", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n), {
      ...FULL_CONFIG,
      vaultSplit: { operationsBps: 5000, foundersBps: 3000, ecosystemBps: 1000 },
    });
    expect(plan.isSettleable).toBe(false);
    expect(plan.blockers).toContain(
      "vaultSplit basis points must be non-negative and sum to 10000",
    );
  });

  it("keeps the sweep split lossless (no satoshi is dropped)", () => {
    // A take that does not divide evenly; the ecosystem bucket absorbs dust.
    const plan = buildProtocolFeeSettlement(input(100_033n), FULL_CONFIG);
    const s = plan.vaultSweep;
    expect(s.operationsSat + s.foundersSat + s.ecosystemSat).toBe(s.intakeSat);
  });
});

describe("planTreasuryUtilisation", () => {
  const sweep = buildProtocolFeeSettlement(input(100_000n), FULL_CONFIG).vaultSweep;

  it("maps each bucket to its documented purposes and release target", () => {
    const plan = planTreasuryUtilisation(sweep);
    expect(plan.totalSweptSat).toBe(10_000n);
    expect(plan.lines.map((l) => [l.bucket, l.amountSat, l.releaseTarget])).toEqual([
      ["OPERATIONS", 5_000n, "SAB-TREASURY-MS"],
      ["FOUNDERS", 3_000n, "SAB-TREASURY-MS"],
      ["ECOSYSTEM", 2_000n, "DAO-TREASURY-MS"],
    ]);
    expect(plan.lines[0].purposes).toContain("Security audits (quarterly)");
    expect(plan.lines[2].purposes).toContain("Builder grants");
  });

  it("carries the documented 40/30/20/10 target allocation", () => {
    const plan = planTreasuryUtilisation(sweep);
    expect(plan.targetAllocation).toEqual({
      stablecoinsPct: 40,
      rwaPct: 30,
      liquidStakingPct: 20,
      nativeTokenPct: 10,
    });
  });

  it("states it confers no spend authority", () => {
    const plan = planTreasuryUtilisation(sweep);
    expect(plan.notes.join(" ")).toMatch(/grants no spend authority/);
  });
});
