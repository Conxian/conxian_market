# Non-Dilutive Financing in Sats — Research and Assessment

> **Status:** Research — **not financial, legal or tax advice**; nothing here is deployed
> or agreed with any counterparty.
> **Date:** 2026-11-15
> **Question:** *How do we raise sats against future protocol/Gateway cash flow without
> touching locked/vested principal, diluting equity, or issuing a native token — while
> keeping the non-custodial, Bitcoin-native architecture?*
> **Companion:** `SAT_REVENUE_SHARE_TERM_SHEET_TEMPLATE.md` (template, no counterparty).
> **Implementation:** `src/revenue_share_assignment.ts` (capped assignment primitive).

---

> **Companion (canonical, private):** the funding-route record and the prepaid-credit
> program already exist in **`.github-private`**:
> `docs/funding/ROUTE_ALIGNMENT_2026_11_11.md`,
> `docs/FUNDING_STRATEGY_2026_11_07.md`,
> `docs/funding/FUNDER_CRITERIA_AND_BEST_PRACTICES_2026_11_13.md`,
> `docs/commercial/FOUNDING_TENANT_OFFER.md` + `PRICING_BENCHMARK.md`.
> **This document does not restate them.** It adds only the *financing* mechanisms
> (RBF/fee-share, DLC, Lightning liquidity leases) that were not already covered.

---

## 0. Verdict in one paragraph

The four mechanisms are real and Bitcoin-native, and they fit a zero-custody shop because
**none of them pledges locked principal** — they all sell or borrow against **future
flow**. But the sizing in the pitch needs correcting against Conxian's own numbers before
it goes anywhere: at the documented 0.50% rail rate, $1M/month of volume yields about
**$5,000/month**, not $21.1K (that figure belongs to the **retired 2%** model). So a
$25K–$100K raise is best framed against a **low, near-zero cost base** (real infra burn is
~$0/month; the filed grant ask is **$24K/yr**), which is exactly why **grants + prepaid
credits + a small capped fee-share** are the right instruments — not a large debt.

---

## 1. The constraint we are solving (verified)

| Fact | Value | Source |
|---|---|---|
| Real infrastructure burn | **≈ $0/month** (Render free ×5; Cloudflare/Supabase/Neon free) | `FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md` §2 |
| Only real bleed | GitHub ~$105/mo (now stopped) | same |
| Filed funding ask | **USD 24,000 / 12 months** (HRF/Spiral/OpenSats) | `FUNDING_AND_ECONOMICS.md` §4.1 (issue #369) |
| Protocol fee @ $1M/mo volume | **≈ $5,000/mo** (0.50% ADR-005 dynamic) | `FUNDING_AND_ECONOMICS.md` §3 |
| Retired model @ $1M/mo | $21.1K/mo — the **2%** static fee, **retired** | same, struck through |
| Matched-job take | **10%** (builder keeps 90%) | ADR-007 |
| Split of the take | **50% Ops / 30% Founders / 20% Ecosystem** | ADR-007 |
| Founder lock | **4-year vesting, 1-year cliff** | `src/bos_yield_splitter.ts` |
| Treasury timelock | **48 h** for transfers > 100M sats (≈$50K), ≥3-of-5 sigs | `src/bos_yield_splitter.ts` |

**Two numbers in the pitch are wrong for our system and must not be repeated:**

1. **"$21.1K/mo at $1M volume"** — that is the **retired 2%** model. Under ADR-005/007 the
   base is **≈$5K/mo** at $1M/mo.
2. **"$0.01/relay, $0.10/settlement"** — the repo's documented gateway ladder is
   **"$200/mo base + usage; 128k-sat plans; x402 1000 sat/call"**
   (`FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md` §5). Those are **different products**; use the
   documented ladder, not the retail-per-call numbers.

The honest implication: **the cost base is tiny, so the raise is small.** $25K–$100K is
plausible against a ~$0–2K/month burn — it is a runway top-up, not a growth round.

---

## 2. The four mechanisms, assessed

### 2.1 Revenue-based financing / future fee-split assignment — **recommended, small**

Assign a **capped slice of future OPERATIONS-bucket take** to a lender until a repayment
cap; then it reverts 100%.

- **Why it fits:** touches only **future flow**, never locked/vested principal (founder
  vesting and the DAO ecosystem reserve stay ring-fenced). No equity, no token.
- **Implemented:** `src/revenue_share_assignment.ts` — `buildRevenueShareAssignment()`
  takes the `operationsSat` from a vault sweep and returns capped lender legs; only the
  `OPERATIONS` bucket is assignable; it **fails closed** on a malformed assignment or an
  unconfigured lender principal; off by default.
- **Math (grounded):** at $1M/mo, Ops = 50% × $5,000 = **$2,500/mo**. A 25% assignment is
  **$625/mo**; a 1.3× cap on a $25K advance ($32.5K) is repaid in ≈ **52 months**. That is
  slow. **Sizing rule: the advance must be small relative to flow, or the cap long.**
- **Risk:** if volume never arrives, the lender is not repaid (that is the point — RBF
  shifts volume risk to the lender, which is why the cap is >1×). Structuring a note that
  pays out of revenue can look like a **security** in some jurisdictions — see §4.

### 2.2 Prepaid enterprise credits / anchor-client forward contracts — **already built; do not rebuild**

> **Already exists.** The prepaid-credit program is designed and priced in
> **`.github-private/docs/commercial/FOUNDING_TENANT_OFFER.md`** (Indie $29/mo, Business
> $99/mo; founding bonus; annual/bulk terms; 1.5× credit ceiling; 12-month expiry;
> ASC 606/IFRS 15 deferred revenue) with benchmarks in `PRICING_BENCHMARK.md`, and the
> ledger is **already implemented as `credit_ledger.rs` in the gateway**. **No new
> primitive or order form is needed here** — use the existing program.

- **Why it fits:** non-dilutive working capital, validates demand, lands as **deferred
  revenue**, not debt.
- **Risk:** you owe the service; discount depth is already bounded by the 1.5× ceiling.

### 2.3 Bitcoin-native grants — **already assessed; see the canonical record**

> **Already covered — do not restate.** The grant map is canonical in **`.github-private`**:
> `docs/funding/ROUTE_ALIGNMENT_2026_11_11.md`, `docs/FUNDING_STRATEGY_2026_11_07.md`, and
> `docs/funding/FUNDER_CRITERIA_AND_BEST_PRACTICES_2026_11_13.md`. Current state:
> **HRF + Spiral SUBMITTED (2026-11-14)**; **OpenSats SHELVED** (needs ≥2 referees);
> **Btrust DROPPED** (contributor-shaped); **NLnet DROPPED** (not eligible);
> **Chaincode NOT a route**; **Brink skip**; **Qala defunct**; **AWS Activate applied**.
> Any further grant research belongs **there**, not in this repo.

### 2.4 DLC + Lightning liquidity leases — **only if the need is channel float**

- **Lightning Pool** (Lightning Labs) — "a marketplace for Lightning channels … connects
  users who need access to bitcoin liquidity to those with capital to deploy"
  (https://lightning.engineering/pool/). Lease **inbound/outbound** liquidity for a fee in
  sats; keep own capital free.
- **DLC** (Discreet Log Contracts) — "two or more parties agree to exchange money
  dependent on the outcome of a certain event as determined by an oracle"
  (https://bitcoinops.org/en/topics/discreet-log-contracts/). Could unlock tranches of sats
  as **verifiable on-chain volume milestones** are hit. Powerful but **complex** and
  oracle-dependent; a stretch goal, not a first instrument.
- **Amboss Magma** — a Lightning liquidity marketplace (https://amboss.tech/) — same
  category as Pool.

---

## 3. What to actually do (recommended sequence)

1. **Grants first** — **HRF + Spiral are already submitted** (2026-11-14); the $24K/yr ask
   covers the real burn. Cheapest capital. Track in `.github-private/docs/funding/`.
2. **Prepaid credits** — the program is **already built** (`FOUNDING_TENANT_OFFER.md` +
   `credit_ledger.rs`); just sell it to 1–3 design partners.
3. **Small capped fee-share** *only* if 1–2 do not cover it: keep the advance ≤ a few
   months of Ops flow and the cap ≥1.3×. **This is the one genuinely new primitive**
   (`src/revenue_share_assignment.ts`).
4. **Liquidity lease / DLC** only when there is a *specific* channel-float or milestone
   need — not as general runway.

---

## 4. Honest risks and constraints

- **Regulatory:** a "future fee-cut note" can be a **security** (investment of money in a
  common enterprise with expectation of profit from others' efforts) in many
  jurisdictions. South Africa adds **FSCA/CIPC** and **SARS** dimensions. **Get
  jurisdiction-specific counsel before pitching any instrument.** This document is
  research, not legal advice.
- **ZSE:** no keys, secrets, addresses, or counterparty-identifying financial strategy in
  Git. **Any term sheet or order form is commercial material and belongs in
  `.github-private` (private), not this public repo.** Principals are `.conxian-access`
  **roles**, never hardcoded addresses.
- **Custody:** all assignments settle **to the OPERATIONS bucket** and route via the
  existing vault sweep; they never encumber the vault itself, the founder vesting escrow,
  or the DAO reserve.
- **Accounting:** every automated payout must be logged in BOS as a **financing
  repayment** expense so SARS accounting stays clean (owner's own requirement).
- **Sizing reality:** at the documented fee rate, fee-share repayment is **slow**. Do not
  over-borrow against it.

---

## 5. Sources (fetched 2026-11-15)

Lightning Pool (Lightning Labs), Amboss Magma, Bitcoin Optech DLC topic (the only
externally-fetched sources; grants and prepaid pricing are the canonical private docs
cited above). Conxian-side figures from `FUNDING_AND_ECONOMICS.md`,
`FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md`, ADR-007, and `src/bos_yield_splitter.ts`.

---

*This document was created by an AI agent (OpenHands) on behalf of the user. It raises no
capital, commits to no counterparty, and moves no value.*
