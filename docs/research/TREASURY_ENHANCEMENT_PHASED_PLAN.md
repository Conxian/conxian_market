# Treasury & Protocol Fee — Consolidated Phased Plan

> **Status:** Plan | **Date:** 2026-11-14 | **Supersedes:** the ad-hoc phase list in
> `CON1427_IMPLEMENTATION_PLAN.md` §4 (kept for history)
> **Grounding:** every status below was checked against code, not against other
> docs' status tables. Sources: `src/`, `contracts/`, and a read-only audit of
> `Conxian/conxian-gateway`.

This is the single plan for making the protocol fee real: computed, routed,
collected, and used. It records what exists, what is missing, who owns each piece,
and the decisions that must be made before anything is switched on.

---

## 0. The canonical model (as documented)

Two distinct money movements, from `FUNDING_AND_ECONOMICS.md` §2.1/§2.3 and
ADR-001 §1.1/§1.2 (as aligned by PR #355):

```
gross G
  ├── protocol fee  F = max(G × decayed_bps/10_000, rail_floor) × load_factor   (ADR-005)
  │        └──► 50% Operations / 30% Founders / 20% Ecosystem
  └── net = G − F
           └──► 80% Builder / 10% Platform Treasury / 10% Ecosystem Stakeholders
```

**Open decision D-1 (blocks final fee activation).** The docs place the 50/30/20
split on the *fee* `F` (ADR-001 §1.2 "applied to the fee F"; `FUNDING` §2.1), while
the code applies it to the 10%-of-net platform-treasury slice
(`src/protocol_fee_settlement.ts`). These produce different amounts. The two must
be reconciled before collection is enabled. See §4.

**Open decision D-2.** Whether the 80/10/10 matrix is a *per-settlement* deduction
or an *aggregate* revenue statement. Per-settlement, it implies a ~20% protocol
take, which contradicts the 0.5%-class fee; in aggregate it is a harmless
descriptive split. This determines whether the treasury/ecosystem legs are actual
per-job transfers.

---

## 1. What exists today (verified)

| Component | Repo | Status | Evidence |
|---|---|---|---|
| Fee calculator (dynamic hybrid, ADR-005) | market | ✅ implemented | `src/fee_calculator.ts` (`calculateRailFee`, `calculateDynamicFee`) |
| 80/10/10 yield split | market | ✅ implemented | `src/bos_yield_splitter.ts` (`calculateYieldSplit`) |
| Escrow release | market | ⚠️ partial | `src/job_card_escrow.ts:233-263` — computes split, routes **builder leg only**; treasury/ecosystem legs dropped |
| Fee destination contract | market | ✅ implemented, **not deployed** | `contracts/protocol-fee-vault.clar` (ADR-006) |
| Settlement/utilisation planner | market | ✅ implemented, **no pipeline caller** | `src/protocol_fee_settlement.ts` |
| Fee report client | market | ⚠️ defined, **never called** | `src/gateway_client.ts` (`submitFeeReport`); zero callers |
| `X-Conxian-Fee` header builder | market | ⚠️ test-only | `src/fee_calculator.ts` (`toWireHeaders`) |
| Gateway billing structs | gateway | ⚠️ **dead code** | `internal/engine/src/billing.rs:434-508`; `accumulate_protocol_fee` / `generate_protocol_fee_report` have **no non-test callers** |
| Gateway fee HTTP endpoint | gateway | ❌ absent | no `/api/v1/billing/fee-report`, no `/admin/protocol-fees` |
| Gateway → contract settlement | gateway | ❌ absent | `ContractBridge` exists but is never constructed; no signer, no broadcast; no `.clar` in repo |
| Treasury auto-staking (Babylon) | gateway | ❌ absent | `treasury/mod.rs` fails closed (#880); `StakingPosition` is a read-only classifier |
| Treasury dashboard | platform | ❌ absent | `treasury/page.tsx` shows "not published" |
| Monthly transparency report | market | ✅ implemented | `src/treasury_report.ts` |

**Bottom line:** the fee is *computed, split and (partially) reported*, but **no
fee has ever been collected and no destination is deployed**. Both the market and
gateway sides of the "collection pipeline" are, at the wiring level, stubs.

---

## 2. Phases

Owners: **market** = this repo; **gateway** = `conxian-gateway`; **ops** = SAB
signing / deployment.

### P0 — Make the destination real and stop dropping legs
| # | Task | Owner | Depends on | Issue |
|---|---|---|---|---|
| P0-1 | Deploy `TREASURY-VAULT` to Stacks testnet | ops | SAB_DEPLOYER_MULTISIG deploy keys | [#360](https://github.com/Conxian/conxian_market/issues/360) |
| P0-2 | Wire escrow release to emit the full settlement plan (not drop treasury/ecosystem legs) | market | D-1, D-2 | [#357](https://github.com/Conxian/conxian_market/issues/357) |
| P0-3 | Call `submitFeeReport` from the release path (opt-in, fail-closed) | market | gateway endpoint (P1-1) | [#359](https://github.com/Conxian/conxian_market/issues/359) |
| P0-4 | Resolve D-1/D-2/D-3 fee-basis + split-scope decision | market/governance | — | [#358](https://github.com/Conxian/conxian_market/issues/358) |

### P1 — Close the gateway collection loop
| # | Task | Owner | Depends on | Issue |
|---|---|---|---|---|
| P1-1 | Add `/api/v1/billing/fee-report` + wire `accumulate_protocol_fee` into the settlement path | gateway | — | [gateway#974](https://github.com/Conxian/conxian-gateway/issues/974) |
| P1-2 | Implement `settle_protocol_fee` (sign + broadcast the `collect-protocol-fee` call) | gateway | P0-1 | [gateway#975](https://github.com/Conxian/conxian-gateway/issues/975) |
| P1-3 | Emit `X-Conxian-Fee` headers on live settlement requests | market | — | [#361](https://github.com/Conxian/conxian_market/issues/361) |

### P2 — Hardening
| # | Task | Owner | Depends on | Issue |
|---|---|---|---|---|
| P2-1 | Replace single-owner vault `pause` with 2-of-3 SAB pause (pause-only) | market | P0-1 | [#362](https://github.com/Conxian/conxian_market/issues/362) |
| P2-2 | Provision `SAB-TREASURY-MS` (3-of-5) and `DAO-TREASURY-MS` (5-of-7) | ops | P0-1 | [#364](https://github.com/Conxian/conxian_market/issues/364) |

### P3 — Utilisation
| # | Task | Owner | Depends on | Issue |
|---|---|---|---|---|
| P3-1 | Babylon auto-stake of treasury balance | gateway | P2-2 | gateway umbrella: [#880](https://github.com/Conxian/conxian-gateway/issues/880) |
| P3-2 | Treasury dashboard queries | platform | P2-2 | [platform#1625](https://github.com/Conxian/conxius-platform/issues/1625) |
| P3-3 | Enable `protocolFeeActive` after a shadow-mode settlement verifies end to end | ops/market | all above | [#363](https://github.com/Conxian/conxian_market/issues/363) |

---

## 3. Cross-repo dependency map

```
market ──(fee report)──► gateway ──(contract call)──► TREASURY-VAULT (market, deployed by ops)
   │                         │
   │                         └──► SAB-TREASURY-MS / DAO-TREASURY-MS (ops)
   └──(planner, escrow)──► builder / ecosystem (direct)
```

- **market** owns: computation, the destination contract, the planner, the report client.
- **gateway** owns: accumulating fee records, the report endpoint, and the on-chain submit.
- **ops** owns: deploy keys, the multisigs, and the shadow-mode → active flip.

Nothing on the gateway side can be done from this repo; those items are tracked as
cross-repo issues and must not be counted as delivered here.

---

## 4. Decisions required before collection is enabled

1. **D-1** — does 50/30/20 apply to the fee `F`, to the 10%-of-net platform-treasury
   slice, or to both? (Blocks P0-2.)
2. **D-2** — is 80/10/10 a per-settlement deduction or an aggregate statement?
   (Blocks P0-2.)
3. **D-3** — deploy the vault from `conxian_market` (ADR-006 re-home) vs. revive a
   protocol repo? ADR-006 chose the re-home; confirm.
4. **D-4** — with the 2% rate retired (ADR-005), do the remaining 2%-era docs
   (`SETTLEMENT_RAILS.md`, `trust_tier_pricing.md`, `monitoring.md`) still need
   sweeping? PR #355 began this.

Until D-1 and D-2 are settled, the planner must not be wired into the escrow
release path, because it would encode a split basis that may be wrong.

---

## 5. What this plan deliberately does not do

- It does not enable `protocolFeeActive`.
- It does not change the fee rate or the split maths.
- It does not claim any deployment, custody, or collection exists.

---

## References

- `docs/adr/ADR_001_FEE_MODEL.md` — recipients, split, custody, caps
- `docs/adr/ADR_005_COMPETITIVE_RATES_WITH_COST_RECOVERY.md` — the fee rate
- `docs/adr/ADR_006_PROTOCOL_FEE_DESTINATION_AND_SWEEP.md` — destination + sweep
- `docs/research/FEE_DESTINATION_AND_CUSTODY.md` — destination/custody spec (PR #355)
- `docs/research/CON1427_IMPLEMENTATION_PLAN.md` — original 4-phase plan
- `contracts/protocol-fee-vault.clar`, `src/protocol_fee_settlement.ts`
