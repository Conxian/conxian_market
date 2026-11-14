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

const input = (gross: bigint, fee: bigint) => ({
  settlementId: "s-1",
  rail: SettlementRail.Lightning,
  tier: TrustTier.Expedient,
  grossAmountSat: gross,
  feeSat: fee,
});

describe("buildProtocolFeeSettlement", () => {
  it("routes all three legs and the vault sweep for a 100k/2k settlement", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n, 2_000n), FULL_CONFIG);

    expect(plan.isSettleable).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.netPayoutSat).toBe(98_000n);

    // 80/10/10 of the 98,000 net payout
    expect(plan.instructions.map((i) => [i.leg, i.amountSat, i.destination])).toEqual([
      ["builder", 78_400n, "direct"],
      ["treasury", 9_800n, "vault-intake"],
      ["ecosystem", 9_800n, "direct"],
    ]);

    // Vault sweep 50/30/20 of the 9,800 intake
    expect(plan.vaultSweep).toEqual({
      intakeSat: 9_800n,
      operationsSat: 4_900n,
      foundersSat: 2_940n,
      ecosystemSat: 1_960n,
      operationsBps: 5000,
      foundersBps: 3000,
      ecosystemBps: 2000,
    });
  });

  it("makes the total protocol take visible (2160 bps, not the documented 200 bps)", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n, 2_000n), FULL_CONFIG);
    // 2,000 fee + 9,800 treasury + 9,800 ecosystem = 21,600 of 100,000 = 2160 bps (21.6%)
    expect(plan.effectiveProtocolTakeBps).toBe(2160);
  });

  it("fails closed when the vault principal is unconfigured", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n, 2_000n), {
      ...FULL_CONFIG,
      vault: { role: "TREASURY_VAULT" },
    });
    expect(plan.isSettleable).toBe(false);
    expect(plan.blockers).toContain("TREASURY_VAULT principal is not configured");
  });

  it("fails closed when a sweep recipient is unconfigured", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n, 2_000n), {
      ...FULL_CONFIG,
      operations: { role: "OPERATIONS" },
    });
    expect(plan.isSettleable).toBe(false);
    expect(plan.blockers).toContain("OPERATIONS principal is not configured");
  });

  it("fails closed when every principal is unconfigured", () => {
    const plan = buildProtocolFeeSettlement(input(100_000n, 2_000n), {
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
    const plan = buildProtocolFeeSettlement(input(100_000n, 2_000n), {
      ...FULL_CONFIG,
      vaultSplit: { operationsBps: 5000, foundersBps: 3000, ecosystemBps: 1000 },
    });
    expect(plan.isSettleable).toBe(false);
    expect(plan.blockers).toContain(
      "vaultSplit basis points must be non-negative and sum to 10000",
    );
  });

  it("keeps the sweep split lossless (no satoshi is dropped)", () => {
    // 9,801 intake does not divide evenly; the ecosystem bucket absorbs dust.
    const plan = buildProtocolFeeSettlement(input(100_000n, 1_999n), FULL_CONFIG);
    const s = plan.vaultSweep;
    expect(s.operationsSat + s.foundersSat + s.ecosystemSat).toBe(s.intakeSat);
  });

  it("rejects a fee larger than the gross amount", () => {
    const plan = buildProtocolFeeSettlement(input(1_000n, 2_000n), FULL_CONFIG);
    expect(plan.isSettleable).toBe(false);
    expect(plan.blockers).toContain("feeSat exceeds grossAmountSat");
  });
});

describe("planTreasuryUtilisation", () => {
  const sweep = buildProtocolFeeSettlement(input(100_000n, 2_000n), FULL_CONFIG).vaultSweep;

  it("maps each bucket to its documented purposes and release target", () => {
    const plan = planTreasuryUtilisation(sweep);
    expect(plan.totalSweptSat).toBe(9_800n);
    expect(plan.lines.map((l) => [l.bucket, l.amountSat, l.releaseTarget])).toEqual([
      ["OPERATIONS", 4_900n, "SAB-TREASURY-MS"],
      ["FOUNDERS", 2_940n, "SAB-TREASURY-MS"],
      ["ECOSYSTEM", 1_960n, "DAO-TREASURY-MS"],
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
