# Research source — CRYPTO fundraising (crypto-fundraising.info)

> **Type:** External research source (value-layer market intelligence)
> **Captured:** 2026-11-14 (all facts read from the site's own pages the same day)
> **Repo:** `Conxian/conxian_market` | **Status:** Reference
> **Canonical funding copy:** `Conxian/.github-private` → `docs/funding/CRYPTO_FUNDRAISING_SOURCE_2026_11_14.md`

**Not a funder and not an application route.** This is a deal-flow dataset we mine for
comparables, investor targeting and M&A context. It changes no owner-only decision
(recipient, amounts, payout).

---

## 1. What the source is

`https://crypto-fundraising.info/` — a WordPress-based, **commercial** blockchain
private-fundraising database. Its own description: *"tracks every crypto fundraising round
from pre-seed to Series C… profiles of the investment institutions and early-stage
startups."*

## 2. Dataset scale (their published figures, `/api`)

| Metric | Figure |
|---|---|
| Crypto projects | 4,000+ |
| Funding rounds | 6,500+ |
| Investors | 7,000+ (live `/investors` header: **8,674**) |
| Fund profile pages | 1,000 in `funds-sitemap.xml` |

Per-round fields: date, investors, round type, **raised amount**, **round valuation**,
categories, token, website, Twitter.

## 3. Access model

- **Free tier**: account-gated top-N (home shows rounds 01–05).
- **Paid API** (`/api`): single-project + all-rounds + **custom enterprise endpoints**;
  contact via Google Form / Twitter (`@Crypto_Dealflow`).
- **Trial**: "Promo Subscription" only *after* contract signing — no self-serve key.
- **Distribution**: website + Telegram bot + AI agent + Twitter.

## 4. Why it matters to the value layer

1. **Competitive positioning.** Fast answers to *"who is funding Bitcoin wallets,
   Lightning/L2, custody, and AI-agent-commerce projects, and at what round
   size/valuation?"* — input to [`FUNDING_AND_ECONOMICS.md`](./FUNDING_AND_ECONOMICS.md)
   and the fee-share / revenue work.
2. **Investor targeting (equity/VC lane).** Bitcoin-native funds appear directly (e.g.
   **UTXO Management** on a recent round). This is **separate** from the non-dilutive
   grant routes.
3. **M&A comparables.** Valuation/round history feeds the M&A evidence-engine work.
4. **Market signal.** Its "AI Agent" and machine-to-machine commerce categories confirm
   the market Conxian's x402 / agent-commerce thesis targets is being actively financed.

## 5. Honest limitations

- **Commercial, secondary source** — full dataset requires a paid contract; no free bulk
  export. Respect the site's terms; use the licensed API for productised use, not scraping.
- **Primary-source rule (SOP-06)** — any figure read here is a *lead*, not evidence; verify
  against the project's own announcement before it enters a doc.

## 6. Capture provenance

| Field | Value |
|---|---|
| URL | `https://crypto-fundraising.info/` |
| Pages read | `/`, `/investors`, `/api`, `robots.txt`, sitemaps |
| Date | 2026-11-14 |
| Method | HTTP GET (public pages), read-only; no account, no API contract |
| Platform | WordPress + Yoast SEO; Twitter `@Crypto_Dealflow` |

_This document was prepared by an AI agent (OpenHands) on behalf of the repository owner._
