# Conxian Gateway — Prepaid Credit Order Form (TEMPLATE)

> **Status:** **Template / non-binding.** Not an offer, price list, or agreement. Every
> value is a placeholder to be completed by an authorised representative. **Not legal,
> financial or tax advice.**
> **Date:** 2026-11-15
> **Purpose:** a lean, non-dilutive way for an anchor client to prepay 6–12 months of
> Gateway/Nexus usage in BTC (or sats), at a discount, in exchange for credits.
> **Companion:** `docs/research/NON_DILUTIVE_FINANCING_SATS_2026_11_15.md` §2.2.

---

## 1. Parties

| Field | Value |
|---|---|
| Provider | Conxian Labs (`«PROVIDER_ENTITY»`) |
| Customer | `«CUSTOMER_LEGAL_NAME»` |
| Customer billing contact | `«BILLING_EMAIL»` |
| Customer settlement principal | `«CUSTOMER_SETTLEMENT_ROLE»` (a `.conxian-access` role — no raw address in this form) |

## 2. Credit block

| Field | Value | Notes |
|---|---|---|
| Product | Gateway / Nexus (select) | `«PRODUCT»` |
| Plan tier | Base / Pro / Enterprise | see the documented ladder |
| Prepaid term | `«MONTHS»` months (6–12) | |
| List price | `«LIST_PRICE_SAT»` sats | list value of the term |
| Prepay discount | `«DISCOUNT_BPS»` bps (e.g. 2000 = 20%) | ≤ gross margin |
| **Prepaid amount due** | **`«NET_PRICE_SAT»` sats** | `list × (1 − discount)` |
| Settlement asset | BTC / sats / (x402 rail) | |
| Payment terms | on signature, or `«NET_DAYS»` | |
| Credit expiry | `«EXPIRY_MONTHS»` months from issue | unused credits expire per §5 |

> **Pricing basis (grounded):** the documented Gateway ladder is **$200/mo base + usage;
> 128k-sat plans; x402 1000 sat/call** (`FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md` §5). Use
> that ladder — not the retail per-call figures. At a ~$0/month cost base, a 20–30%
> discount is defensible; do not discount below gross margin.

## 3. What the customer receives

1. **Credits** equal to the prepaid term's usage allowance, drawn down per metered call.
2. **Priority** support / a named contact for the term.
3. **Price lock** for the term (no mid-term list-price increase).
4. A **usage statement** each period: credits consumed, remaining, and the rate applied.

## 4. Draw-down and metering

- Credits are consumed at the plan's metered rate (base + usage).
- The **credit ledger** is the source of truth; the customer may request a statement at any
  time.
- When credits are exhausted before term end, the customer either (a) purchases a new
  block, or (b) continues at list rate on 30-day terms.

## 5. Expiry, refund, and service level

| Term | Value |
|---|---|
| Unused credits at expiry | expire (or carry `«CARRY_MONTHS»`) |
| Refund on cancellation | pro-rata at the **undiscounted** list rate, less consumed credits |
| Service availability target | `«SLA»` (see the Gateway SLA) |
| Failure to deliver | refund of unused credits — the liability is capped at the prepaid amount |

## 6. Controls and compliance

- **No custody change:** payment settles to the **OPERATIONS** vault; the customer's
  settlement principal is a **role**, never a hardcoded address (ZSE).
- **Deferred revenue:** the prepaid amount is booked as **deferred revenue**, not debt,
  and is recognised as the credits are consumed.
- **Tax:** the customer is responsible for its own tax; Conxian invoices with the required
  detail for the customer's jurisdiction (South Africa: SARS-compliant tax invoice).
- **Counsel review** is a condition precedent before this form is used with a real
  counterparty.

## 7. Signature block (template)

| Party | Name / Role | Signature | Date |
|---|---|---|---|
| Conxian Labs | `«SIGNATORY_1»` | | |
| Conxian Labs | `«SIGNATORY_2»` (dual control) | | |
| Customer | `«CUSTOMER_SIGNATORY»` | | |

---

### Appendix A — worked example (illustrative only)

| Item | Value |
|---|---|
| Plan | Gateway Pro |
| Term | 12 months |
| List price | `1_200_000` sats (illustrative) |
| Discount | 20% |
| Prepaid | `960_000` sats |
| Effective monthly | `80_000` sats vs `100_000` list |

*(Illustrative arithmetic only; the real numbers come from the current ladder.)*

---

*This document was created by an AI agent (OpenHands) on behalf of the user. It is a
non-binding template; it offers nothing and obligates no one.*
