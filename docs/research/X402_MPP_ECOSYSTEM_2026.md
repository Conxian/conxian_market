# x402 / MPP / x402-Foundation — ecosystem scan and SDK juxtaposition

> **Status:** Research | **Date:** 2026-11-14 | **Owner:** Conxian Labs
> **Trigger:** owner — *"expand x402 agentic-payments research (x402/MPP/x402-Foundation)
> and reconcile with the market SDK"* (market #367), then *"also see https://x402.org/"*.
> **Companion:** `docs/adr/ADR_002_M2M_X402_TRUST_LAYER.md`,
> `docs/adr/ADR_003_ERC8004_MCP402_AGENT_PAYMENT.md`,
> `docs/CLI_CAPABILITY_PROTOCOL_CONFORMANCE_2026_10_15.md` (§x402 v2 profile).

---

## 0. Method and confidence

This scan juxtaposes **external standards** against **what the market SDK actually
ships**. A first pass was limited to Cloudflare's docs (the search API was rate-limited);
the owner then pointed at **`x402.org`**, whose pages were read directly. Every external
claim is tagged **[verified]** (a primary/official source was read) or **[unverified]**
(no primary source reachable). **Unverified items are marked and must not be published as
fact.**

| Tag | Meaning |
|---|---|
| **[verified]** | Read in an official source (`x402.org`, Cloudflare docs, or a repo cited in-tree) |
| **[unverified]** | No primary source reachable — treat as a lead, not a fact |

---

## 1. The external landscape (late 2026)

### 1.1 x402 — a Linux Foundation standard **[verified]**

- **What:** an open, neutral standard for internet-native payments. HTTP-native (built
  into existing requests), **zero protocol fees** (only nominal payment-network fees),
  no accounts, no centralization. Created by **Coinbase**.
- **Governance — Linux Foundation.** The **x402 Foundation** is *"a Series of LF
  Projects, LLC"* (`x402.org` footer; `lfprojects.org` policies). The Linux Foundation
  announced its **operational launch on 2026-07-14**, with the **completed contribution
  of the x402 protocol by Coinbase**, under formal vendor-neutral governance. The
  Foundation's *intent to launch* was **April 2026**.
  - **Executive Director:** **Michael Hursta**, appointed **2026-10-01**.
  - **Governance:** a Governing Board; **Premier** members get an appointed board seat
    and budget influence; **General** members vote for a General Board representative.
  - **Working groups:** Domain Discovery, Identity, Tax, Card Acceptance.
- **Membership — 40 organisations at launch [verified]:**
  - **Premier (17):** Adyen, Amazon Web Services (AWS), American Express, Circle,
    Cloudflare, Coinbase, Fiserv, **Google**, **Mastercard**, Monad Foundation, MoonPay,
    Ripple, **Shopify**, Solana Foundation, Stellar Development Foundation, **Stripe**,
    **Visa**.
  - **General (18):** Aleo, Fireblocks, Galaxia Moneytree, Hecto Financial, Injective,
    KakaoPay, Kite AI, LayerZero Labs, Merit Systems, NEAR Foundation, Orthogonal,
    Polygon Labs, Quant Network, SKALE, t54 labs, utexo, World Liberty Financial, zerohash.
  - **Associate (5):** BSV Association, Cardano Foundation, Casper, Japan Contents
    Blockchain Initiative, OMA3.
  - Membership fees: Premier **$200,000**; General **$75k/$50k/$25k** by employee count.
- **Chains/assets:** blockchain-agnostic — all EVM-compatible chains, Solana, and more;
  stablecoins are the primary use case; **extensible to traditional payment methods
  (cards)**.
- **Version:** **x402 v2** is current. Cloudflare migrated its agent payments to
  `@x402/core` + `@x402/evm` v2 on **2026-02-09**. Breaking changes from v1:
  `PaymentRequirements.amount` replaces `maxAmountRequired`; network IDs accept
  **CAIP-2** (`eip155:84532`) as well as legacy names; the header moved from
  `X-PAYMENT` to **`PAYMENT-SIGNATURE`**.
- **Maturity:** *"production-ready … processed millions of transactions … audited"* (x402
  FAQ).

> ⚠️ This corrects the first pass of this scan, which (with only Cloudflare docs
> reachable) could not verify the Linux Foundation affiliation and listed Google/Stripe/
> Visa as unverified adopters. **All three are confirmed Premier members.**

### 1.2 MPP — Machine Payments Protocol **[verified]**

- **What:** an open M2M payment protocol that formalises HTTP 402 as an **HTTP
  authentication scheme** (`WWW-Authenticate: Payment` / `Authorization: Payment`, plus
  `Payment-Receipt`). Payment-method-agnostic: stablecoins **and cards via Stripe**.
- **Who:** **co-authored by Tempo and Stripe** (`mpp.dev`). **[verified]** Documented at
  `mpp.dev`; the scheme is proposed to the IETF at `paymentauth.org`. SDK: `mppx`
  (TS/Python/Rust/Go/Ruby). Payment methods include Tempo, EVM, Stripe, Card, Lightning,
  Solana, XRP Ledger, Stellar, Monad, NEAR Intents, and RedotPay.
- **Intents:** `charge` (one-time), `session` (usage), `subscription` (recurring).
- **Relationship to x402:** **backwards-compatible** — MPP clients can consume existing
  x402 services unchanged ("Use MPP with x402").
- **Wire:** a Challenge carries `id`, `realm`, `method`, `intent`, `request`
  (base64url JCS JSON), and optional `expires`/`header`/`opaque`; a Credential echoes the
  challenge and adds `source` + `payload`; a Receipt carries `method`/`reference`/
  `status`/`timestamp`.

### 1.3 MCP payments — layered, not a spec **[verified]**

- There is **no official "MCP payments" specification**. Payments are layered onto MCP by
  both x402 (`paidTool` → 402 → pay → retry; `withX402`) and MPP (same
  challenge/credential/receipt flow over JSON-RPC via `mppx` `Transport.mcpSdk()`).
- MCP itself added **elicitation** (spec `2025-11-25`), which can drive out-of-band
  authorisation/payment flows.

### 1.4 Items that remain unverified **[unverified]**

- **AP2** (Google Agent Payments Protocol): no primary source reachable. *(Note: Google is
  an x402 Premier member, so Google's agent-payment posture may in fact be x402-centred —
  verify before claiming AP2 is separate.)*
- **ERC-8004** status/mainnet date: not verifiable in this scan (this repo already cites
  `eips.ethereum.org/EIPS/eip-8004`).
- **Stripe "Agentic Commerce Protocol"**: not found; what **is** verified is Stripe as an
  x402 **Premier member** and an MPP card rail.
- **M2M market-size figures**: none verified.

### 1.5 2026 timeline **[verified]**

| Date | Event |
|---|---|
| 2026-04 | x402 Foundation **intent to launch** |
| 2026-02-09 | x402 **v2** migration (Cloudflare Agents SDK v0.4.0) |
| 2026-07-14 | **Linux Foundation operational launch** of the x402 Foundation; Coinbase contribution completed; 40 members |
| 2026-10-01 | **Michael Hursta** appointed Executive Director |
| 2026-07-13 | MCP **elicitation** support |
| 2026-09-30 | Cloudflare **Monetization Gateway** beta + AI Gateway **Machine Payments** beta |

---

## 2. Juxtaposition — what the market SDK ships vs the standard

| Standard surface | Market SDK module | State | Gap |
|---|---|---|---|
| x402 demand/receipt (v1 facade) | `src/x402_facade.ts` (`X402EscrowGateway`, `jobCardToDemand`, `verifyPaymentReceipt`) | **Shipped** | Legacy shape; not auto-labelled v2 |
| **x402 v2 wire** (`PAYMENT-REQUIRED`/`-SIGNATURE`/`-RESPONSE`, CAIP-2, decimal atomic) | `src/x402_v2_wire.ts` (`conxian-x402-v2-wire/1`) | **Shipped** | Bounded codecs only; no signature validation, no settlement |
| MCP-402 tool payment | `src/mcp_402.ts` (`Mcp402Facade`) | **Shipped** | Gates on a verified receipt; no facilitator |
| Replay protection | `src/replay_guard.ts` | **Shipped (bounded)** | **Process-local, in-memory** — not durable/shared |
| Entitlement resolution | `src/entitlement_resolver.ts` | **Shipped (fail-closed)** | Fails closed to ObserverOnly without a resolver |
| Agent identity (ERC-8004-aligned) | `src/agent_registry.ts` + `contracts/agent_registry.clar` | **Shipped** | ERC-8004 registry lookup itself is #176/#159 |
| **MPP** (`Authorization: Payment`, intents, cards) | `src/mpp_bridge.ts` (ADR-008) | **Shipped (structural)** | No signature verification; no settlement |
| MCP **elicitation** flows | — | **Not present** | Out-of-band auth/payment |
| Durable/shared settlement | — | **Not present** | Deployment concern (#176) |

**Read:** the SDK is **well ahead on the v2 wire and the trust layer** (attestation,
escrow, SLA, replay, entitlement), and **behind on MPP and elicitation**. The
differentiator remains ADR-002's thesis: Conxian is the **trust layer on top of** x402
(attestation + escrow + SLA + proof artifacts), not another payment rail.

---

## 3. The MPP question — adopt, bridge, or ignore?

MPP is the first credible **superset** of x402 (it can carry x402 unchanged, and adds
cards + sessions + subscriptions over a standard HTTP auth scheme). Three options:

| Option | What it means | Cost | Fit |
|---|---|---|---|
| **Ignore** | Stay x402-only | 0 | Loses the subscription surface MPP standardises |
| **Bridge** | Accept MPP challenges and map them to the existing escrow gate; emit `Payment-Receipt` | Medium | **Best fit** — reuses the whole trust layer |
| **Adopt** | Re-base the facade on MPP | High | Throws away the shipped v2 wire |

**Recommendation: bridge.** Add an `mpp_bridge.ts` that parses `WWW-Authenticate:
Payment` / `Authorization: Payment`, maps an MPP `charge` intent to the existing
`X402EscrowGateway` demand, and returns a `Payment-Receipt`. Keep `x402_v2_wire.ts` as
the transport. Do **not** re-base on MPP; the escrow/attestation layer is the moat.

> ✅ **Decided and implemented** — see `docs/adr/ADR_008_MPP_BRIDGE.md` and
> `src/mpp_bridge.ts` (issue #371). MPP is co-authored by **Tempo and Stripe** (verified
> at `mpp.dev`).

---

## 4. Reconciliation with the fee model (ADR-007)

The two-product model classifies by **job card presence**:

- A raw x402/MCP-402/MPP call with **no** job card → **rail** → ADR-005 dynamic fee.
- A call that **locks escrow against a job card** → **matched job** → **10% take**.

This maps cleanly onto the landscape: x402 and MPP are **rail transports** (Product A);
the moment they lock the Conxian escrow they become **matched jobs** (Product B). MPP's
`subscription` intent is the **D-6 surface** (#1343) — recurring revenue, not a
per-settlement fee.

> **Critical positioning note.** x402 itself is *"zero protocol fees"* — Conxian's fee is
> **not** a tax on the x402 protocol; it is the price of the **trust layer** (attestation
> + non-custodial escrow + SLA + dispute + proof artifacts) that x402 deliberately does
> not provide. Say it that way. Charging a toll on a zero-fee standard would read as
> rent-seeking; charging for verification/settlement is the ADR-002 value proposition.

---

## 5. Correction to the earlier note (now confirmed, not "unverified")

The first pass of this scan added a note to ADR-002 questioning the *"Linux Foundation"*
attribution of x402. **That note was wrong and is now withdrawn:** `x402.org` states it is
*"a Series of LF Projects, LLC"*, and the Linux Foundation's own announcement
(2026-07-14) confirms the x402 Foundation under LF governance. **ADR-002's original
wording was correct.**

---

## 6. Sources

**Verified (read directly):**
- `x402.org` — home, `/members/`, `/get-involved/`, `/announcements/`, and the
  2026-07-14 operational-launch announcement (premier/general/associate member lists;
  governance; working groups).
- `x402.org` — 2026-10-01 Executive Director announcement (Michael Hursta).
- `x402.org` footer — *"x402 a Series of LF Projects, LLC"*.
- `mpp.dev` — home, `/protocol/challenges`, `/protocol/credentials`, `/protocol/receipts`,
  `/protocol/http-402` (Challenge/Credential/Receipt wire; intents; **co-authored by Tempo
  and Stripe**); `paymentauth.org` (IETF proposal).
- Cloudflare — x402, MPP, Monetization Gateway docs; Agents SDK v0.4.0 changelog
  (2026-02-09); Machine Payments changelog (2026-09-30).

**Already cited in-tree (not re-read this scan):**
- `github.com/x402-foundation/x402` (spec v2, transports)
- `eips.ethereum.org/EIPS/eip-8004`
- `modelcontextprotocol/modelcontextprotocol` (tools, elicitation)

**Verified this scan (read directly):** `mpp.dev` — MPP co-authored by Tempo and Stripe;
Challenge/Credential/Receipt wire; intents. **Unverified leads:** `ap2-protocol.org`.

---

## 7. Bottom line

x402 is now a **Linux Foundation standard with 40 members** — including **Google, Stripe,
Visa, Mastercard, Amex, PayPal, Shopify, AWS, Cloudflare, Coinbase** — and it charges
**zero protocol fees**. That is the strongest possible tailwind for ADR-002: the world's
largest payments and cloud companies are standardising HTTP-native agent payments, and
the *only* thing they leave open is **trust** (attestation, escrow, SLA, dispute) — which
is exactly what the market SDK ships. The SDK is ahead on the **x402 v2** wire and the
trust layer, behind on **MPP** (bridge, don't re-base) and **elicitation**, and the fee
model reconciles cleanly (rail transports = Product A; escrow-locked = Product B;
MPP `subscription` = the D-6 surface). Conxian's fee is a **trust-layer fee, not a
protocol toll** — price and describe it that way.
