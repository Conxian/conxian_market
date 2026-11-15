# ADR-008: MPP (Machine Payments Protocol) bridge — accept MPP over the x402 v2 wire

> **Status:** Accepted | **Date:** 2026-11-14
> **Deciders:** Conxian Labs (owner)
> **Related:** ADR-002 (M2M x402 trust layer), ADR-003 (ERC-8004 / MCP-402),
> ADR-005 (dynamic rail fee), ADR-007 (two-product rate model)
> **Refs:** market #367 (research), market #371 (this bridge)

---

## Context

MPP (Machine Payments Protocol) standardises HTTP 402 as the **`Payment` HTTP
authentication scheme** — a server issues a `WWW-Authenticate: Payment …` **Challenge**,
the client answers with an `Authorization: Payment …` **Credential**, and the server
returns a **`Payment-Receipt`** header. It is **co-authored by Tempo and Stripe** and is
a **backwards-compatible superset of x402**: MPP clients can consume existing x402
services unchanged, and MPP adds card rails plus three **intents** — `charge` (one-time),
`session` (metered), `subscription` (recurring).

The market SDK ships the **x402 v2 wire** (`src/x402_v2_wire.ts`), MCP-402
(`src/mcp_402.ts`), a replay guard, and the escrow/attestation trust layer — but **no MPP
surface**. This ADR records the decision to **bridge** MPP onto the existing trust layer
rather than re-base on it.

## Decision

1. **Bridge, do not re-base.** Add `src/mpp_bridge.ts` implementing bounded codecs for the
   MPP Challenge, Credential, and Receipt, plus an `MppBridge` that authorizes an MPP
   Credential through the **existing** `X402EscrowGateway` gate and a `ReplayGuard`.
   `x402_v2_wire.ts` remains the transport.
2. **Structural only, fail-closed.** The bridge parses and validates wire shape and
   *structural* binding (challenge/credential echo, intent/realm/method, amount, expiry,
   single-use). It **never** verifies a signature, moves funds, or settles. Any mismatch
   denies.
3. **Pricing (ADR-007).** `charge` and `session` are **raw rail** calls → ADR-005 dynamic
   fee. `subscription` is priced **fail-closed** at the **matched-job take (10%)** until
   the D-6 decision (#1343) sets the recurring rate.
4. **Single-use.** A consumed challenge id is rejected on replay; an **invalid** credential
   does **not** consume the id (verification precedes consumption).

## Consequences

- The SDK gains an MPP surface without a second payment path: every MPP `charge`/`session`
  flows through the same escrow + SLA + proof substrate as x402/MCP-402.
- Card rails and the `subscription` intent are now representable; recurring revenue is
  tracked by #1343.
- **Positioning:** x402/MPP charge **zero protocol fees**; Conxian's fee is the price of
  the **trust layer**, not a toll on the standard.

## Non-goals

- No signature/cryptographic verification (a facilitator concern).
- No funds movement or settlement in this repo.
- No subscription billing engine (that is #1343).

---

**CONXIAN LABS // 2026**
