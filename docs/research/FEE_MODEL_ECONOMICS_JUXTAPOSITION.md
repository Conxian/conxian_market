# Protocol Fee Model — Juxtaposition & Recommendation

> **Status:** Analysis | **Date:** 2026-11-14
> **Scope:** the full system — `conxian_market` (value layer), `conxian-gateway`
> (collection + billing), BOS control plane, and `conxius-platform` (treasury UI).
> **Reproduce:** `python3 analysis/fee_model_economics.py` → `analysis/charts/*.png`
> and `analysis/fee_model_results.json`.
> **Companion:** `TREASURY_ENHANCEMENT_PHASED_PLAN.md` (the delivery plan),
> ADR-005 (the rate), ADR-006 (the destination).

This document juxtaposes the fee models that are live or documented, overlays the
relevant micro-, macro-, and scaling-economics theory, and states the best option
with the evidence behind it. It also answers the two open decisions (D-1, D-2)
that currently block fee collection.

---

## 1. The models, side by side

| # | Model | Rate | Floor | Where it lives | Verdict |
|---|-------|------|-------|----------------|---------|
| M0 | Flat 2% (retired) | 200 bps | none | ADR-001 (historical) | **Retired** — contradicted the 80/10/10 net split and over-charged vs every benchmark |
| M1 | Dynamic 0.50% + rail floor (launch) | 50 bps → decays | cost × 1.25 | `src/fee_calculator.ts` (ADR-005) | **Shipped** |
| M1' | Dynamic 0.10% + floor (mature) | 10 bps | cost × 1.25 | `VOLUME_DECAY_BPS.TIER_4` | **Shipped** |
| M2 | Floor-only | 0 bps | cost × 1.25 | implied by M1 on micro-payments | The de-facto model on small jobs |
| M3 | Load-scaled | 50 bps × load | cost × 1.25 | `systemLoadFactor` 1.0–3.0 | **Shipped**, congestion pricing |

The shipped model is **M1 composed with M2**: `fee = max(amount × decayed_bps/10⁴,
rail_floor) × load`. The percentage competes; the floor recovers cost. That is a
deliberate "interchange-plus" shape.

![Fee vs size](charts/01_fee_vs_size.png)

**Reading the chart.** On a log-log axis the fee is flat at the floor for small
jobs and follows the percentage line for large ones. The crossover is where
`amount × 0.005 = rail_floor`. For the cheapest rail (Lightning, floor 10 sat) the
crossover is ~2,000 sat; for the most expensive (sBTC, floor 375 sat) it is
~75,000 sat. Below the crossover the floor is the entire fee.

![Effective rate vs size](charts/02_effective_rate_vs_size.png)

**The "zero-value trap" is closed.** The effective rate is high on micro-payments
(that is the floor doing its job) and settles to the headline rate on large ones.
The chart overlays card interchange (~1.5%), Stripe (~2.9%), and Lightning
(~0.03%). At launch the protocol is *between* Lightning and cards — competitive
for agent work, and never zero.

---

## 2. Cost recovery — the non-negotiable layer

![Cost recovery](charts/05_cost_recovery.png)

Every rail's fee is ≥ its measured cost × 1.25. This is the "never subsidise a
client" invariant (ADR-004/005). It is the single most important property of the
model and the one that most comparable protocols get wrong: a fee that rounds to
zero on micro-settlements loses money on exactly the M2M traffic this protocol
targets.

> **Caveat (honest).** `RAIL_COST_ESTIMATE_SAT` is a *first-principles v0 estimate*,
> not measured telemetry (the source comment says so: "Replace with measured cost
> when per-rail telemetry lands — G8"). The floor is only as correct as the cost
> table. Calibration is a prerequisite for trusting the invariant at scale.

---

## 3. Meso economics — the Laffer curve applied to the fee

Revenue is `R(r) = r × V(r)`, where `V(r)` is settled volume as a function of the
rate. If volume is elastic to price, there is an interior revenue-maximising rate.

![Laffer](charts/03_laffer_revenue_vs_rate.png)

| Volume elasticity ε | Revenue-maximising rate | Implication |
|:--:|:--:|---|
| 0.5 | 400 bps | Inelastic — charge more |
| 1.0 | **69 bps** | Unit-elastic — the ~50 bps launch rate is near-optimal |
| 1.5 | 1 bps | The percentage rate's optimum collapses; the **floor** is the revenue |
| ≥2.0 | 1 bps | Same — only the floor collects |

**This is the central finding.** The percentage rate only matters while volume is
inelastic. In a competitive settlement market (many rails, easy multi-homing, a
"race to zero" on routing) elasticity is high, the percentage optimum collapses
toward zero, and **the flat floor becomes the entire revenue line**. The design is
therefore correct to treat the floor as the load-bearing component and the
percentage as the competitive headline. It also means: do not raise the headline
rate hoping for revenue — above ε≈1.5 it destroys revenue.

The empirical anchors for ε come from the transaction-tax literature (Tobin tax,
stamp duty), where estimates of trading-volume elasticity commonly run from about
−1 to −2, i.e. ε ≈ 1–2. At ε=1 the model's 50 bps launch rate is within ~20 bps of
the theoretical optimum.

---

## 4. Two-sided market theory — who pays, not just how much

![Revenue vs volume](charts/04_revenue_vs_volume.png)

Rochet–Tirole and Armstrong show that on a two-sided platform the *structure* of
prices (who pays) matters as much as the *level*. The optimal design subsidises the
price-sensitive, growth-critical side and charges the side with the most inelastic
demand.

- **Builders (supply)** are the scarce side at launch — an AI-labor marketplace
  with no builders has nothing to sell. Builders receive **80% of net**, which is
  correct: the builder is the subsidised side.
- **Clients (demand)** pay the protocol fee. Their demand is elastic (they can
  route around, multi-home, or use another rail), which is *why* the rate must be
  low and decay with volume.
- **Multi-homing** is the binding constraint: because clients and builders can use
  other rails cheaply, the fee cannot exceed the switching-cost wedge. This is the
  mechanism behind the high elasticity in §3.

Cross-side network effects mean the platform's value to each side rises with the
other side's size — which argues for **low fees early to buy liquidity**, then
value-based pricing later. The volume-decay schedule is exactly that.

---

## 5. Scaling economics — why the rate must decline

![Scaling](charts/06_scaling.png)

Metcalfe's law (network value ∝ n²) is contested in its exact exponent
(Briscoe–Odlyzko argue for n·log n), but all variants agree on the shape: **network
value grows super-linearly while per-transaction fee revenue grows linearly.** The
ratio — the platform's "capture ratio" — therefore *falls* as 1/n.

Consequences:
1. A constant percentage rate means capture rises over time and invites
   disintermediation and regulatory attention.
2. The correct long-run design is **declining take rates** — which the volume-decay
   schedule (50→25→15→10 bps) already implements.
3. Marginal cost of settlement trends to zero (software + near-free rail fees), so
   the floor should be revisited down as telemetry proves lower real costs. A floor
   that stays at v0 estimates while real costs fall is a growing margin that
   eventually invites competition.

---

## 6. Macro economics — the BTC denomination problem

![Macro BTC](charts/07_macro_btc.png)

The protocol settles and (intends to) hold value in BTC-denominated units. Under
the quantity theory (MV = PQ) and a hard-capped base, this creates a specific
dynamic:

- **If work is priced in USD and fees are taken as a % of USD value**, the real fee
  is stable, but the *satoshi* fee shrinks as BTC appreciates — so the floor, not
  the rate, eventually governs even large jobs. The floor becomes a real-terms
  escalator *in satoshis*.
- **If work is priced in sats**, a BTC-denominated fee is a **hidden escalator**:
  as BTC appreciates, the real (USD) fee rises without any governance vote. That is
  politically fragile and can drive volume away in real terms.

**Recommendation:** denominate the *fee basis* in the unit the work is priced in
(usually USD-equivalent via an oracle), and hold the *treasury* in the target
allocation (40% stable / 30% RWA / 20% liquid-staking / 10% native). This
decouples the fee's real cost to users from the treasury's real store of value —
the classic separation of unit-of-account from store-of-value.

Seigniorage is *not* available here (the protocol does not issue the money), so the
fee is the only monetary lever. That raises the cost of getting the rate wrong.

---

## 7. Full system — where one settlement goes

![Full system waterfall](charts/08_full_system_waterfall.png)

For a 1,000,000-sat settlement on Stacks at 0.50%:

| Recipient | Basis | sats | Share of gross |
|---|---|---:|---:|
| Builder | 80% of net | 796,000 | 79.6% |
| Platform treasury | 10% of net | 99,500 | 9.95% |
| Ecosystem stakeholders | 10% of net | 99,500 | 9.95% |
| Operations | 50% of fee | 2,500 | 0.25% |
| Founders | 30% of fee | 1,500 | 0.15% |
| Ecosystem (fee leg) | 20% of fee | 1,000 | 0.10% |

This is the layering across the whole system: the **market** computes and routes,
the **gateway** collects and bills, the **vault** receives and sweeps, the
**platform** reports. Every layer is a pass-through except the fee.

---

## 8. Decision D-1 — the split basis (the number that changes everything)

![Split basis](charts/09_split_basis.png)

The docs place 50/30/20 on the **fee F**; the current planner applies it to the
**10%-of-net platform-treasury slice**. The difference is not cosmetic:

| | Operations | Founders | Ecosystem (fee leg) |
|---|---:|---:|---:|
| **A** — 50/30/20 on fee F (docs) | 2,500 | 1,500 | 1,000 |
| **B** — 50/30/20 on 10%-of-net (code) | 49,750 | 29,850 | 19,900 |
| Ratio B/A | 19.9× | 19.9× | 19.9× |

**Option B is ~20× larger.** This is the crux of D-1 and D-2:

- If 80/10/10 is a **per-settlement deduction**, the protocol's real take is ~10%
  of net (≈9.95% of gross here) — roughly **20× the headline 0.50% fee**, and
  larger than Stripe. That would be catastrophic for competitiveness and is almost
  certainly **not** the intent.
- If 80/10/10 is an **aggregate revenue statement** (how total platform revenue is
  notionally shared) and 50/30/20 applies to the **fee F**, then the model is
  coherent and competitive: a 0.50% headline with the fee split 50/30/20.

**Recommended resolution (D-1/D-2): Option A.** Apply 50/30/20 to the fee F, and
treat the 80/10/10 as an aggregate distribution statement, not a per-settlement
deduction. This makes the effective protocol take ~0.50% of gross (plus the floor),
which is consistent with ADR-005, competitive with Lightning-and-cards, and avoids a
hidden ~20% tax.

---

## 9. The best option — recommendation

**Adopt: the shipped M1 model, with 50/30/20 on the fee F, and the floor as the
load-bearing revenue component.**

| Layer | Recommendation | Why |
|---|---|---|
| **Rate** | Keep dynamic 0.50%→0.10% decay | At ε≈1 the Laffer optimum is ~69 bps; 50 bps is near-optimal and competitive |
| **Floor** | Keep cost × 1.25, but **calibrate from telemetry** | It is the real revenue on elastic/high-volume traffic; v0 estimates are unverified |
| **Load factor** | Keep 1.0–3.0 congestion pricing | Aligns price with real rail congestion; correct direction |
| **Split basis** | **50/30/20 on fee F** (Option A) | Avoids a hidden ~20% take (Option B); matches docs and ADR-005 |
| **80/10/10** | Treat as an **aggregate** statement | Per-settlement it implies a ~10%-of-net take — not viable |
| **Denomination** | Price fee basis in the work's unit (USD-equiv); hold treasury 40/30/20/10 | Separates unit-of-account from store-of-value under BTC appreciation |
| **Scale** | Let the decay schedule keep declining; re-floor as costs fall | Capture ratio falls as 1/n; constant rates invite disintermediation |

### What to do first (ordered)

1. **Resolve D-1/D-2 → Option A** (governance, issue #358). Nothing collects until this is settled.
2. **Calibrate the rail cost table** from real telemetry (the floor's correctness depends on it).
3. **Wire the planner with Option A** (issue #357), then the fee report (#359).
4. **Deploy the vault** (#360) and close the gateway loop (gateway #974/#975).
5. **Shadow-mode one settlement**, verify end to end, then flip `protocolFeeActive` (#363).

### What not to do

- Do **not** raise the headline rate to chase revenue — above ε≈1.5 it destroys it.
- Do **not** ship Option B (the ~20× take) — it is a hidden tax that will drive
  volume off-platform.
- Do **not** denominate the fee basis in sats while BTC appreciates — it is an
  unlegislated escalator.

---

## 10. Evidence, confidence, and gaps

| Claim | Basis | Confidence |
|---|---|---|
| Two-sided pricing structure matters as much as level | Rochet–Tirole, Armstrong | High (theory) |
| Revenue has an interior optimum under elastic volume | Laffer / transaction-tax literature | High (theory), Medium (ε magnitude) |
| Network value grows super-linearly; revenue linearly | Metcalfe (+ Briscoe–Odlyzko critique) | Medium (exponent contested) |
| Take rates should decline with scale | Above + near-zero marginal cost | Medium-High |
| BTC denomination creates a real-fee escalator | Quantity theory, hard cap | Medium (depends on pricing unit) |
| The floor, not the rate, collects revenue at high ε | This model's result | High (model), Medium (empirical ε) |
| Benchmark take rates (Stripe 2.9%, cards ~1.5%, Lightning ~0.03%) | Public pricing | High (well known); **not re-verified online this session** (search tools rate-limited) |

**Known gaps.** (1) The rail cost table is uncalibrated. (2) The elasticity of
agent-work volume to fees is unmeasured — the single most valuable number to obtain;
a pilot with two fee levels would estimate it. (3) Benchmark figures are from
established public knowledge and were **not** re-fetched online because the search
and browser-rendering tools were rate-limited/unavailable during this session; they
should be re-verified before external publication.

---

## References

- `src/fee_calculator.ts` — M1/M2/M3 (ADR-004/005)
- `src/bos_yield_splitter.ts` — 80/10/10 and 50/30/20
- `src/monitoring_watcher.ts` — 40/30/20/10 treasury allocation
- `docs/adr/ADR_005_COMPETITIVE_RATES_WITH_COST_RECOVERY.md` — the rate
- `docs/research/FUNDING_AND_ECONOMICS.md` — the model
- `analysis/fee_model_economics.py` — the model behind these charts
- Rochet & Tirole (2003), *Platform Competition in Two-Sided Markets*; Armstrong
  (2006); Parker, Van Alstyne & Choudary, *Platform Revolution* (2016)
- Laffer / transaction-tax elasticity literature (Tobin tax, stamp duty)
- Metcalfe (1983); Briscoe, Odlyzko & Tilly (2006) critique
- Quantity theory of money (Fisher); seigniorage
