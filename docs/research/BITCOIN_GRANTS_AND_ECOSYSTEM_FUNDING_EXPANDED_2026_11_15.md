# Bitcoin Grant & Ecosystem Funding — Expanded Research

> **Status:** Research — **not financial, legal or tax advice**; no application is made by
> this document.
> **Date:** 2026-11-15
> **Why:** the first-round grant set (OpenSats, HRF, Stacks Endowment, Fedimint/RGB) has
> been **submitted** (Zoho Mail, 2026-11-15). This expands the map to additional Bitcoin /
> Lightning / Bitcoin-L2 funders and to **ecosystem liquidity programs**, so the pipeline
> is deeper than four applications.
> **Companion:** `NON_DILUTIVE_FINANCING_SATS_2026_11_15.md` (mechanism assessment).

---

## 0. Summary

The grant universe for a **non-custodial, open-source, multi-rail Bitcoin middleware**
project splits into four buckets: **general FOSS funds**, **geographic/education funds**,
**L2/ecosystem funds**, and **in-kind liquidity/credits programs**. Conxian qualifies
strongly on the first (open-source, Bitcoin-native), **moderately** on the second (solo
maintainer, Global-Majority base in South Africa), and **case-by-case** on the third (only
where a funder's rail is one we actually route — Stacks/sBTC, Rootstock/RIF, Citrea).
Because the real burn is ~$0/month and the filed ask is $24K/yr, **a handful of small
grants fully funds the sprint**; the goal is breadth of pipeline, not size.

**One hard exclusion already established:** **NLnet is NOT eligible** (EU Horizon
60%-of-funds rule + the generative-AI policy that forbids AI-written proposals). Do not
re-file.

---

## 1. General FOSS / Bitcoin funds

| Program | What it funds | Fit | How to apply | Source |
|---|---|---|---|---|
| **OpenSats — General Fund** | "Bitcoin developers and the FOSS projects Bitcoin depends on"; has sent **~35.0B sats to 357 grantees in 40 countries**. Criteria: Good for Bitcoin; Free & Open-Source; Transparency & Education | **High** — our stack is FOSS and Bitcoin-native | https://opensats.org/apply | https://opensats.org/funds |
| **OpenSats — Red Team Fund** | "red teaming critical Bitcoin software, **including reimbursement of past LLM token costs**" | **High and unusual** — a direct route to recover AI/LLM spend for security work on our rails | via the Red Team Fund page | https://opensats.org/funds |
| **OpenSats — Nostr Fund** | relay operators, client devs, library maintainers, designers, protocol contributors | **Low** — only if a Nostr surface exists | same | same |
| **Spiral (Block)** | "open-source bitcoin **& AI**"; "given hundreds of grants … in over a dozen countries"; accepts independent devs/designers | **High** — explicitly **Bitcoin + AI**, which matches an agent-built stack | "Send a detailed proposal to **grants@spiral.xyz**" | https://spiral.xyz/grants |
| **Brink** | funding, education, mentoring for Bitcoin devs; runs a **grants program** | **Medium** — favours protocol/Core contributors; our tooling is adjacent | https://brink.dev/ | https://brink.dev/ |
| **Chaincode Labs** | Bitcoin research/dev residencies and grants | **Low–Medium** — heavily protocol-focused | https://chaincode.com/ | https://chaincode.com/ |
| **Btrust** | "Bitcoin open-source engineers in the **Global Majority**"; founded 2021 with **500 BTC from Jack Dorsey and Jay-Z**; starting in **Africa**, expanding to India and Latin America | **High** — a South-Africa-based, Global-Majority open-source Bitcoin project is squarely on-mission | https://www.btrust.tech/ (Apply For Funding) | https://www.btrust.tech/ |
| **Vinteum** | Brazil-based Bitcoin R&D: **Grants Program funds experienced contributors**; also a Fellowship + Dev Launchpad | **Medium** — LATAM-focused, but "high-impact Bitcoin projects" is open | https://vinteum.org/ | https://vinteum.org/ |
| **Qala** | Africa-focused Bitcoin/Lightning developer training + fellowship | **Medium** — pipeline/mentoring rather than core funding | https://qala.dev/ | https://qala.dev/ |

### 1.1 Notes that matter for us
- **OpenSats Red Team Fund reimburses past LLM token costs.** For an AI-agent-built stack
  this is a rare, directly-relevant line item — worth a dedicated application.
- **Spiral funds "bitcoin & AI"** — the only major funder whose stated scope explicitly
  includes both. Strong fit; the ask is a **detailed proposal by email**, not a portal.
- **Btrust** is the best **geographic** fit (Global Majority / Africa). Pair it with Qala
  for the education/mentoring angle.
- **Chaincode/Brink** skew to Bitcoin Core contributors; apply only if we open a
  protocol-level component (e.g. a reusable FROST/DLC library).

---

## 2. Bitcoin-L2 / ecosystem funds (only where we route the rail)

These funds pay to grow **their** ecosystem; we qualify only because Conxian is a
**multi-rail router** that already lists their rail. Each application should be framed as
"integrate and route *your* rail", not "fund our company".

| Program | What it funds | Our rail | Fit | Source |
|---|---|---|---|---|
| **Stacks Endowment Grants** | "Getting Started", "Builders", and community **DeGrants** | Stacks / sBTC / ALEX | **High** — already submitted | https://grants.stacks.org/ |
| **RootstockCollective** | grants for "every stage of your project"; "submit a proposal, get votes, receive the grant" | Rootstock / RIF | **Medium** — we list Rootstock (RIF appears 538× in repo) | https://rootstock.io/grants/ |
| **Citrea** | the first ZK rollup on Bitcoin; ecosystem/"₿apps" incentives; cBTC bridge | Citrea | **Medium** — we list Citrea (19× in repo) | https://citrea.xyz/ |
| **Fedimint** | community custody / ecash federations; SDK | Fedimint | **High** — already submitted | https://fedimint.org/ |
| **RGB** | smart contracts on Bitcoin/Lightning | RGB | **Medium** — we list RGB | https://rgb.info/ |

> **Rule:** do not over-claim. Apply to an L2 fund only where the rail is **actually
> implemented or credibly scheduled** in `src/settlement.ts` / `SETTLEMENT_RAILS.md`.
> A funder who checks will not find a rail we do not route.

---

## 3. In-kind / liquidity programs (non-cash, but removes cost)

| Program | What it provides | Fit | Source |
|---|---|---|---|
| **Lightning Pool** (Lightning Labs) | lease inbound/outbound channel liquidity for a sats fee | **Medium** — only when we need channel float | https://lightning.engineering/pool/ |
| **Amboss Magma** | Lightning liquidity marketplace | **Medium** — same | https://amboss.tech/ |
| **OpenSats Red Team Fund** | reimbursement of LLM token costs | **High** — see §1 | https://opensats.org/funds |
| **Render / Cloudflare / Supabase / Neon free tiers** | already carry our infra at ~$0/mo | **In use** | internal |

---

## 4. Application strategy

1. **Depth over size.** File the **cheap, high-fit** ones first: OpenSats Red Team (LLM
   reimbursement), Spiral (bitcoin+AI), Btrust (Global Majority). Each is a few pages.
2. **One rail, one L2 fund.** Stacks (submitted) → Rootstock → Citrea, in that order,
   each framed as an integration of that rail.
3. **Reuse the core narrative** (non-custodial multi-rail routing, FOSS, Bitcoin-native,
   AI-agent-built) and vary only the funder-specific hook. Do **not** AI-write the prose
   for any funder that forbids it (see NLnet lesson) — a human must own the words.
4. **Track submissions** in a ledger (funder, date, amount asked, status, next action).
   Mirror it into BOS so finance sees it.

---

## 5. Honest limits

- **No application is made by this document.** It is a map, not a filing.
- Grant **amounts are not stated by the funders on the pages fetched**; do not quote a
  number as if it were published. Ask what fits.
- **Eligibility is a judgement**: a solo, agent-built, Global-Majority project is a strong
  FOSS story but a weak fit for protocol-residency funds (Chaincode/Brink).
- **AI-written proposals are excluded** by some funders (NLnet). Keep a human in the loop
  on any submission where that rule applies.

---

## 6. Sources (fetched 2026-11-15)

OpenSats (Funds, Apply), Spiral, Brink, Chaincode, Btrust, Vinteum, Qala, Stacks Endowment
Grants, RootstockCollective, Citrea, Fedimint, RGB, Lightning Pool, Amboss.

---

*This document was created by an AI agent (OpenHands) on behalf of the user. It applies for
nothing and commits to nothing.*
