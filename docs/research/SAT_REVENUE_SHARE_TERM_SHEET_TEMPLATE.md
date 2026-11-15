# Sats Revenue-Share Term Sheet — TEMPLATE (not an offer)

> **Status:** **Template / non-binding.** Not an offer, solicitation or agreement. No
> counterparty is named; every value is a placeholder. **Not legal, financial or tax
> advice** — have counsel review before use (see
> `NON_DILUTIVE_FINANCING_SATS_2026_11_15.md` §4).
> **Date:** 2026-11-15
> **Purpose:** a lean term sheet to pitch an early Bitcoin backer for a **capped,
> non-dilutive sats advance against future OPERATIONS-bucket take**.

---

## 1. Parties

| Party | Field |
|---|---|
| Issuer | **Conxian Labs** (or the contracting entity: `«ENTITY»`) |
| Lender / Backer | `«LENDER»` (principal via a `.conxian-access` role, not a raw address) |
| Settlement | On-chain / Lightning to `«LENDER_SETTLEMENT_ROLE»` |

## 2. The instrument — "Future Fee-Cut Note"

- **Type:** capped **revenue-share assignment** over future protocol take. **Not equity,
  not a token, not a loan with a fixed obligation** — repayment is contingent on realized
  revenue. *(Counsel to confirm characterisation in the relevant jurisdiction.)*
- **Ring-fence:** the assignment draws **only** from the **OPERATIONS** bucket (50% of the
  ADR-007 take). The **FOUNDERS** (vesting) and **ECOSYSTEM** (DAO) buckets are **not**
  assignable. Implemented as `ASSIGNABLE_BUCKET = "OPERATIONS"` in
  `src/revenue_share_assignment.ts`.

## 3. Economics

| Term | Placeholder | Notes |
|---|---|---|
| Advance | `«ADVANCE_SAT»` sats | upfront, delivered to the Ops vault |
| Assigned share | `«SHARE_BPS»` bps of the OPERATIONS bucket | e.g. 2500 = 25% |
| Repayment cap | `«CAP_MULTIPLE»` × advance (e.g. 1.3×–1.5×) | or `«CAP_SAT»` sats |
| Term limit | `«MONTHS»` months, or cap — whichever first | time-boxes the tax on margin |
| Cap behaviour | at cap, assignment → **0%**; **100% reverts to Conxian** | automatic, per settlement |
| Basis | realized OPERATIONS take (50% of the 10%/ADR-005 take) | never gross, never principal |

### Repayment illustration (grounded, illustrative only)

At `$1M/month` volume under ADR-005/007: take ≈ `$5,000/mo`; OPERATIONS = 50% ≈
`$2,500/mo`. A **25%** assignment ≈ **`$625/mo`**; a 1.3× cap on a **$25K** advance
(`$32,500`) repays in ≈ **52 months**. **Conclusion:** keep the advance small relative to
flow, or the cap long — do not over-borrow against the fee. (Do **not** use the retired
`$21.1K/mo` figure; that was the 2% model.)

## 4. Mechanics

1. Each settlement's OPERATIONS legs are computed by `buildProtocolFeeSettlement()`.
2. `applyRevenueShareAssignment()` routes `«SHARE_BPS»` of those legs to the lender, capped.
3. Every payout is logged in **BOS** as a **financing repayment** expense (SARS accounting).
4. The repayment ledger tracks `repaidToDateSat`; the primitive clamps the final payment to
   the remaining cap (`assignmentProgress()`).

## 5. Controls (non-negotiable)

- **Fail-closed:** an unconfigured lender role, a non-Ops bucket, or a malformed share
  routes **nothing** (`buildRevenueShareAssignment` blockers).
- **No encumbrance** of the vault, founder escrow, or DAO reserve.
- **No personal key dependency:** all parties are SAB multisig roles.
- **Pause:** a 2-of-3 pause-only emergency role can halt sweeps (never seizes funds).
- **Transparency:** quarterly statements of sats delivered vs cap.

## 6. Conditions precedent

- `«COUNSEL_REVIEW»` complete (securities/tax characterisation).
- Lender principal configured as a `.conxian-access` role.
- Settlement destination verified by the lender.
- `protocolFeeActive` and the vault **deployed** (#360/#363) — **the note cannot pay before
  fees are collected.**

## 7. Signature block (template)

| Party | Name / Role | Signature | Date |
|---|---|---|---|
| Conxian Labs | `«SIGNATORY_1»` | | |
| Conxian Labs | `«SIGNATORY_2»` (dual control) | | |
| Lender | `«LENDER_SIGNATORY»` | | |

---

*This document was created by an AI agent (OpenHands) on behalf of the user. It is a
non-binding template; it offers nothing and obligates no one.*
