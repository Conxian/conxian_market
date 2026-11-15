# Growth & Alignment — from $0 to self-sustaining

> **Status:** Analysis | **Date:** 2026-11-14
> **Trigger:** owner — *"we won't stay [a] start[up] forever, dude; make sure you see what
> others did and grew, so you grow the company."*
> **Companion:** `FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md` (the survival math),
> `FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` (the model), `analysis/WORKING_NOTES.md` (log).
> **Reproduce:** `python3 analysis/fee_model_growth.py` → `analysis/charts_growth/*.png`.

This document answers the growth question and **aligns the three decisions** the fee
work has surfaced (basis, level, surface) into one coherent plan.

---

## 1. What actually worked for the companies we resemble

| Company | How it grew | Take rate | What we learn |
|---|---|---|---|
| **Shopify** | Make merchants successful; **subscription** revenue, not a GMV cut | **~0% on GMV** | You can run **$292B GMV at ~0% take** if **subscriptions** carry revenue |
| **Stripe** | **Developer-first**: a 7-line integration, obsessive docs | ~2.9% + 30¢ | **Distribution beats pricing.** Win developers, not deals |
| **Uber** | **Subsidise the scarce side** (drivers) until liquidity | ~25% | Spend to reach **liquidity**, then take; never before |
| **Airbnb** | **Trust** (reviews, insurance, guarantee) unlocks strangers transacting | ~15% | The **trust layer is the product**, and it justifies the take |
| **Upwork** | Take rate **raised** to ~10%; churn + activist campaign | ~10% | **Rate hikes on a working marketplace cause churn.** Do not lead with price |
| **Uniswap** | **Free** protocol; value captured by the token/LPs | ~0.05–0.3% | A protocol can be **free to use** and still valuable |
| **Conxian today** | — | 0.50% (market) / subs (gateway) | **Sits between Shopify (subs) and Airbnb (trust marketplace)** |

![Playbooks](charts_growth/04_playbooks.png)

**The pattern that grew:** *win the scarce side cheaply (Stripe: developers; Uber:
drivers), build the trust layer that makes strangers transact (Airbnb), then monetise
with subscriptions and/or a marketplace take — and never lead with a rate hike (Upwork).*

---

## 2. The flywheel — and the lever that matters

Conxian is a **two-sided AI-labour marketplace**. The scarce side today is **builders
(supply of agents)**, exactly as drivers were scarce for Uber. Supply growth drives GMV:

![Flywheel](charts_growth/01_flywheel.png)

![Lever sensitivity](charts_growth/03_lever_sensitivity.png)

**Lever sensitivity (realistic 12-month deltas):**

| Lever | Revenue effect at month 24 |
|---|---:|
| **Recruit builders (+50% agents)** | **+50%** |
| **Retention (+20% jobs/agent)** | +20% |
| Move upmarket (+15% avg job) | +15% |
| Raise take 2%→3% | +50% (but churn risk — see Upwork) |

Recruiting builders and retention beat a rate hike, and they carry **no churn risk**.
**Grow supply; don't lead with price.**

---

## 3. Path to break-even

![Path to break-even](charts_growth/02_path_to_breakeven.png)

| Take rate | First month revenue covers the $24k/yr ask |
|---|---:|
| 0.50% (ADR-005 rail) | month ~10 (only at scale) |
| 2.0% (ADR-001) | month ~4 |
| 10% (marketplace) | month ~0 |

**The 0.50% rate reaches break-even far later — and only at high volume.** This is the
survival finding, restated as a growth finding.

---

## 4. Land-and-expand: two products, two curves

![Land and expand](charts_growth/05_land_and_expand.png)

The winning shape is **two products priced separately**, not one rate:

1. **Land:** raw settlement (x402 / API calls) at the **0.50%** rail rate. High volume,
   low margin, **gets developers in the door** (the Stripe motion). Cheap on purpose.
2. **Expand:** **matched jobs** (escrow + attestation + SLA + dispute) at a
   **marketplace take**. Lower volume, high margin — the Airbnb/Uber motion, where the
   trust layer justifies the take.

This is why the 0.50%-vs-10% "conflict" is not a conflict: **they price different
products.** ADR-005 priced the rail; ADR-001 §1.1 priced the marketplace.

---

## 5. Alignment — the three decisions, resolved

The fee work surfaced three separable decisions. They align as follows:

| # | Decision | Resolution | Status |
|---|---|---|---|
| **D-1** | **Basis** — split of what? | **Option A:** 50/30/20 on the fee F; 80/10/10 is an aggregate statement | ✅ confirmed (19.9× proof) |
| **D-5** | **Level** — what rate? | **Two products:** 0.50% rail (land) + marketplace take on matched jobs (expand). Do **not** raise the single rate to 10% across all settlement | ⬜ **owner decision** |
| **D-6** | **Surface** — who books it? | Gateway subscription (ADR-009) + market fee; close the **disjoint-surfaces gap #1343** | ⬜ tracked |

**These are the only three open decisions. Everything else in the fee model is now
verified.**

---

## 6. The growth plan (what to actually do)

**Phase 0 — stop the bleed, keep the lights on (now).**
Infra is ~$0; the GitHub lock is cleared; the ask is $24k/yr for a part-time maintainer.
This is **survivable today** and needs no fee change. *(Feasibility doc §1.)*

**Phase 1 — land developers (months 0–6).** The Stripe motion.
- Ship the **developer on-ramp**: x402/API settlement at 0.50%, a 7-line integration,
  real docs. Free tier (`starter`, 0 sats) stays free.
- Metric: **active agents** (the scarce side). Recruit builders with grants from the
  **20% ecosystem** leg — that leg is *for* this.

**Phase 2 — build the trust layer (months 3–12).** The Airbnb motion.
- Harden attestation, SLA enforcement, dispute resolution — the things that make
  strangers transact. (These are the P0s: enclave attestation, trust tiers.)
- Metric: **jobs per agent** (retention) and **matched-job share**.

**Phase 3 — expand to matched jobs (months 9–24).** The marketplace motion.
- Introduce the **marketplace fee on matched jobs** (escrow + attestation + SLA), where
  the trust layer is delivered. Keep the rail rate low.
- Metric: **GMV on matched jobs**; break-even at ~$240k/yr volume.

**Phase 4 — subscriptions at scale (months 18+).** The Shopify motion.
- The gateway ladder ($200/mo base + usage; enterprise) becomes the steady revenue, with
  the marketplace fee as the upside. This is the **self-sustaining** state.

---

## 7. What "growing the company" concretely means here

1. **Win the scarce side cheaply.** Recruit builders; the 20% ecosystem leg funds it.
2. **Build the trust layer.** It is the moat and it justifies the marketplace take.
3. **Price two products.** 0.50% rail to land; marketplace take to expand.
4. **Monetise with subscriptions + marketplace take, not a rate hike.** Upwork is the
   warning.
5. **Keep the cost base lean.** Infra is ~$0; stay capital-efficient; the flywheel, not
   the fee rate, is the growth engine.

---

## 8. Evidence and confidence

| Claim | Basis | Confidence |
|---|---|---|
| Shopify runs large GMV at ~0% take, funded by subs | Wikipedia/company facts | High |
| Upwork's fee changes drew protests/churn | Wikipedia | High |
| Stripe/Uber/Airbnb grew via dev-first/subsidy/trust | Public record | High |
| Supply is the scarce side for Conxian | Two-sided market theory + this model | Medium |
| Recruiting builders beats a rate hike | This model (lever sensitivity) | Medium (model); High (principle) |
| Month numbers (break-even timing) | This model on **assumed** K, r, job size | Low — assumptions, not data |

**Gaps.** The flywheel parameters (K=5,000 agents, 3 jobs/agent/mo, $120 avg job) are
**illustrative assumptions**, not measured. The one number that would make this real is
**actual early traction** (signups, jobs, GMV) — currently $0. Everything above is a
*shape*, not a forecast; treat the month numbers as directional only.

---

## 9. The one-line answer

**Grow the scarce side (builders), build the trust layer, and price two products — a
cheap 0.50% rail to land developers and a marketplace take on matched jobs to expand —
then monetise with subscriptions. Do not try to survive on 0.50% of everything, and do
not lead with a rate hike: that is the Upwork trap. Option A (the basis) is confirmed;
the remaining owner decisions are the level (D-5) and the surface (D-6).**
