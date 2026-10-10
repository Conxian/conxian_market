# ADR 005: Competitive Rates with a Non-Negotiable Cost-Recovery Floor

> **Status:** Proposed (final numbers for sign-off)
> **Date:** 2026-10-10
> **Author:** Conxian KB maintenance agent (botshelomokoka)
> **Deciders:** Conxian Core Maintainers
> **Owner directives (2026-10-10):** price from top-tier competitors and learn
> dynamic patterns; EVM settles on **L2** (low cost); expand research to cover
> G8 costs; fold the legacy-path migration into the same PR.

---

## 1. Context & Problem Statement

Owner directive: the protocol must **operate profitably on every settlement** —
the fee must be ≥ cost + margin, or we are subsidising the client (the
"R10 for a R12 cup of tea" failure: a fee cheaper than our own settlement cost
loses money per transaction).

Two related asks are bundled with that directive:

1. **"Cheaper than all"** — lower the headline percentage rates so Conxian is
   competitive with Lightning/processor/DEX fees.
2. **Simplify** — remove per-rail fee offsets (`RAIL_FEE_OFFSET_BPS`) so there is
   one percentage rate per tier, not a per-rail matrix.

Naïvely lowering the percentage alone is unsafe in two independent ways:

- **The legacy path has no satoshi floor.** `calculateRailFee` (`TIER_FEE_BPS`
  + `RAIL_FEE_OFFSET_BPS`, floored only at `max(10, …)` *basis points*) still
  rounds micro-settlements to **0 sats** — the exact "Zero-Value Trap" ADR-004
  identified. It is the live settlement path for `job_card_escrow.ts`,
  `trust_tier_middleware.ts`, and `sdk_bridge.ts`. Lowering `TIER_FEE_BPS`
  makes the zero-fee window *larger*, not smaller.
- **The v0 cost estimates under-price on-chain rails.** ADR-004's flat floor is
  `cost × (1 + 25%)`, but the cost table is first-principles and uncalibrated
  (the source comment reads "Replace with measured cost when per-rail telemetry
  lands — G8"). On-chain rails (sBTC/RGB/Statechain) settle at real chain fees
  far above the current 16–40 sat guesses, so the floor itself can under-recover.

This ADR resolves the tension: **compete on the percentage, never lose on the
floor.**

## 2. Decision

1. **Cost-recovery invariant (hard, non-negotiable).** Every non-observer
   settlement satisfies
   `effective_fee_sat ≥ rail_cost_sat × (1 + margin_bps / 10_000)`,
   enforced by composition: `max(percentage_fee, flat_floor) × load_factor`.
   The floor is the "never subsidise a client" guarantee and must never be
   removed, bypassed, or lowered below cost.

2. **One rate all networks.** Delete `RAIL_FEE_OFFSET_BPS`. The percentage
   component is a single volume-based rate; rail differences are captured *only*
   in the flat floor (where cost actually lives).

3. **Competitive percentage rates (the profit layer).** `VOLUME_DECAY_BPS` is
   lowered so the *effective* rate is cheaper than every processor (0.5–1%) and
   card rail (2.5–3.5%), while staying above raw Lightning routing
   (~0.01–0.08%) to reflect Conxian's attestation/routing/SLA value.

   | Tier | Basis Points | Rate | (was) |
   | :--- | ---: | ---: | ---: |
   | `TIER_1` | 50 | 0.50% | 200 (2.00%) |
   | `TIER_2` | 25 | 0.25% | 150 (1.50%) |
   | `TIER_3` | 15 | 0.15% | 75 (0.75%) |
   | `TIER_4` | 10 | 0.10% | 25 (0.25%) |

   The percentage only ever *raises* the fee above the floor, so lowering it
   cannot, by itself, cause a loss.

4. **Recalibrate the cost floor (the cost layer).** Replace the v0
   `RAIL_COST_ESTIMATE_SAT` with researched per-rail costs (see §3.2): raise the
   three rails that carry a real Bitcoin L1 component (Statechain/RGB/sBTC) and
   lower EVM to its confirmed **L2** venue. Values are engineering estimates
   pending G8 measured telemetry.

5. **Canonicalise the dynamic model.** `calculateDynamicFee` (the floor-bearing,
   Rust-mirrored path) becomes the single settlement path. `calculateRailFee`
   becomes a thin deprecated wrapper that delegates to it (defaulting to
   `TIER_1`), so its three callers become cost-safe automatically — the
   migration is folded in. `TIER_FEE_BPS` (a TS-only, trust-tier percentage not
   present in the Rust canonical model) is retired; the volume-decay schedule
   supersedes it.

## 3. Design

### 3.1 Effective Fee Composition (unchanged invariant)

```
percentage_fee_sat = amount_sat × decayed_bps / 10_000
base_fee_sat       = enterprise_cap ? flat_floor_sat
                                    : max(percentage_fee_sat, flat_floor_sat)
effective_fee_sat  = base_fee_sat × system_load_factor        (load ∈ [1.0, 3.0])
```

The `max(…, flat_floor_sat)` term is the entire cost-recovery guarantee. The
percentage is the profit layer applied only when it exceeds the floor.

### 3.2 Rail Cost & Floor Recalibration (researched — see benchmark doc)

| Rail | v0 cost (sat) | Researched cost (sat) | Floor (×1.25) | Basis |
| :--- | ---: | ---: | ---: | :--- |
| Lightning | 8 | 8 | 10 | median routing ~1–2 sat (live) |
| Statechain | 20 | **100** | **125** | flat 100 sat VTXO transfer |
| Fedimint | 20 | 20 | 25 | e-cash, near-zero transfer |
| RGB | 16 | **250** | **312** | Bitcoin OP_RETURN anchor |
| sBTC | 40 | **300** | **375** | Bitcoin L1 peg + Stacks tx |
| AlexStacks | 40 | 40 | 50 | Stacks tx ~sub-cent |
| Babylon | 40 | 40 | 50 | Cosmos tx ~sub-cent |
| EVM_ERC8183 (L2) | 80 | **60** | **75** | Base/Arb/Opt L2 gas + L1 data |

> Full sourcing and confidence notes: `docs/research/FEE_MODEL_COMPETITIVE_BENCHMARK_AND_G8_COST.md`.
> G8 measured telemetry remains the eventual source of truth
> (`calibrateRailFloorFromMeasuredCost` / `rail_floor_from_cost` already provide
> the calibration path).

### 3.3 Cost-Recovery Breakeven (why this is safe)

The percentage overtakes the floor only when
`amount_sat = floor × 10_000 / decayed_bps` (TIER_4 = 10 bps):

| Rail | Floor | Breakeven amount |
| :--- | ---: | ---: |
| Lightning | 10 sat | 10,000 sat (~$10) |
| RGB | 312 sat | 312,000 sat (~$312) |
| sBTC | 375 sat | 375,000 sat (~$375) |
| EVM_ERC8183 (L2) | 75 sat | 75,000 sat (~$75) |

Below the breakeven the floor dominates and cost + 25% is always recovered; above
it the percentage (profit) dominates. We compete on the profitable layer and
refuse to lose on the rest.

## 4. Consequences

- **Positive** — guaranteed cost recovery on every settlement; one simple
  percentage rate per tier; competitive headline rates; the flat floor is
  explicit and auditable; the Rust↔TS surfaces stay aligned (G4).
- **Negative** — on-chain micro-settlements carry a materially higher *effective*
  bps (e.g. 375 sat floor on a 500-sat sBTC payment ≈ 7500 bps); this is
  intentional dust protection and must be surfaced in fee reports.
- **Neutral** — revenue split stays 50/30/20; the trust-tier matrix (rail
  eligibility) is preserved; only its percentage schedule is retired.

## 5. Owner Decisions (resolved)

1. **Percentage numbers** → set from top-tier competitor research (0.50%–0.10%),
   not by fiat. Adopted `50 / 25 / 15 / 10`.
2. **EVM venue** → **L2**, low cost. EVM floor set to 75 sat (not the L1 2500).
3. **Floor calibration** → expanded research to cover G8 costs now; ship the
   researched estimates and leave the `TODO(G8)` measured-telemetry path.
4. **Migration** → fold into the same PR (via the `calculateRailFee`→
   `calculateDynamicFee` delegation).

## 6. Implementation Scope

- `conxian_market/src/fee_calculator.ts`: lower `VOLUME_DECAY_BPS` to 50/25/15/10;
  delete `RAIL_FEE_OFFSET_BPS`; retire `TIER_FEE_BPS`; recalibrate
  `RAIL_COST_ESTIMATE_SAT`; make `calculateRailFee` delegate to
  `calculateDynamicFee` (TIER_1) so all callers are cost-safe.
- `conxian_market/tests/*` + `tests/fixtures/fee_conformance.json`: regenerate
  vectors for the new rates/floors.
- `lib-conxian-core/src/fee.rs`: mirror `raw_basis_points` 50/25/15/10 and the
  recalibrated `rail_cost_estimate`; update inline tests.
- `lib-conxian-core/fixtures/fee_conformance.json`: **byte-identical** to the
  market SDK fixture (cross-repo behavioral contract).
- `docs/adr/ADR_004_DYNAMIC_FEE_FLOOR_MODEL.md`: mark the v0 floor table as
  superseded by ADR-005.
