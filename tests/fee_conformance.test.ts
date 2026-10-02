import { describe, expect, it } from "vitest";
import {
  calculateDynamicFee,
  SettlementRail,
  TrustTier,
} from "../src/fee_calculator";
import type { VolumeDecayTier } from "../src/core_types";
import fixture from "./fixtures/fee_conformance.json";

// Cross-repo conformance: this test reads the same canonical fixture as
// lib-conxian-core `fixtures/fee_conformance.json` and asserts the TS
// implementation produces identical results. The fixture is the behavioral
// contract and MUST stay byte-identical across the two repos.

const RAIL_MAP: Record<string, SettlementRail> = {
  statechain: SettlementRail.Statechain,
  sbtc: SettlementRail.Sbtc,
  rgb: SettlementRail.Rgb,
  babylon: SettlementRail.Babylon,
  fedimint: SettlementRail.Fedimint,
  lightning: SettlementRail.Lightning,
  alex_stacks: SettlementRail.AlexStacks,
  evm_erc8183: SettlementRail.EvmErc8183,
};

const TIER_MAP: Record<string, VolumeDecayTier> = {
  tier1: "TIER_1",
  tier2: "TIER_2",
  tier3: "TIER_3",
  tier4: "TIER_4",
};

const TRUST_MAP: Record<string, TrustTier> = {
  strict: TrustTier.Strict,
  managed: TrustTier.Managed,
  expedient: TrustTier.Expedient,
  observer_only: TrustTier.ObserverOnly,
};

interface ConformanceCase {
  id: string;
  trust_tier: string;
  rail: string;
  amount_sat: number;
  volume_decay_tier: string;
  system_load_factor: number;
  enterprise_subscription_cap: boolean;
  expected: {
    percentage_fee_sat: number;
    flat_floor_sat: number;
    effective_fee_sat: number;
    effective_bps: number;
    distribution: {
      operations_sat: number;
      founders_sat: number;
      ecosystem_sat: number;
    };
  };
}

describe("fee conformance vectors (ADR-004)", () => {
  for (const c of fixture.cases as ConformanceCase[]) {
    it(`matches canonical vector: ${c.id}`, () => {
      const result = calculateDynamicFee({
        tier: TRUST_MAP[c.trust_tier],
        rail: RAIL_MAP[c.rail],
        amountSat: BigInt(c.amount_sat),
        volumeDecayTier: TIER_MAP[c.volume_decay_tier],
        systemLoadFactor: c.system_load_factor,
        enterpriseSubscriptionCap: c.enterprise_subscription_cap,
      });

      expect(result.percentageFeeSat).toBe(BigInt(c.expected.percentage_fee_sat));
      expect(result.flatFloorSat).toBe(BigInt(c.expected.flat_floor_sat));
      expect(result.effectiveFeeSat).toBe(BigInt(c.expected.effective_fee_sat));
      expect(result.effectiveBps).toBe(c.expected.effective_bps);
      expect(result.distribution.operationsSat).toBe(
        BigInt(c.expected.distribution.operations_sat),
      );
      expect(result.distribution.foundersSat).toBe(
        BigInt(c.expected.distribution.founders_sat),
      );
      expect(result.distribution.ecosystemSat).toBe(
        BigInt(c.expected.distribution.ecosystem_sat),
      );
    });
  }
});
