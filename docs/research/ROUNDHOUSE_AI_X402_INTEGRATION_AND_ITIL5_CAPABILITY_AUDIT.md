# Roundhouse AI & x402 Integration Architecture: ITIL 5 End-to-End Service Capability & Upgradeability Audit

> **Generated:** 2026-10-14 | **Session:** 75 | **Status:** Active Standard
> **Primary Orchestration Repo:** `conxian_market` (`@conxian/market-sdk`)
> **Framework Alignment:** ITIL 5 Service Value System (SVS), Action-Task-Strategy (ATS), CXIP-1317 Strategic Org-Wide Upgrade Framework

---

## 1. Executive Summary & Strategic Positioning

This audit provides a comprehensive analysis and operational roadmap for integrating **Roundhouse AI** (the open discovery and verification index for the x402 payment protocol) with the **Conxian Ecosystem**.

### **The Core Ecosystem Synergy**
- **Roundhouse AI**: Operates as the **Discovery & Indexing Layer** — maintaining a public directory (`/v0/endpoints`), probing HTTP liveness, auditing merchant payment records, and ranking x402 payment-enabled agent APIs.
- **Conxian Protocol**: Operates as the **Cryptographic Trust, Hardware Attestation, & Multi-Rail Settlement Engine** behind those endpoints. Conxian adds hardware enclave attestation (AWS Nitro, Android StrongBox), ERC-8183 job card escrow, Bitcoin/sBTC/Lightning/Fedimint settlement rails, and ISO 20022 compliance streams.

```
+-----------------------------------------------------------------------------------+
|                            ROUNDHOUSE AI INDEXING ENGINE                          |
|  - Public /v0/endpoints Directory                                                 |
|  - HTTP Liveness & Availability Probing                                           |
|  - Merchant Payment Audit Logs                                                    |
+-----------------------------------------------------------------------------------+
                                        |  ^
                Ingest Directory        |  |  Bi-Directional Settlement
                & Endpoint Metadata     v  |  Event Publishing
+-----------------------------------------------------------------------------------+
|                         CONXIAN MARKET & TRUST ENGINE                             |
|  - @conxian/market-sdk / src/roundhouse_client.ts                                |
|  - Hardware TEE Attestation ("Verified by Conxian" Certificates)                  |
|  - ERC-8183 Programmable Job Card Escrow & SLA Enforcement                        |
|  - Multi-Rail Settlement (Bitcoin L1, Lightning, sBTC, Fedimint, EVM USDC, ISO20022) |
+-----------------------------------------------------------------------------------+
```

---

## 2. Capability & Upgradeability Audit Matrix

| Dimension | Current State (Roundhouse AI) | Current State (Conxian Ecosystem) | Target Integrated State | Upgradeability Strategy |
|:---|:---|:---|:---|:---|
| **Discovery & Indexing** | Ingests `/v0/endpoints` directory; tracks basic HTTP payment headers. | Local agent registry (`agent_registry.ts`); static endpoint lookup. | `@conxian/market-sdk` dynamically ingests Roundhouse `/v0/endpoints` directory to query x402 agents. | Non-breaking SDK extension with cached local fallback. |
| **Trust & Verification** | Liveness probing; HTTP status code checks. | `conxius-enclave-sdk` TEE attestation (Nitro/StrongBox); `verification.ts` TrustTier levels. | Conxian issues "Verified by Conxian" cryptographic attestation certificates for Roundhouse endpoints. | Decoupled verification facade with dynamic certificate signing. |
| **Escrow & SLA** | Direct point-to-point payment authorization (EIP-3009). | ERC-8183 `job_card_escrow.ts` conditional release; `sla_engine.ts` penalty clawback. | High-value x402 endpoints listed on Roundhouse automatically upgrade to ERC-8183 escrow protection. | Market-Agnostic Router dynamically wraps simple x402 demands into escrow job cards. |
| **Settlement Rails** | EVM (Base / Solana USDC). | Multi-Rail Gateway (`gateway_client.ts`): Bitcoin, Lightning, sBTC, Fedimint, ISO 20022. | Conxian settles x402 demands across native Bitcoin/sBTC rails while translating to ISO 20022 (`pacs.008`). | Plug-and-play settlement bridge adhering to BIP-110 and x402 minor unit specs. |
| **Telemetry & Feedback** | Merchant payment audit records. | Real-time monitoring watcher (`monitoring_watcher.ts`); dynamic fee reports. | Conxian publishes verified cross-chain settlement events back to Roundhouse indexing engine. | Asynchronous bi-directional event webhooks with cryptographic proof signatures. |

---

## 3. ITIL 5 End-to-End Service Value Stream Framework

To ensure seamless execution, continuous governance, and modular delivery, the integration is organized across the 5 core ITIL 5 Service Lifecycle stages:

### **3.1 Service Strategy (Value Co-Creation & Market Positioning)**
- **Objective**: Establish Conxian as the default trust, attestation, and escrow engine for all x402 endpoints indexed by Roundhouse AI.
- **Projects & Work Chunks**:
  - `PRJ-RH-01`: Strategic Positioning & Partnership Charter.
  - `CHUNK-01.1`: ADR-006 formalization (`ADR_006_ROUNDHOUSE_AI_X402_INTEGRATION_AND_TRUST_ENGINE.md`).
  - `CHUNK-01.2`: Fee model alignment — applying ADR-004 dynamic flat satoshi floors to Roundhouse micro-transactions.

### **3.2 Service Design (Architecture, Interfaces, & Compliance)**
- **Objective**: Design unified interfaces for directory ingestion, TEE verification certificate issuance, and event feedback.
- **Projects & Work Chunks**:
  - `PRJ-RH-02`: SDK & Interface Specification.
  - `CHUNK-02.1`: `RoundhouseClient` class design in `src/roundhouse_client.ts`.
  - `CHUNK-02.2`: Data schema definitions for Roundhouse `/v0/endpoints` and Settlement Event payloads.

### **3.3 Service Transition (Build, Test, & Release Management)**
- **Objective**: Build and verify unit/integration tests for Roundhouse integration in `@conxian/market-sdk`.
- **Projects & Work Chunks**:
  - `PRJ-RH-03`: SDK Implementation & Test Verification.
  - `CHUNK-03.1`: Implementation of directory fetcher with TEE filtering in `src/roundhouse_client.ts`.
  - `CHUNK-03.2`: Implementation of `publishSettlementEvent` with cryptographic signature generation.
  - `CHUNK-03.3`: Comprehensive Vitest suite in `tests/roundhouse_client.test.ts`.

### **3.4 Service Operation (Monitoring, SLA, & Incident Management)**
- **Objective**: Ensure operational stability, zero secret egress (ZSE compliance), and real-time telemetry monitoring.
- **Projects & Work Chunks**:
  - `PRJ-RH-04`: Telemetry & Escrow SLA Monitoring.
  - `CHUNK-04.1`: Integration with `monitoring_watcher.ts` for tracking Roundhouse API endpoint liveness and latency.
  - `CHUNK-04.2`: Automatic SLA penalty resolution via `sla_engine.ts` when x402 endpoints fail attestation.

### **3.5 Continual Service Improvement (Auditing & Optimization)**
- **Objective**: Continuous refinement of settlement cost compression (BitVM3 / L2 routing) and index ranking feedback loops.
- **Projects & Work Chunks**:
  - `PRJ-RH-05`: Optimization & Index Feedback Loops.
  - `CHUNK-05.1`: Feed back verified uptime and attestation scores to Roundhouse to improve endpoint trust rankings.

---

## 4. Phase-Aligned Implementation Roadmap & Tracked Issues

| Phase | Phase Name | Focus & Key Deliverables | Target Repo & Module | Status |
|:---|:---|:---|:---|:---|
| **Phase 1** | **Research & Architecture Baseline** | Author ITIL 5 audit, ADR-006, and Session 75 ATS Gap Matrix. | `conxian_market`: `docs/research/`, `docs/adr/` | **Active (Session 75)** |
| **Phase 2** | **SDK Client Implementation** | Build `src/roundhouse_client.ts` with directory fetching & event publishing. | `conxian_market`: `src/roundhouse_client.ts`, `src/index.ts` | **Active (Session 75)** |
| **Phase 3** | **Verification & Unit Testing** | Author unit tests in `tests/roundhouse_client.test.ts` & update `src/sdk_bridge.ts`. | `conxian_market`: `tests/`, `src/sdk_bridge.ts` | **Active (Session 75)** |
| **Phase 4** | **Enclave Attestation Binding** | Connect `conxius-enclave-sdk` attestation certificates to Roundhouse endpoint records. | `conxius-enclave-sdk` / `conxian-gateway` | Phase 2 Follow-on |
| **Phase 5** | **Live Bi-Directional Webhooks** | Deploy production webhook listeners in `conxian-gateway` for real-time index feedback. | `conxian-gateway` / `conxius-platform` | Phase 3 Follow-on |

---
*Maintained per Conxian ITIL 5 & CXIP-1317 Standards.*
