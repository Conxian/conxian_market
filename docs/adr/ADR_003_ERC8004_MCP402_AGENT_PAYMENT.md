# ADR 003: ERC-8004 Agent Identity + MCP-402 Tool-Payment Alignment

> **Status:** Proposed
> **Date:** 2026-09-30
> **Author:** Conxian KB maintenance agent (botshelomokoka)
> **Deciders:** Conxian Core Maintainers (pending review)

---

## 1. Context & Problem Statement

ADR 002 positioned Conxian as the verifiable settlement/escrow trust layer on
top of x402 (HTTP 402). The 2026-09-29 research scan identifies the
agent-payment standard stack converging on **x402 + ERC-8004 + MCP-402**:

- **ERC-8004 (EIP-8004)** — on-chain AI-agent identity, reputation, and
  validation (Ethereum Foundation, MetaMask, Google, Coinbase; published
  2025-08, mainnet 2026-01). It deliberately *excludes* payments and composes
  with x402. Agent identity is anchored by an NFT pointing to an "Agent Card".
- **MCP-402** — Model Context Protocol (MCP) tool calls carrying an x402
  (HTTP 402 Payment Required) demand: an agent pays before a tool/action
  dispatches.

Gap: `conxian_market` already ships the x402 facade + attestation-backed escrow
(`x402_facade.ts`, `X402EscrowGateway`), but it has **no ERC-8004-aligned agent
identity registry and no MCP-402 tool-payment path**. Both are currently
roadmap/docs-only (0 code). This ADR closes that gap.

## 2. Decision

1. Align agent identity with **ERC-8004 semantics**, expressed on Conxian's
   Bitcoin/Stacks rails (a SIP-010 NFT or Clarity map anchors an `AgentCard`),
   not on EVM.
2. Add an **MCP-402 module** that attaches an x402 payment demand to an MCP
   tool invocation and validates the receipt before dispatch.

## 3. Design

### 3.1 Agent Identity Registry (ERC-8004-aligned)

- `AgentCard` carries identity + capability + endpoint + provider DID metadata,
  plus a `card_digest` binding the card to its issuer.
- Identity is anchored off-chain as a canonical digest and on-chain by a Stacks
  SIP-010 NFT (or Clarity map) in a separate contracts repo — not an EVM
  ERC-721.
- Reputation/validation records bind to the card digest (fail-closed if absent).

### 3.2 MCP-402 tool payment

- `Mcp402Facade` maps an MCP `tool_call` to an `X402PaymentDemand` (reusing the
  existing `x402_facade.ts`), verifies the returned `X402PaymentReceipt`, then
  dispatches the tool.
- Escrow locking reuses `X402EscrowGateway`; Strict/Managed trust tiers remain
  attestation-backed.

## 4. Implementation plan

1. `src/agent_registry.ts` — `AgentCard`, digest binding, registry surface.
2. `src/mcp_402.ts` — MCP tool-call -> demand -> verify -> dispatch.
3. `tests/agent_registry.test.ts`, `tests/mcp_402.test.ts`.
4. Stacks Clarity `agent_registry.clar` (separate contracts repo / PR).

## 5. Non-goals

- No EVM deployment — ERC-8004 is a semantic reference, not an EVM dependency.
- No custody of funds or keys (consistent with ADR 002 zero-custody guarantee).

---
**CONXIAN LABS // 2026**
