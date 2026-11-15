# The Fee Model Across the Full System — Spread Analysis

> ⚠️ **SUPERSEDED (2026-11-14, ADR-007).** The fee/revenue model in this document is
> **historical**. The accepted model is **two products** — rail (ADR-005 dynamic rate)
> and matched job (**10% take, builder keeps 90%**) — under **one 50/30/20 split rule on
> the take**. There is no 2% fee, no 80/10/10, and no 5-stream revenue (no collection
> path). Numbers below are retained for history. Authoritative:
> `docs/adr/ADR_007_TWO_PRODUCT_RATE_MODEL.md`.


> **Status:** Analysis | **Date:** 2026-11-14
> **Companion:** `FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` (the economics),
> `TREASURY_ENHANCEMENT_PHASED_PLAN.md` (the delivery plan)
> **Scope:** every layer that touches money — market, x402, gateway, BOS control
> plane, vault, platform.

The fee model is not one thing in one place. It is a value that is *computed* in one
layer, *carried* in another, *collected* in a third, *held* in a fourth, and
*reported* in a fifth. This document spreads the model across all layers, shows
where it is real and where it is a stub, and identifies the single choke point.

---

## 1. The layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ L5  PLATFORM (conxius-platform)   treasury dashboard, monthly report          │
│      ↑ reads                                                      [not built] │
├─────────────────────────────────────────────────────────────────────────────┤
│ L4  BOS CONTROL PLANE             orchestration, governance, release gates    │
│      ↑ observes                                                   [deploy-locked]│
├─────────────────────────────────────────────────────────────────────────────┤
│ L3  GATEWAY (conxian-gateway)     billing.rs, MRR, fee accumulation, settle   │
│      ↑ fee report          [structs exist; NO caller; NO endpoint; NO submit] │
├─────────────────────────────────────────────────────────────────────────────┤
│ L2  x402 PAYMENT RAIL             HTTP 402 → payment demand → receipt         │
│      ↑ payment             [facade + v2 wire shipped; fee not attached]       │
├─────────────────────────────────────────────────────────────────────────────┤
│ L1  MARKET (conxian_market)       fee_calculator + bos_yield_splitter         │
│      ↑ computes F          [SHIPPED — the only real fee math in the system]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ L0  VAULT (contracts)             TREASURY-VAULT intake + sweep               │
│      ↑ receives F          [SHIPPED code; NOT deployed]                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The choke point is between L1 and L3.** L1 computes the fee and stops. L3 is
supposed to collect it and does not. Everything above L3 is downstream of a number
that currently has nowhere to go.

---

## 2. Layer-by-layer spread of the fee model

| Layer | What it does with the fee | File / evidence | Real? |
|---|---|---|---|
| **L0 Vault** | Receives `F` (passive intake); sweeps 50/30/20 on command | `contracts/protocol-fee-vault.clar` | Code real; **not deployed** |
| **L1 Market** | Computes `F = max(amount×decay, floor)×load`; splits net 80/10/10 | `src/fee_calculator.ts`, `src/bos_yield_splitter.ts` | **Real** |
| **L1 Market** | Escrow release routes the **builder leg only** | `src/job_card_escrow.ts:233-263` | **Partial** — treasury/ecosystem legs dropped |
| **L1 Market** | Settlement/utilisation planner | `src/protocol_fee_settlement.ts` | Real code; **no caller** |
| **L1 Market** | Fee report client | `src/gateway_client.ts` `submitFeeReport` | Defined; **never called** |
| **L2 x402** | Carries the payment demand for a job card | `src/x402_facade.ts`, `src/x402_v2_wire.ts` | Shipped; **fee not attached to the demand** |
| **L3 Gateway** | Accumulates `ProtocolFeeRecord`s; builds reports | `internal/engine/src/billing.rs:434-508` | Structs real; **no non-test caller** |
| **L3 Gateway** | Fee HTTP endpoint | (absent) | **No** |
| **L3 Gateway** | Signs/broadcasts the `collect-protocol-fee` call | `stacks/contract_bridge.rs` (never constructed) | **No** — no signer, no broadcast |
| **L4 BOS** | Orchestration, release gates, treasury policy | control plane | **Deploy-locked** (billing lock, frozen build) |
| **L5 Platform** | Dashboard, monthly report | `src/treasury_report.ts` (report only) | Report real; **dashboard not built** |

---

## 3. The 5-stream revenue model — spread and reality

`FUNDING_AND_ECONOMICS.md` §5 describes five revenue streams. Spread against code:

| # | Stream | Doc says | Code reality | Verdict |
|---|---|---|---|---|
| 1 | Protocol fee (rate) | ⛔ Blocked (CON-1427) | Computed in L1; never collected | **Blocked** |
| 2 | Premium surcharge (+0.5% Managed) | ⛔ Blocked (attestation) | Not wired; `attestationAvailable=false` | **Blocked** |
| 3 | Institutional (negotiated) | ⛔ Blocked (TEE+ZK) | Not present | **Blocked** |
| 4 | Community pools (1%, Fedimint) | ✅ **Ready** | Fedimint adapter exists, but no fee is collected from it either | **Overclaim** |
| 5 | Staking yield (3-5% APY, Babylon) | ✅ **Ready** | Gateway `treasury/mod.rs` fails closed (#880); no auto-stake | **Overclaim** |

**Finding.** Two of the five streams are marked "✅ Ready" but are not collecting:
the Fedimint "community pool" has no fee path, and Babylon staking is disabled
because provider evidence is unqualified. So the "current realizable revenue:
~$1,500/mo" figure in the doc is itself unverified — the two "ready" streams do not
produce revenue in code. The honest current state is closer to **$0 collected**.

> This is a documentation-drift finding, consistent with the pattern already fixed
> elsewhere this session: status tables that assert a capability the code does not
> implement. It belongs in the next docs-alignment pass.

---

## 4. x402 — the payment rail that should carry the fee

x402 is the HTTP-native payment protocol (HTTP `402 Payment Required`) the market
uses to express a job's price as a machine-readable payment demand. The market ships
`x402_facade.ts` (job card → payment demand) and `x402_v2_wire.ts` (the v2 wire
format), tracked in market issues #176 (conformance contracts) and #159 (real
payment pointer + demand).

**Where the fee fits.** In a correct design the protocol fee is *inside* the x402
payment demand: the client is asked to pay `net + F`, and the split routes the parts.
Today the facade expresses the bounty but **does not attach the fee**, so the fee is
computed in L1 and the payment rail (L2) is fee-blind. That is a second choke point,
separate from the gateway one.

```
job card (bounty B)
   │
   ├─ x402_facade.jobCardToDemand()  →  { amount: B }        ← fee NOT attached
   │
   └─ fee_calculator.calculateDynamicFee()  →  F = max(B×r, floor)×load
                                                ← computed, then dropped
```

**Recommendation.** The x402 demand should carry `{ net, fee, feeBps, rail, tier }`
so that the payment rail is the *transport* of the fee, not a separate hop. That
makes the gateway's job (L3) mechanical: read the fee from the payment receipt rather
than recompute it. This also aligns with x402 v2's `Settlement` field.

---

## 5. BOS control plane — where the fee is governed, not computed

BOS (the business operating system / control plane) does not compute or collect the
fee. Its role is **governance and orchestration**: release gates, treasury policy,
the monthly transparency report, and the DAO votes that change the rate.

From this session's org audit, BOS is **deploy-locked** (a frozen 2026-11-07 build;
the image pipeline is blocked by the same billing lock). So even the governance layer
that would ratify a fee change (decision D-1) is currently not in a state to ship
the change. That makes the D-1 decision a *paper* decision for now — it must be
recorded in ADR-001/ADR-006, and the code change follows when CI is unblocked.

**Spread consequence.** The fee model depends on BOS for *legitimacy* (the DAO vote
and the ADR) but not for *execution*. Execution is L1→L3→L0. This is why the
recommendation in the companion doc can be acted on even while BOS is frozen: the
decision is recorded, and the wiring proceeds independently.

---

## 6. The unit-economics spread (one settlement, all layers)

A 1,000,000-sat settlement on Stacks at the launch rate, followed through every layer:

| Layer | Action | Amount (sat) |
|---|---|---:|
| L1 | gross bounty locked in escrow | 1,000,000 |
| L1 | fee computed `F = max(1e6×0.005, 50)×1.0` | 5,000 |
| L1 | net to builder split | 995,000 |
| L2 | x402 demand presented to client (today: fee not attached) | — |
| L3 | fee report (today: not called) | — |
| L0 | vault intake (today: not deployed) | — |
| L5 | reported | — |

Only the first three rows actually happen in code. Rows 4–6 are the gap.

---

## 7. Where the leverage is

| Rank | Lever | Layer | Blocks |
|---|---|---|---|
| 1 | Collect the fee at all | L1→L3 | 100% of fee revenue |
| 2 | Attach the fee to the x402 demand | L2 | transport correctness |
| 3 | Resolve D-1 (split basis) | governance | everything downstream |
| 4 | Calibrate rail costs | L1 | floor correctness |
| 5 | Deploy the vault | L0 | any settlement |
| 6 | Dashboard + report | L5 | transparency only |

**The single highest-leverage action is unchanged from the plan: close the L1→L3
collection gap.** The x402 attachment (rank 2) is the cheapest *additional* fix and
makes the rest mechanical.

---

## 8. Recommended full-system design (spread view)

```
client
  │  x402 payment demand  { net, fee, feeBps, rail, tier }        ← L2 carries the fee
  ▼
gateway  ── reads fee from receipt ── accumulates ProtocolFeeRecord  ← L3 collects
  │
  ├─ settle job (net) ──► builder (direct, non-custodial)          ← L1 escrow
  └─ settle fee (F)   ──► TREASURY-VAULT.collect-protocol-fee      ← L0 receives
                              │
                              └─ sweep 50/30/20 ──► Ops / Founders / Ecosystem
                                                                    ← L0 distributes
BOS     ── ratifies rate changes (DAO), publishes report           ← L4 governs
platform ── dashboard reads vault + gateway                        ← L5 reports
```

Each layer has one job. The fee is computed once (L1), carried once (L2), collected
once (L3), held once (L0), governed once (L4), and reported once (L5). Today, layers
2–5 are stubs.

---

## 9. Gaps this spread surfaces (for the next alignment pass)

1. `FUNDING_AND_ECONOMICS.md` §5 marks streams 4 and 5 "✅ Ready" — neither collects.
2. `FUNDING_AND_ECONOMICS.md` §5 still quotes the **retired 2%** rate and the old
   $21,100 target — needs the ADR-005 sweep (PR #355 began this).
3. `src/fee_calculator.ts` `projectRevenue` still hardcodes **2% / 0.5% / 0.3% / 0.1%
   / 0.1%** across five streams — a live 2%-era remnant in code.
4. x402 facade does not attach the fee to the payment demand.
5. No layer submits a settlement or transfers value on-chain.

Items 1–3 are documentation/code drift; 4–5 are the build gaps tracked in the plan.

---

## References

- `docs/research/FUNDING_AND_ECONOMICS.md` §3.4, §5
- `docs/research/FULL_SYSTEM_ARCHITECTURE.md` §2.1
- `src/x402_facade.ts`, `src/x402_v2_wire.ts`, `src/mcp_402.ts`
- `src/fee_calculator.ts` (`projectRevenue`, `calculateDynamicFee`)
- `src/job_card_escrow.ts`, `src/protocol_fee_settlement.ts`
- `docs/research/TREASURY_ENHANCEMENT_PHASED_PLAN.md`
- `docs/research/FEE_MODEL_ECONOMICS_JUXTAPOSITION.md`
