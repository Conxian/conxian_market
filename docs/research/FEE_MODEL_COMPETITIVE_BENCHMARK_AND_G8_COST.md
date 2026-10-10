# Competitive Fee Benchmark & G8 Rail-Cost Calibration

> **Date:** 2026-10-10
> **Scope:** Ground ADR-005 rate decisions in (a) top-tier competitor take-rates and
> (b) measured per-rail settlement costs (the G8 calibration ADR-004 deferred).
> Companion to `docs/adr/ADR_005_COMPETITIVE_RATES_WITH_COST_RECOVERY.md`.

---

## 1. Competitor take-rates (the "cheaper than all" anchor)

| Player | Take-rate / fee | Model | Source |
| :--- | :--- | :--- | :--- |
| OpenNode | **1%** flat | % of payment/payout | opennode.com/pricing (verified 2026-10-10) |
| Coinbase Commerce | **1%** | % of payment | help.coinbase.com commerce fees |
| BitPay | **1–2%** | % + network fee | bitpay.com pricing |
| NOWPayments | **0.5–1%** | % per rail | nowpayments.io fees |
| Card networks (Visa/MC) | **~1.5–2.5%** interchange + assessment + processor ≈ **2.5–3.5%** total | interchange-plus | visa.com interchange tables |
| Uniswap v3 | **0.05 / 0.30 / 1.00%** | pool tier | docs.uniswap.org fees |
| ALEX (Stacks DEX) | **0.3%** | swap fee | docs.alexlab.co |
| Lightning routing | **median 100 ppm + 500 msat** (avg 823 ppm + 904 msat) | base + ppm per node | mempool.space lightning API (live) |
| x402 (Coinbase) | **0% protocol fee** | open standard, service charges its own | x402.org / coinbase docs |

**Read:** the floor of "cheaper than all" is Lightning routing (~0.01–0.08%) and x402
(0%); the ceiling is card interchange (~2.5–3.5%) and crypto processors (~0.5–1%).
A competitive protocol take-rate sits in **0.10%–0.50%**, below every processor and
card rail, while remaining above raw Lightning routing — justified by the
attestation (TEE/ZK), rail-routing, and SLA value Conxian adds.

## 2. Dynamic-pricing patterns worth mirroring

| Pattern | Mechanism | Conxian mapping (ADR-004) |
| :--- | :--- | :--- |
| **EIP-1559** (Ethereum) | base fee rises with block-space demand; priority tip buys urgency | `systemLoadFactor` (1.0–3.0) from mempool percentile |
| **Card interchange-plus** | cost + assessment + processor markup, tiered by card type | `flat_floor = cost × (1 + 25%)` + percentage layer |
| **Lightning base + ppm** | flat base fee + proportional rate, set per node | flat satoshi floor + percentage |
| **Volume/loyalty decay** | sustained volume earns a lower rate | `VOLUME_DECAY_BPS` 4-tier decay + hysteresis |

Conxian's model already composes three of these (floor + percentage + load). The
percentage *decay* is the only purely-voluntary layer — it can be cut aggressively
because `max(percentage, floor)` guarantees cost recovery regardless.

## 3. G8 rail-cost calibration (replaces the v0 first-principles estimates)

Grounding data collected 2026-10-10 (live where noted):

- **Bitcoin L1 feerate:** 1 sat/vB (mempool.space `/api/v1/fees/recommended`, live).
  This is a low-congestion trough; planning should assume a moderate band
  (~5–10 sat/vB) so the floor never under-recovers in normal traffic.
- **Lightning:** median 100 ppm + 500 msat base, avg 823 ppm + 904 msat
  (mempool.space `/api/v1/lightning/statistics/latest`, live). A typical payment
  routes for **~1–2 sats**.
- **EVM L2:** Base ~0.006 gwei, Arbitrum ~0.02 gwei, Optimism ~0.001 gwei
  (`eth_gasPrice` via public RPC, live); plus an L1 data fee → **~$0.01–0.10**
  (~10–100 sats) per transfer.

Per-rail cost table (sats @ ~$100k BTC):

| Rail | v0 estimate | Researched cost | Floor (×1.25) | Basis / confidence |
| :--- | ---: | ---: | ---: | :--- |
| Lightning | 8 | ~1–2 | **10** | median routing (live) — keep 8 (conservative) — high |
| Statechain | 20 | **100** | **125** | flat 100 sat VTXO transfer (`SETTLEMENT_RAILS.md` §2.3) — high |
| Fedimint | 20 | ~10 | **25** | e-cash transfer 0%; mint 0.1–0.5% community — medium |
| RGB | 16 | **250** | **312** | Bitcoin OP_RETURN anchor, batch-amortized — medium |
| sBTC | 40 | **300** | **375** | Bitcoin L1 peg + Stacks tx — medium |
| AlexStacks | 40 | ~40 | **50** | Stacks tx ~sub-cent — medium |
| Babylon | 40 | ~40 | **50** | Cosmos tx ~sub-cent — medium |
| EVM_ERC8183 (L2) | 80 | **60** | **75** | Base/Arb/Opt L2 gas + L1 data — high |

**Key corrections vs v0:** Statechain, RGB, and sBTC were materially *under-priced*
(they carry a real Bitcoin L1 component); EVM was over-priced for an **L2** venue
(the operator confirmed ERC-8183 settles on L2, not L1). These four are the rails
where the old floor could have let Conxian subsidise the client — exactly the
failure mode ADR-005 exists to prevent.

> **G8 is still the eventual source of truth.** These are researched engineering
> estimates that close the worst gaps now; they are replaced by measured per-rail
> telemetry when it lands. The calibration path already exists
> (`calibrateRailFloorFromMeasuredCost` / `rail_floor_from_cost`).

## 4. Final recommended schedule (for sign-off)

- **Percentage (profit layer):** `50 / 25 / 15 / 10` bps (0.50% → 0.10% volume decay).
- **Floor (cost layer):** the researched `×1.25` floors above.
- **Structure:** `fee = max(amount × rate, rail_floor) × load`, 50/30/20 split.
