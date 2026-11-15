# Feasibility & Survival — "Are we too cheap to survive?"

> **Status:** Analysis | **Date:** 2026-11-14 | **Trigger:** owner challenge — *"is this
> feasible at these returns; ain't we being too cheap to not even survive, see our
> funding requests."*
> **Companion:** `FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` (the model),
> `FEE_MODEL_FULL_SYSTEM_SPREAD.md` (the layers), `analysis/WORKING_NOTES.md` (the log).
> **Reproduce:** `python3 analysis/fee_model_survival.py` → `analysis/charts_survival/*.png`.

**Short answer: yes, at 0.50% the market fee alone is too cheap to survive — but the
market fee is not the only revenue surface, and the correct fix is a decision about
*which* surface books revenue and *what level* the market fee carries, not a blind
rate rise.** Option A (the split basis) is confirmed; it does not, by itself, fix the
level.

---

## 1. The real numbers (found, not assumed)

I had been reasoning about the fee model without the funding context. Here it is,
verified from the org's own documents:

| Item | Value | Source |
|---|---|---|
| **Funding ask** | **USD 24,000 / 12 months** (~$2,000/mo), 0.5 FTE | `.github-private/docs/funding/{HRF_BDF,OPENSATS,SPIRAL}_APPLICATION.md` |
| Ask composition | $15k engineering + $3k TEE hardware + $5k security review + $1k docs | HRF BDF application |
| **Infrastructure burn** | **≈ $0/mo** (Render free ×5; Cloudflare/Supabase/Neon free) | `FINANCIAL_REALITY_CHECK_2026_11_14.md` |
| Only real bleed | GitHub ~$105/mo accruing, now stopped | same |
| **Recognised revenue** | **$0** — "no settled transaction" | `unit-economics.json`, `ECONOMICS_AND_ASSET_REVIEW` |
| Unit economics | mostly `null`; verdict **`INSUFFICIENT DATA`** | `scripts/economics_break_even.py` |

### 1.1 A 10× contradiction in the org's own numbers

`FUNDING_AND_ECONOMICS.md` §4.1 declares a cost base of **$20,000/mo ($240,000/yr)**.
The actual funding ask is **$24,000/yr**. That is a **10× discrepancy**. The fee model
was reasoned from the $240k figure; the survival question must be reasoned from the
$24k figure. Both are shown below.

---

## 2. The take rate is documented three different ways

This is the heart of the "too cheap" problem. The platform's take appears as **0.50%,
2.0%, and 10%** in different authoritative documents:

| Source | Take | Character |
|---|---|---|
| **ADR-005** (2026-10-10, newest, "calibrated") | **0.50% → 0.10%** + cost floor | rail-grade |
| **ADR-001 §2** (2026-08-03, "Accepted", authoritative) | **2.0%** (+0.5% Managed) | processor-grade |
| **ADR-001 §1.1/§1.2** (80/10/10 of **gross**) | **10.0%** | marketplace-grade |
| **FUNDING §2.3** (50/30/20 of the 10% treasury) | 10% (Option B) | marketplace-grade |

Two **code paths** implement two of them, unreconciled:

- `src/job_card_escrow.ts` `evaluateAndRelease` applies **80/10/10 of gross** → platform **10%**.
- `src/fee_calculator.ts` `calculateDynamicFee` computes **0.50% of gross**.

So the system simultaneously says the platform takes 0.50%, 2%, and 10%. **A 20× spread.**

---

## 3. The survival math

![Break-even by rate](charts_survival/01_breakeven_by_rate.png)

**Annual settled volume needed to cover the $24k/yr ask:**

| Take rate | Volume to cover $24k/yr | Monthly equivalent |
|---|---:|---:|
| **0.50%** (ADR-005 launch) | **$4,800,000** | **$400,000/mo** |
| **2.0%** (ADR-001) | $1,200,000 | $100,000/mo |
| **10%** (80/10/10 of gross) | $240,000 | $20,000/mo |
| 15% (marketplace) | $160,000 | $13,300/mo |
| 25% (Uber-like) | $96,000 | $8,000/mo |

![Revenue vs volume](charts_survival/02_revenue_vs_volume.png)

At a plausible **year-1 target of $1M/yr settled volume**:

![Revenue at $1M](charts_survival/05_revenue_at_1m.png)

| Take rate | Revenue at $1M/yr | Covers the $24k ask? |
|---|---:|---|
| 0.50% | $5,000 | ❌ (21% of it) |
| 2.0% | $20,000 | ❌ (83%) |
| 10% | $100,000 | ✅ |
| 15% | $150,000 | ✅ |

**Conclusion: at 0.50%, a marketplace doing $1M/yr in volume earns $5,000 — it cannot
cover even the lean $24k ask.** At 2% it almost does. At a marketplace-grade 10%+ it
comfortably does.

![Runway](charts_survival/03_runway.png)

---

## 4. Why this is happening: pricing like a rail, operating like a marketplace

![Take benchmark](charts_survival/04_take_benchmark.png)

| Conxian provides | Comparable | Their take |
|---|---|---|
| Raw settlement routing | Lightning routing ~0.03%; Uniswap 0.05% | ~0.03–0.05% |
| Payment processing | Stripe 2.9%; card interchange ~1.5% | ~1.5–2.9% |
| **Matched jobs + escrow + attestation + SLA + dispute** | **Upwork 10%; Airbnb ~15%; Uber ~25%; app stores 30%** | **10–30%** |

Conxian's market does the **marketplace** job — job cards, escrow, trust tiers,
attestation, SLA penalty settlement, dispute resolution. Its cost structure is a
marketplace's, but ADR-005 prices it as a **rail** (0.50%). That is the "too cheap"
diagnosis, and the owner's instinct is correct.

---

## 5. The resolution — three separate decisions, not one

The confusion is that three different questions are being answered by one number.

### D-A. Basis (the split) → **Option A** (confirmed)
Apply 50/30/20 to the **fee F**; treat 80/10/10 as an **aggregate** statement, not a
per-settlement deduction. *(Re-verified: A vs B differ by 19.9×; B implies a hidden
~10%-of-net take. Option A stands.)*

### D-B. Level (the rate) → **must be raised from 0.50%, or the market fee must be
explicitly designated a loss-leader.**
- If the market fee is expected to fund the org, **0.50% is not viable** — it needs
  $4.8M/yr volume. The defensible marketplace level is **~10%** (matched jobs), with
  the 0.50% band reserved for **raw settlement** (x402 API calls, pass-through rails).
- These are **two products**: a *matched job* (marketplace service → 10%) and a *raw
  settlement* (rail service → 0.50%). Pricing them identically is the error.

### D-C. Surface (who books the revenue) → **the gateway subscription is the designated
surface (ADR-009), and the four surfaces are disjoint (#1343).**
- Gateway ladder: $200/mo base + usage; 128k-sat plans; x402 1000 sat/call.
- If the gateway subscription is the survival mechanism, the market fee can stay low
  as a *cost-recovery floor* — but that must be a **stated decision**, not an accident.

---

## 6. Recommendation (updated, and honest about the trade-off)

**The 0.50% market fee alone cannot fund the org. Choose one of two coherent postures,
and state it:**

**Posture 1 — "Rail" (keep 0.50%).** Then the market fee is a *cost-recovery floor only*
and the org is funded by the **gateway subscription ladder + grants**. This is viable
**only if** the gateway billing surface actually collects (it does not yet — $0
recognised) and the disjoint-surfaces gap (#1343) is closed. Survival then depends on
**subscriptions, not settlement volume**.

**Posture 2 — "Marketplace" (price the service).** Keep 0.50% for raw settlement, and
introduce an explicit **marketplace fee (~10%) on matched jobs** — the escrow +
attestation + SLA + dispute product. This is where the 80/10/10-of-gross figure actually
belongs, and it makes the org self-funding at ~$240k/yr volume (~$20k/mo), which is
reachable.

**Recommended: Posture 2, staged.** Keep the low rail fee for competitiveness (it wins
raw-settlement volume), and add the marketplace fee where the value is delivered. This
reconciles ADR-005 (rail) and ADR-001 §1.1 (marketplace) — they are not in conflict;
they price **different products**. It also makes the break-even (~$240k/yr) credible.

**Do not** simply raise the single 0.50% rate to 10% across all settlements — that
would over-price raw x402/API settlement and invite disintermediation (§3b of the
juxtaposition doc).

### What this means for the current work
- **Option A** (the split basis) — unchanged, correct.
- **New decision required (call it D-5):** is the market a *rail* (Posture 1) or a
  *marketplace* (Posture 2)? This is a **product/governance** decision and it gates the
  fee level, exactly as D-1 gated the basis.
- The `job_card_escrow` 80/10/10-of-gross path is, read charitably, the **marketplace**
  fee — so the "bug" (dropped treasury/ecosystem legs) and the "conflict" (0.50% vs 10%)
  are the same unresolved question: **is a job card a marketplace match or a rail
  settlement?**

---

## 7. Evidence and confidence

| Claim | Basis | Confidence |
|---|---|---|
| The real ask is $24k/yr, infra ≈$0 | HRF/Spiral/OpenSats drafts; FINANCIAL_REALITY_CHECK | High |
| FUNDING §4.1 says $240k/yr (10× the ask) | FUNDING_AND_ECONOMICS.md §4.1 | High |
| The take rate is documented as 0.50%, 2%, and 10% | ADR-005, ADR-001 §2, ADR-001 §1.1 | High |
| Two code paths implement 10% and 0.50% | job_card_escrow.ts, fee_calculator.ts | High |
| 0.50% cannot cover $24k below ~$4.8M/yr volume | This model (arithmetic) | High |
| Marketplace-grade take is 10–30% | Public benchmarks (Upwork/Airbnb/Uber/app stores) | High (well known); not re-fetched online this session |
| $1M/yr volume is a plausible year-1 target | **Assumption** | Low — unverified |

**Gaps.** (1) The year-1 volume target is assumed, not forecast — the single most
valuable input to obtain. (2) `unit-economics.json` has `willingness_to_pay` and
`price_elasticity` as `null`; without them the optimal level cannot be pinned, only
bounded. (3) Whether the gateway subscription ladder actually converts is unknown
($0 recognised).

---

## 8. The one-line answer

**Yes — at 0.50% the market fee is too cheap to survive; the org prices a marketplace
service like a settlement rail. Option A (the split basis) is correct and confirmed.
The missing decision is the *level*: either keep 0.50% as a cost-recovery floor and fund
the org from the gateway subscription (Posture 1), or add a marketplace fee on matched
jobs (Posture 2, recommended). Price the product you actually sell.**
