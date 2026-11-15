# ADR-007: Two-Product Rate Model — Rail Settlement vs Matched Job

> **Status:** Proposed (owner sign-off — decision **D-5**)
> **Date:** 2026-11-14 | **Version:** 1.0
> **Amends:** ADR-001 §1.1 / §2 (the 80/10/10 and the tier rates) and scopes ADR-005
> (the competitive rail rates) to the **rail** product only.
> **Authoritative for:** the two product definitions, the routing rule, and the fee
> **level** per product. Does not change any shipped default until accepted.
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

- `src/job_card_escrow.ts` `evaluateAndRelease` applies **80/10/10 of gross** (platform ≈ 10%).
- `src/fee_calculator.ts` `calculateDynamicFee` computes **0.50% of gross**.

The survival analysis (`FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md`) shows this is not a
cosmetic inconsistency. At the **0.50%** rate, covering even the lean **USD 24,000/yr**
funding ask needs **≈ $4.8M/yr** of settled volume; at a plausible **$1M/yr** the market
earns **$5,000** — it cannot survive. The market does the **marketplace** job (job
matching, escrow, attestation, SLA enforcement, dispute resolution) but prices itself
like a **settlement rail**.

The insight that resolves the 20× spread: **0.50% and 10% are not competing prices for
one product — they are the correct prices for two different products.**

## 2. Decision

Adopt a **two-product rate model**. A settlement is priced by **which product it is**,
decided by a single, explicit **routing rule**.

### 2.1 Product A — Rail settlement

*Definition:* a raw, pass-through settlement with no matching, no escrow, no SLA and no
dispute — e.g. an **x402 / MCP-402 API call**, an M2M data packet, or a direct
rail transfer. The value delivered is **transport and routing**.

- **Rate:** the ADR-005 dynamic model — `max(amount × decayed_bps, rail_floor) × load`,
  `decayed_bps ∈ {50, 25, 15, 10}`, cost floor = `rail_cost × 1.25`.
- **Split:** 50/30/20 on the fee **F** (**Option A** — resolved in §3).
- **Purpose:** a **land** product. It is deliberately cheap; it wins raw volume and
  gets developers in the door.

### 2.2 Product B — Matched job

*Definition:* a settlement that delivers the **marketplace** service — a matched job with
a **job card**, **escrow**, **trust-tier attestation**, **SLA enforcement** and **dispute
resolution**. This is what `job_card_escrow.ts` already models.

- **Rate:** a **marketplace take**, recommended **10% of gross to the platform treasury
  + 10% of gross to the ecosystem** (builder keeps 80%) — i.e. the documented 80/10/10,
  read as a **per-settlement** split of a matched job. *(The exact number is the owner's
  to set; see §5. This ADR fixes the **structure**, not the number.)*
- **Split:** the 80/10/10 itself (builder 80% / platform 10% / ecosystem 10%).
- **Purpose:** an **expand** product. It is priced for the value delivered, and it is
  what makes the market self-funding (~$240k/yr volume covers the lean ask).

### 2.3 The routing rule (the decision that removes the conflict)

| Settlement carries… | Product | Path | Rate |
| :--- | :--- | :--- | :--- |
| a job card + escrow + attestation + SLA | **B — Matched job** | `job_card_escrow.ts` | marketplace take |
| none of the above (raw call / pass-through) | **A — Rail** | `fee_calculator.ts` | ADR-005 dynamic |

This is not a new mechanism: it is the **existing** code split, made **explicit and
intentional**. ADR-005 priced the rail; ADR-001 §1.1 priced the marketplace. Both were
right about their own product; the error was applying one rate to both.

## 3. Basis — Option A (resolved, unchanged)

For **both** products, the split is computed on the **fee**, not on gross:

- **Option A (adopted):** the platform's and ecosystem's shares are taken from the fee
  **F**; the builder's share is `gross − F`.
- The **80/10/10** in ADR-001 §1.1 is an **aggregate** statement of the economy
  (builders collectively keep ~80% of GMV), **not** a second deduction on top of a fee.

Option B (50/30/20 applied to a 10%-of-net slice) is **rejected**: it is a **19.9×**
larger platform take at 50 bps and would be a hidden ~10%-of-net tax
(`FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` §D-1). Issue **#358** tracks the ratification.

## 4. Design — worked examples

**Product A — a 1,000,000-sat x402 settlement (rail, 50 bps):**

```
fee F = 1,000,000 × 50/10,000            = 5,000 sat
builder receives  1,000,000 − 5,000      = 995,000 sat
ops       = 50% × F                      = 2,500 sat
founders  = 30% × F                      = 1,500 sat
ecosystem = 20% × F                      = 1,000 sat
```

**Product B — a 1,000,000-sat matched job (marketplace, 80/10/10 of gross):**

```
builder receives  80% × 1,000,000        = 800,000 sat
platform treasury 10% × 1,000,000        = 100,000 sat
ecosystem         10% × 1,000,000        = 100,000 sat
```

The platform's share is **5,000 sat** on the rail product and **100,000 sat** on the
matched job — a **20×** difference that is **correct**, because the products differ by
20× in value delivered.

## 5. Owner Decisions

1. **D-5 — the marketplace rate number.** Structure adopted (this ADR); the **level** is
   the owner's call. Recommendation: **10% platform + 10% ecosystem (builder 80%)**,
   benchmarked against Upwork 10%, Airbnb ~15%, Uber ~25%. Open on issue **#368**.
2. **Product boundary.** Confirm the routing rule in §2.3 (job card ⇒ matched job;
   otherwise rail). Open on **#368**.
3. **D-6 — the surface.** Whether the **gateway subscription ladder** (ADR-009) carries
   steady revenue alongside the market fee; the four surfaces are disjoint (**#1343**).
4. **Ratification of Option A** (the basis) — issue **#358**.

## 6. Consequences

- **Positive**
  - The 20× "conflict" is resolved: the two documented rates are the two products.
  - The market can be **self-funding** on matched jobs (~$240k/yr volume) while staying
    **cheap and competitive** on raw settlement (a land product).
  - The routing rule is already implemented as two code paths — no new mechanism.
  - Aligns pricing with the growth model: land cheap, expand where value is delivered.
- **Negative**
  - A **matched job costs materially more** than a raw settlement of the same value
    (20% vs 0.50%). This must be **surfaced to clients** before they commit, or it reads
    as a hidden fee.
  - Requires a **product-boundary classifier** to be enforced in code (a settlement must
    not be mis-routed to the cheap rail path to avoid the marketplace take).
  - `job_card_escrow.ts` must apply and **route all three legs** (fixing the dropped
    treasury/ecosystem legs — issue **#357**).
- **Neutral**
  - The cost-recovery floor (ADR-004/005) is unchanged and still applies to the rail
    product; the marketplace product carries its own (higher) floor implicitly.

## 7. Implementation Scope (on acceptance)

- `src/job_card_escrow.ts`: apply the marketplace take and route **all three legs**
  (builder, treasury, ecosystem) — closes the P0-7 drop (#357).
- `src/fee_calculator.ts`: unchanged — it remains the **rail** path.
- A shared **routing helper**: classify a settlement as matched-job vs rail, and select
  the product rate. Fail-closed: an unclassifiable settlement defaults to the **higher**
  (marketplace) rate, never the cheaper rail rate.
- `docs/adr/ADR_001_FEE_MODEL.md` and `ADR_005…`: status banners point here for the
  **level** and the **scope**.
- `docs/research/FUNDING_AND_ECONOMICS.md`: reconcile the 5-stream table with the
  two-product model (#366) and the real cost base (#369).

## 8. Status of prior decisions

| Decision | Status after this ADR |
| :--- | :--- |
| ADR-001 §1.1 (80/10/10) | **Reframed** — the marketplace product's per-settlement split |
| ADR-001 §2 (2.0% tier table) | **Superseded** by the two-product rates |
| ADR-001 §1.2 (50/30/20) | **Retained** for the rail product (Option A) |
| ADR-005 (0.50% → 0.10% + floor) | **Scoped** to the rail product; unchanged within scope |
| ADR-006 (fee destination) | **Unchanged** — the destination is shared by both products |
| Option A (basis) | **Adopted** (#358) |

---

## References

- `docs/research/FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md` — the survival math
- `docs/research/FEE_MODEL_GROWTH_AND_ALIGNMENT.md` — the growth plan
- `docs/research/FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` — D-1 and the model
- `docs/adr/ADR_001_FEE_MODEL.md`, `ADR_004…`, `ADR_005…`, `ADR_006…`
- Issues: **#358** (basis), **#368** (level, D-5), **#369** (cost base), **#370** (growth)
