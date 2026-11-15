# Treasury & Protocol Fee — Consolidated Phased Plan

> **Status:** Plan | **Date:** 2026-11-14 (status refresh 2026-11-15) | **Supersedes:** the
> ad-hoc phase list in `CON1427_IMPLEMENTATION_PLAN.md` §4 (kept for history)
> **Grounding:** every status below was checked against code, not against other
> docs' status tables. Sources: `src/`, `contracts/`, a read-only audit of
> `Conxian/conxian-gateway` `dev`, and `ADR_007_TWO_PRODUCT_RATE_MODEL.md`.
>
> **2026-11-15 refresh:** D-1/D-2 are **resolved by ADR-007** (§4). The market
> planner, escrow routing, fee-report client and header emission are now wired
> (§1). The gateway report endpoint landed as
> [conxian-gateway PR #979](https://github.com/Conxian/conxian-gateway/pull/979)
> against `dev`.

This is the single plan for making the protocol fee real: computed, routed,
collected, and used. It records what exists, what is missing, who owns each piece,
and the decisions that must be made before anything is switched on.

---

## 0. The canonical model (ADR-007, Accepted 2026-11-14)

**Supersedes** the two-movement model previously quoted here. ADR-007 resolves the
"20× spread" as **two products**, not one rate argued three ways, with **one split
rule**:

```
PRODUCT A — raw rail settlement
  F = max(G × decayed_bps/10_000, rail_floor) × load_factor          (ADR-005)
  └──► 50% Operations / 30% Founders / 20% Ecosystem   (split of F)

PRODUCT B — matched job (a job card)
  take = 10% of gross; the builder keeps 90%
  └──► the same 50/30/20 split applies to the take
```

The **80/10/10** builder matrix is **retired** (ADR-007 §3): it is not a
per-settlement deduction, and the ecosystem is funded from the platform's 50/30/20
— never a second deduction on the builder. The split is computed on the **fee /
take**, not on gross.

**Resolved (was D-1):** the split basis is the fee `F` / the take — **Option A**,
not the 10%-of-net slice (Option B, rejected: a 19.9× larger take). See market
[#358](https://github.com/Conxian/conxian_market/issues/358) for the quantified
decision input (`conxian-business:docs/research/FEE_MODEL_ECONOMICS_JUXTAPOSITION_2026_11_15.md`).

**Resolved (was D-2):** 80/10/10 is **retired**, so there is no second protocol
slice to reconcile.

---

## 1. What exists today (verified)

| Component | Repo | Status | Evidence |
|---|---|---|---|
| Fee calculator (dynamic hybrid, ADR-005) | market | ✅ implemented | `src/fee_calculator.ts` (`calculateRailFee`, `calculateDynamicFee`) |
| Two-product take (ADR-007) | market | ✅ implemented | `src/bos_yield_splitter.ts` (`calculateYieldSplit`; matched job = 10% take, builder keeps 90%) |
| Escrow release | market | ✅ routes full plan | `src/job_card_escrow.ts:275` — calls `buildProtocolFeeSettlement`; builder + vault intake + sweep all emitted (no dropped legs) |
| Fee destination contract | market | ✅ implemented, **not deployed** | `contracts/protocol-fee-vault.clar` (ADR-006) |
| Settlement/utilisation planner | market | ✅ implemented, **wired** | `src/protocol_fee_settlement.ts` (`buildProtocolFeeSettlement`), called from escrow release |
| Fee report client | market | ✅ implemented, **called** | `src/gateway_client.ts` (`submitFeeReport`, `reportSettlementFee`); called from `settleJobCard`/`settleM2M` |
| `X-Conxian-Fee` header builder | market | ✅ live | `src/fee_calculator.ts` (`toWireHeaders`); emitted on live settlement requests |
| Gateway billing structs | gateway | ✅ wired | `internal/engine/src/billing.rs`; `accumulate_protocol_fee` / `generate_protocol_fee_report` now called by `internal/api/src/protocol_fee.rs` |
| Gateway fee HTTP endpoint | gateway | ✅ implemented (PR #979, `dev`) | `POST`/`GET /api/v1/billing/fee-report` (`internal/api/src/protocol_fee.rs`) |
| Gateway → contract settlement | gateway | ❌ absent | `ContractBridge` exists but is never constructed; no signer, no broadcast; no `.clar` in repo (gateway #975) |
| Treasury auto-staking (Babylon) | gateway | ❌ absent | `treasury/mod.rs` fails closed (#880); `StakingPosition` is a read-only classifier |
| Treasury dashboard | platform | ❌ absent | `treasury/page.tsx` shows "not published" |
| Monthly transparency report | market | ✅ implemented | `src/treasury_report.ts` |

**Bottom line:** the fee is now *computed, split, routed, reported and metered* on
both the market and gateway sides. What remains before any value moves: the
destination is **not deployed** (P0-1), the gateway cannot yet **sign or broadcast**
the collect call (P1-2), and activation stays **off** (P3-3). No fee has been
collected and no destination is live.

---

## 2. Phases

Owners: **market** = this repo; **gateway** = `conxian-gateway`; **ops** = SAB
signing / deployment.

### P0 — Make the destination real and stop dropping legs
| # | Task | Owner | Depends on | Issue |
|---|---|---|---|---|
| P0-1 | Deploy `TREASURY-VAULT` to Stacks testnet | ops | SAB_DEPLOYER_MULTISIG deploy keys | [#360](https://github.com/Conxian/conxian_market/issues/360) |
| P0-2 | Wire escrow release to emit the full settlement plan (not drop treasury/ecosystem legs) | market | D-1, D-2 | [#357](https://github.com/Conxian/conxian_market/issues/357) ✅ |
| P0-3 | Call `submitFeeReport` from the release path (opt-in, fail-closed) | market | gateway endpoint (P1-1) | [#359](https://github.com/Conxian/conxian_market/issues/359) ✅ |
| P0-4 | Resolve D-1/D-2/D-3 fee-basis + split-scope decision | market/governance | — | [#358](https://github.com/Conxian/conxian_market/issues/358) ✅ (ADR-007) |

### P1 — Close the gateway collection loop
| # | Task | Owner | Depends on | Issue |
|---|---|---|---|---|
| P1-1 | Add `/api/v1/billing/fee-report` + wire `accumulate_protocol_fee` into the settlement path | gateway | — | [gateway#974](https://github.com/Conxian/conxian-gateway/issues/974) ✅ ([PR #979](https://github.com/Conxian/conxian-gateway/pull/979), `dev`) |
| P1-2 | Implement `settle_protocol_fee` (sign + broadcast the `collect-protocol-fee` call) | gateway | P0-1 | [gateway#975](https://github.com/Conxian/conxian-gateway/issues/975) |
| P1-3 | Emit `X-Conxian-Fee` headers on live settlement requests | market | — | [#361](https://github.com/Conxian/conxian_market/issues/361) ✅ |

### P2 — Hardening
| # | Task | Owner | Depends on | Issue |
|---|---|---|---|---|
| P2-1 | Replace single-owner vault `pause` with 2-of-3 SAB pause (pause-only) | market | P0-1 | [#362](https://github.com/Conxian/conxian_market/issues/362) ✅ |
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

## 4. Decisions

1. **D-1 — RESOLVED (ADR-007, Accepted 2026-11-14).** The split basis is the fee
   `F` / the take — **Option A**. Option B (50/30/20 on a 10%-of-net slice) is
   rejected: it is a 19.9× larger take. Quantified input: market
   [#358](https://github.com/Conxian/conxian_market/issues/358) +
   `FEE_MODEL_ECONOMICS_JUXTAPOSITION_2026_11_15.md`.
2. **D-2 — RESOLVED (ADR-007).** 80/10/10 is **retired**. It was never a
   per-settlement deduction; the matched-job headline is **90/10**, with the
   ecosystem funded from the platform's 50/30/20.
3. **D-3 — RESOLVED (ADR-006).** The destination contract lives in
   `conxian_market` (`contracts/protocol-fee-vault.clar`); no protocol repo is
   revived.
4. **D-4 — OPEN.** With the 2% rate retired (ADR-005), the remaining 2%-era docs
   (`SETTLEMENT_RAILS.md`, `trust_tier_pricing.md`, `monitoring.md`) still need a
   sweep. PR #355 began this; verify each before quoting a rate publicly.

D-1 and D-2 are settled, so the planner **is** wired into the escrow release path
(`src/job_card_escrow.ts:275`). The remaining gate before any value moves is
operational: deploy the vault (P0-1), enable the on-chain submit (P1-2), then run
the shadow-mode settlement and flip `protocolFeeActive` (P3-3).

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
- `docs/adr/ADR_007_TWO_PRODUCT_RATE_MODEL.md` — the two-product model + single 50/30/20 split (resolves D-1/D-2)
- `conxian-business:docs/research/FEE_MODEL_ECONOMICS_JUXTAPOSITION_2026_11_15.md` — quantified split-basis decision input
- `docs/research/FEE_DESTINATION_AND_CUSTODY.md` — destination/custody spec (PR #355)
- `docs/research/CON1427_IMPLEMENTATION_PLAN.md` — original 4-phase plan
- `contracts/protocol-fee-vault.clar`, `src/protocol_fee_settlement.ts`
