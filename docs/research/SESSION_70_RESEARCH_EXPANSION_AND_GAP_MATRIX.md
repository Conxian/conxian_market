# Session 70: ERC-8004 Agent Identity & MCP-402 Tool Payment Integration, Research Expansion & Gap Matrix

> **Generated:** 2026-09-30 | **Session:** 70 | **Status:** Active
> **Primary Orchestration Repo:** `conxian_market` (`@conxian/market-sdk`)

---

## 1. Executive Summary & Strategic Positioning

With ADR 002 establishing Conxian as the verifiable settlement, programmable escrow, and trust layer on top of x402 (HTTP 402), and ADR 003 introducing ERC-8004 agent identity and MCP-402 tool payment facade primitives (`src/agent_registry.ts` and `src/mcp_402.ts`), Session 70 focuses on wiring these agent-payment and identity primitives into the unified marketplace client bridge (`ConxianMarketSDK` in `src/sdk_bridge.ts`).

By exposing `AgentRegistry` and `Mcp402Facade` directly on `ConxianMarketSDK`, enterprise clients and autonomous AI agents gain single-point SDK access to:
1. Off-chain fail-closed ERC-8004-aligned agent registration and trust tier authorization.
2. Canonical SHA-256 card digest generation for identity binding.
3. ERC-8004 agent reputation tracking tied to card digests.
4. MCP-402 payment demand creation for Model Context Protocol tool invocations.
5. MCP-402 receipt validation and pre-dispatch tool execution authorization.

---

## 2. Systematic Reconnaissance & Gap Register

| Gap ID | Category | Priority | As-Is State | To-Be State |
|:-------|:---------|:---------|:------------|:------------|
| **GAP-70-01** | SDK Bridge Agent Identity | High | `AgentRegistry` exists in `src/agent_registry.ts` but is not instantiated or exposed on `ConxianMarketSDK`. | `ConxianMarketSDK` instantiates `AgentRegistry` and exposes methods for registering agents, checking authorization, and updating reputation records. |
| **GAP-70-02** | SDK Bridge MCP-402 Payment | High | `Mcp402Facade` exists in `src/mcp_402.ts` but is not instantiated or exposed on `ConxianMarketSDK`. | `ConxianMarketSDK` instantiates `Mcp402Facade` and exposes `createMcp402Demand` and `authorizeMcp402ToolCall`. |
| **GAP-70-03** | Test Coverage & Capability Summary | High | `tests/sdk_bridge.test.ts` lacks test cases for agent registration, reputation tracking, and MCP-402 tool authorization through the SDK bridge. `getCapabilitySummary()` does not report agent identity & MCP-402 capabilities. | Unit tests added in `tests/sdk_bridge.test.ts` covering all new bridge methods. Capability summary updated with `agentRegistryEnabled: true` and `mcp402FacadeEnabled: true`. |

---

## 3. Weighted Candidate Scoring Matrix

| Candidate ID | Candidate Feature Name | Gap Coverage (30%) | Cost Inverted (20%) | Risk Inverted (20%) | Testability (15%) | Alignment (15%) | Weighted Total | Rank |
|:-------------|:-----------------------|:------------------:|:-------------------:|:------------------:|:-----------------:|:---------------:|:--------------:|:----:|
| **CAN-70-A** | **Unified ERC-8004 & MCP-402 SDK Bridge Integration** | **5/5 (1.50)** | **5/5 (1.00)** | **5/5 (1.00)** | **5/5 (0.75)** | **5/5 (0.75)** | **5.00 / 5.00 (100%)** | **#1 (Selected)** |
| CAN-70-B | Isolated Standalone CLI Tool for Agent Registration | 2/5 (0.60) | 3/5 (0.60) | 3/5 (0.60) | 3/5 (0.45) | 2/5 (0.30) | 2.55 / 5.00 (51%) | #2 |
| CAN-70-C | External EVM Bridge Proxy for ERC-8004 Cards | 1/5 (0.30) | 1/5 (0.20) | 1/5 (0.20) | 2/5 (0.30) | 1/5 (0.15) | 1.15 / 5.00 (23%) | #3 |

---

## 4. Implementation Details

- **Class**: `ConxianMarketSDK` (`src/sdk_bridge.ts`)
- **New Properties**:
  - `readonly agentRegistry: AgentRegistry;`
  - `readonly mcp402Facade: Mcp402Facade;`
- **New Bridge Methods**:
  - `registerAgent(card: AgentCard): AgentRegistryEntry`
  - `getAgent(agentId: string): AgentRegistryEntry | undefined`
  - `isAgentAuthorized(agentId: string, requiredTier: TrustTier): boolean`
  - `updateAgentReputation(record: AgentReputationRecord): void`
  - `createMcp402Demand(call: McpToolCall): X402PaymentDemand`
  - `authorizeMcp402ToolCall(call: McpToolCall, receipt: X402PaymentReceipt): Mcp402PaymentGateResult`
- **Capability Summary Updates**:
  - `coreCapabilities`: incremented to 15
  - `agentRegistryEnabled: true`
  - `mcp402FacadeEnabled: true`

---
*Maintained per Conxian Session Cycle standards.*
