# ADR-007: Two-Product Rate Model — Rail Settlement vs Matched Job

> **Status:** **Accepted** | **Date:** 2026-11-14 | **Version:** 1.0
> **Deciders:** Conxian Core Maintainers — **owner sign-off 2026-11-14**
> **Amends:** ADR-001 §1.1 / §2 and scopes ADR-005 (the competitive rail rates) to the
> **rail** product only.
> **Authoritative for:** the two product definitions, the routing rule, the fee **level**
> per product, and the single split rule. Supersedes the "10% platform + 10% ecosystem"
> proposal in the earlier draft of this ADR (never accepted).
> **Companion analysis:** `docs/research/FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md`,
> `docs/research/FEE_MODEL_GROWTH_AND_ALIGNMENT.md`.

---

## 1. Context & Problem Statement

The market's take rate is documented **three different ways** across authoritative
documents — a **20× spread** — and two code paths implement two of them:

| Source | Take | Basis |
| :--- | ---: | :--- |
| ADR-005 (2026-10-10) | **0.50% → 0.10%** + cost floor | percentage of settlement |
| ADR-001 §2 (2026-08-03) | **2.0%** (+0.5% Managed) | percentage of settlement |
| ADR-001 §1.1 (80/10/10 of **gross**) | **10%** to platform (+10% ecosystem) | share of gross |

- `src/job_card_escrow.ts` `evaluateAndRelease` applies **80/10/10 of gross**.
- `src/fee_calculator.ts` `calculateDynamicFee` computes **0.50% of gross**.

The survival analysis shows this is not cosmetic. At **0.50%**, covering even the lean
**USD 24,000/yr** funding ask needs **≈ $4.8M/yr** of settled volume; at a plausible
**$1M/yr** the market earns **$5,000**. The market does the **marketplace** job (job
matching, escrow, attestation, SLA enforcement, dispute resolution) but prices itself
like a **settlement rail**.

The resolution: **0.50% and 10% are not competing prices for one product — they are the
correct prices for two different products.**

## 2. Decision

Adopt a **two-product rate model**, with **one split rule**. A settlement is priced by
**which product it is**, decided by a single explicit **routing rule**.

### 2.0 The one split rule

**Every fee is split 50/30/20 (operations / founders / ecosystem) — applied to the
platform's take, whatever it is.**

- Product A (rail): 50/30/20 on the fee **F**.
- Product B (matched job): 50/30/20 on the platform's **10%** take.

There is exactly one split rule. The two products differ only in the **take**.

### 2.1 Product A — Rail settlement

*Definition:* a raw, pass-through settlement with no matching, no escrow, no SLA and no
dispute — an **x402 / MCP-402 API call**, an M2M data packet, or a direct rail transfer.
The value delivered is **transport and routing**.

- **Rate:** the ADR-005 dynamic model — `max(amount × decayed_bps, rail_floor) × load`,
  `decayed_bps ∈ {50, 25, 15, 10}`, cost floor = `rail_cost × 1.25`.
- **Split:** 50/30/20 on the fee **F**.
- **Purpose:** the **land** product. Deliberately cheap; it wins raw volume and brings
  developers in.

### 2.2 Product B — Matched job

*Definition:* a settlement that delivers the **marketplace** service — a matched job with
a **job card**, **escrow**, **trust-tier attestation**, **SLA enforcement** and **dispute
resolution**. This is what `job_card_escrow.ts` models.

- **Rate:** **10% of gross to the platform** (builder keeps **90%**).
  > **Signed decision.** This supersedes the earlier draft's "10% platform + 10%
  > ecosystem" (a 20% take). The builder retains **90%**, and the ecosystem is funded
  > from the platform's share via the 50/30/20 split — **not** as a second deduction on
  > the builder. Rationale: Conxian is a *labour marketplace* (Upwork takes 10%); with
  > no liquidity yet, volume is elastic and the take must be set for adoption first.
- **Split:** 50/30/20 on the **platform's 10%**.
- **Purpose:** the **expand** product. Priced for the value delivered; makes the market
  self-funding (~$240k/yr volume covers the lean ask).

### 2.3 The routing rule

| Settlement carries… | Product | Path | Take |
| :--- | :--- | :--- | ---: |
| a job card + escrow + attestation + SLA | **B — Matched job** | `job_card_escrow.ts` | 10% |
| none of the above (raw call / pass-through) | **A — Rail** | `fee_calculator.ts` | ADR-005 dynamic |

This is the **existing** code split made **explicit and intentional**. **Fail-closed:** a
settlement that cannot be classified is routed to the **higher** (matched-job) rate, never
the cheaper rail rate.

## 3. Basis — Option A (adopted)

For **both** products the split is computed on the **fee / take**, not on gross:

- The builder's share is `gross − take`.
- **80/10/10 is retired.** The economy's headline is now **90/10** for a matched job
  (builder 90%, platform 10%), with the ecosystem funded from the platform's 50/30/20.
- Option B (50/30/20 on a 10%-of-net slice) is **rejected** — a 19.9× larger take
  (`FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` §D-1). Issue **#358**.

## 4. Design — worked examples (verified with exact integer arithmetic)

**Product A — a 1,000,000-sat x402 settlement (rail, 50 bps):**

```
fee F = 1,000,000 × 50/10,000            = 5,000 sat
builder receives  1,000,000 − 5,000      = 995,000 sat
ops       = 50% × F                      = 2,500 sat
founders  = 30% × F                      = 1,500 sat
ecosystem = 20% × F                      = 1,000 sat
```

**Product B — a 1,000,000-sat matched job (90/10):**

```
platform take = 10% × 1,000,000          = 100,000 sat
builder receives  1,000,000 − 100,000    = 900,000 sat
ops       = 50% × 100,000                = 50,000 sat
founders  = 30% × 100,000                = 30,000 sat
ecosystem = 20% × 100,000                = 20,000 sat
```

The platform's share is **5,000 sat** (rail) vs **100,000 sat** (matched job) — a **20×**
difference, **correct by construction**, because the products differ 20× in value.

## 5. Owner Decisions (resolved 2026-11-14)

1. **D-5 — the marketplace rate:** **10% total** (builder 90%). ✅
2. **Product boundary / routing rule:** job card ⇒ matched job; otherwise rail;
   fail-closed to the higher rate. ✅
3. **Basis:** Option A, with the single 50/30/20 split rule. ✅
4. **D-6 — the surface** (does the gateway subscription ladder carry steady revenue
   alongside the market fee?): still open — issue **#1343**.

## 6. Consequences

- **Positive**
  - The 20× "conflict" is resolved: the two documented rates are the two products.
  - **One split rule** (50/30/20) applied to the platform's take — no competing bases.
  - The market is **self-funding** on matched jobs (~$240k/yr volume) while staying
    **cheap and competitive** on raw settlement.
  - The routing rule is already two code paths — no new mechanism.
  - The **90/10** take is defensible (Upwork 10%) and supports early adoption.
- **Negative**
  - A matched job costs materially more than a raw settlement of the same value
    (10% vs 0.50%). This must be **surfaced to clients** before they commit.
  - Requires a **product-boundary classifier** enforced in code (a settlement must not be
    mis-routed to the cheap rail path).
  - `job_card_escrow.ts` must apply and **route all three legs** (fixing the dropped
    treasury/ecosystem legs — issue **#357**).
- **Neutral**
  - The cost-recovery floor (ADR-004/005) still applies to the rail product.

## 7. Implementation Scope

- `src/job_card_escrow.ts`: apply the 10% matched-job take and route **all three legs**
  (builder, treasury, ecosystem) via 50/30/20 on the take — closes the P0-7 drop (#357).
- `src/fee_calculator.ts`: unchanged — it remains the **rail** path.
- A shared **routing helper**: classify matched-job vs rail and select the rate.
  Fail-closed to the higher rate.
- `docs/adr/ADR_001_FEE_MODEL.md` and `ADR_005…`: status banners point here.
- `docs/research/FUNDING_AND_ECONOMICS.md`: reconcile the 5-stream table with the
  two-product model (#366) and the real cost base (#369).

## 8. Status of prior decisions

| Decision | Status after this ADR |
| :--- | :--- |
| ADR-001 §1.1 (80/10/10) | **Retired** — replaced by **90/10** + 50/30/20 on the take |
| ADR-001 §2 (2.0% tier table) | **Superseded** by the two-product rates |
| ADR-001 §1.2 (50/30/20) | **Retained** — now the single split rule for both products |
| ADR-005 (0.50% → 0.10% + floor) | **Scoped** to the rail product; unchanged within scope |
| ADR-006 (fee destination) | **Unchanged** — the destination is shared by both products |
| Option A (basis) | **Adopted** (#358) |

---

## References

- `docs/research/FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md` — the survival math
- `docs/research/FEE_MODEL_GROWTH_AND_ALIGNMENT.md` — the growth plan
- `docs/research/FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` — D-1 and the model
- `docs/adr/ADR_001_FEE_MODEL.md`, `ADR_004…`, `ADR_005…`, `ADR_006…`
- Issues: **#358** (basis), **#368** (level, D-5 — resolved here), **#369** (cost base),
  **#370** (growth)
