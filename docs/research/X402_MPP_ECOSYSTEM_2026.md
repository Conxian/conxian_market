# x402 / MPP / x402-Foundation — ecosystem scan and SDK juxtaposition

> **Status:** Research | **Date:** 2026-11-14 | **Owner:** Conxian Labs
> **Trigger:** owner — *"expand x402 agentic-payments research (x402/MPP/x402-Foundation)
> and reconcile with the market SDK"* (market #367).
> **Companion:** `docs/adr/ADR_002_M2M_X402_TRUST_LAYER.md`,
> `docs/adr/ADR_003_ERC8004_MCP402_AGENT_PAYMENT.md`,
> `docs/CLI_CAPABILITY_PROTOCOL_CONFORMANCE_2026_10_15.md` (§x402 v2 profile).

---

## 0. Method and confidence

This scan juxtaposes **external standards** against **what the market SDK actually
ships**. It is deliberately conservative: every external claim is tagged
**[verified]** (a primary/official source was read) or **[unverified]** (no primary
source was reachable). Tooling was degraded during the scan (search API rate-limited,
browser unavailable), so only Cloudflare's official developer documentation and
repositories already cited inside this repo were read. **Unverified items are marked
and must not be published as fact.**

| Tag | Meaning |
|---|---|
| **[verified]** | Read in an official source (Cloudflare docs, or a repo already cited in-tree) |
| **[unverified]** | No primary source reachable — treat as a lead, not a fact |

---

## 1. The external landscape (late 2026)

### 1.1 x402 — HTTP 402 as a payment scheme **[verified]**

- **What:** Coinbase-created standard that turns `HTTP 402 Payment Required` into a
  payment negotiation for on-chain stablecoins. A client receives requirements, pays,
  and retries with a payment proof.
- **Version:** **x402 v2 is current.** Cloudflare migrated its agent payments to
  `@x402/core` + `@x402/evm` v2 on **2026-02-09**. Breaking changes from v1:
  `PaymentRequirements.amount` replaces `maxAmountRequired`; network IDs accept
  **CAIP-2** (`eip155:84532`) as well as legacy names; the header moved from
  `X-PAYMENT` to **`PAYMENT-SIGNATURE`**.
- **Governance:** the **x402 Foundation**; **Coinbase and Cloudflare** are founding
  members. Public facilitator at `https://x402.org/facilitator` (Coinbase-operated).
  Spec/SDK at `github.com/x402-foundation/x402`.
  - ⚠️ ADR-002 describes x402 as a *"Linux Foundation specification"*. That affiliation
    was **not verifiable** in this scan **[unverified]** — see §5.
- **Assets/chains:** USDC on Base, Ethereum, Solana (plus Polygon, Optimism, Arbitrum,
  Avalanche, Aptos, Stellar, Sui, Algorand). Schemes: `exact`, `upto`.
- **Adopters verified:** Cloudflare (Agents SDK, AI Gateway Machine Payments,
  Monetization Gateway, Pay-Per-Crawl), Coinbase (facilitator). **Stripe/Google/Visa
  as x402 adopters: [unverified].**

### 1.2 MPP — Machine Payments Protocol **[verified]**

- **What:** an open M2M payment protocol that formalises HTTP 402 as an **HTTP
  authentication scheme** (`WWW-Authenticate: Payment` / `Authorization: Payment`,
  plus `Payment-Receipt`). Payment-method-agnostic: stablecoins **and cards via
  Stripe**.
- **Intents:** `charge` (one-time), `session` (usage), `subscription` (recurring).
- **Relationship to x402:** **backwards-compatible** — MPP clients can consume
  existing x402 services unchanged ("Use MPP with x402"). Documented at `mpp.dev`;
  the scheme was proposed to the IETF at `paymentauth.org`. SDK: `mppx`
  (TS/Python/Rust/Go/Ruby).
- ⚠️ Who **founded/operates** MPP was **[unverified]** in this scan.

### 1.3 MCP payments — layered, not a spec **[verified]**

- There is **no official "MCP payments" specification**. Payments are layered onto
  MCP by both x402 (`paidTool` → 402 → pay → retry; `withX402`) and MPP (same
  challenge/credential/receipt flow over JSON-RPC via `mppx` `Transport.mcpSdk()`).
- MCP itself added **elicitation** (spec `2025-11-25`), which can drive out-of-band
  authorisation/payment flows.

### 1.4 Items that could not be verified **[unverified]**

- **AP2** (Google Agent Payments Protocol): no primary source reachable.
- **ERC-8004** status/mainnet date: not verifiable in this scan (though this repo
  already cites `eips.ethereum.org/EIPS/eip-8004`).
- **Stripe "Agentic Commerce Protocol"**: not found; only Stripe-as-payment-method
  (MPP cards) and Stripe Connect (Pay-Per-Crawl) were verified.
- **M2M market-size figures**: none verified.

### 1.5 2026 timeline **[verified]**

| Date | Event |
|---|---|
| 2026-02-09 | x402 **v2** migration (Cloudflare Agents SDK v0.4.0) |
| 2026-07-13 | MCP **elicitation** support |
| 2026-09-30 | Cloudflare **Monetization Gateway** beta + AI Gateway **Machine Payments** beta |
| 2026-11-09 | Cloudflare Radar Bots Directory rebuilt on BotBase |

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
| **MPP** (`Authorization: Payment`, intents, cards) | — | **Not present** | Entirely new surface (§3) |
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
`X402EscrowGateway` demand, and returns a `Payment-Receipt`. Keep `x402_v2_wire.ts`
as the transport. Do **not** re-base on MPP; the escrow/attestation layer is the moat.

> ⚠️ This is a **proposal**, not a decision. MPP's operator is **[unverified]**, so
> adopting it before confirming governance is premature. Track as a new ADR if pursued.

---

## 4. Reconciliation with the fee model (ADR-007)

The two-product model classifies by **job card presence**:

- A raw x402/MCP-402/MPP call with **no** job card → **rail** → ADR-005 dynamic fee.
- A call that **locks escrow against a job card** → **matched job** → **10% take**.

This maps cleanly onto the landscape: x402 and MPP are **rail transports** (Product A);
the moment they lock the Conxian escrow they become **matched jobs** (Product B). MPP's
`subscription` intent is the **D-6 surface** (#1343) — recurring revenue, not a
per-settlement fee.

---

## 5. Corrections to make in-tree (flagged, not silently changed)

1. **ADR-002** calls x402 a *"Linux Foundation specification"*. This scan could not
   verify the Linux Foundation affiliation; the verified governance is the **x402
   Foundation (Coinbase + Cloudflare)**. **Action:** verify at `x402.org` and either
   cite it or correct the wording. Left as-is pending verification (see ADR-003 §5).
2. **ADR-003** is **Proposed** and predates x402 v2. Its MCP-402 design predates MCP
   **elicitation** and MPP. **Action:** add the §5 research update (done in that file).

---

## 6. Sources

**Verified (read this scan):**
- Cloudflare — x402: `developers.cloudflare.com/agents/tools/payments/x402/`
- Cloudflare — MPP: `developers.cloudflare.com/agents/tools/payments/mpp/`
- Cloudflare — Monetization Gateway: `developers.cloudflare.com/monetization-gateway/x402/`
- Cloudflare — Agents SDK v0.4.0 changelog (2026-02-09)
- Cloudflare — Machine Payments changelog (2026-09-30)

**Already cited in-tree (not re-read this scan):**
- `github.com/x402-foundation/x402` (spec v2, transports)
- `eips.ethereum.org/EIPS/eip-8004`
- `modelcontextprotocol/modelcontextprotocol` (tools, elicitation)

**Unverified leads (verify before publishing):** `ap2-protocol.org`, `stripe.com`,
`paymentauth.org` (MPP IETF proposal), `mpp.dev` (MPP operator).

---

## 7. Bottom line

The SDK already implements the **hard half** — x402 **v2** wire, MCP-402, replay guard,
entitlement, attestation-backed escrow. The **open half** is **MPP** (bridge, don't
re-base) and **elicitation**. The fee model reconciles cleanly: rail transports are
Product A, escrow-locked calls are Product B, and MPP `subscription` is the D-6
surface. Two in-tree claims need verification (the Linux Foundation attribution; the
stale ADR-003) — both flagged, neither silently changed.
