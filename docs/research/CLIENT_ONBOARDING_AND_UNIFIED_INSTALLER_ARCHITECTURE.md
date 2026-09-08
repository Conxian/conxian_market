# Conxian Client Onboarding, System Installation & Unified Installer Architecture

> **Generated:** 2026-09-08 | **Session:** 61 | **Status:** Architectural Reference & SOP
> **Scope:** End-to-End Client Acquisition, First-Time System Installation, Provisioning, BYO Credentials, Zero-Custody Verification, System Connectivity, and Unified CLI/Installer Design.

---

## 1. Executive Summary & Purpose

This document presents the full end-to-end architectural blueprint and operational manual for how an enterprise or developer client onboard, installs, configures, and operates the Conxian Ecosystem.

Conxian operates as a **Market-Agnostic, Zero-Custody Value Router and M2M Industrial AI Labor Marketplace**. Rather than deploying heavy centralized infrastructure or holding user assets/API keys, Conxian provides a decentralized, thin-orchestration stack (`@conxian/market-sdk`, `conxian-gateway`, and `conxian-nexus`).

---

## 2. Client Purchase & Acquisition Model

When a client purchases access to or integrates with the Conxian Ecosystem:

### A. What Clients Purchase
1. **Marketplace Access & Job Card Licensing:**
   - License to issue and execute CJCS (Conxian Job Card Specification) industrial AI task contracts.
   - Access to the decentralized agent registry (Productive AI agents across logistics, finance, data processing).
2. **Conxian SDK & Gateway Middleware (`@conxian/market-sdk`):**
   - Typed client library for settlement routing (ERC-8183, ALEX sBTC/USDC, Fedimint e-cash, Lightning, Citrea).
   - TrustTier attestation detection (TEE, Enclave, Light Client).
   - Autonomous SLA enforcement, penalty clawback, and reputation auto-resolution.
3. **Optional Managed Ingress / Dedicated Glass Node (Nexus/Gateway):**
   - Access to high-availability Gateway REST/gRPC endpoints or local Docker container configurations for edge execution.

### B. What Clients Do NOT Purchase (Zero-Custody Guarantee)
- **Centralized Asset Management:** Conxian **never** holds, handles, or custodies client funds, private keys, or seed phrases.
- **Hosted LLM Inference:** Clients do **not** route raw LLM requests through Conxian centralized servers. Inference is conducted locally or using BYO (Bring Your Own) API keys.

---

## 3. System Components & Deployment Architecture

When a client installs Conxian for the first time, they interact with three primary layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT ENVIRONMENT                             │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Unified Installer / CLI                       │  │
│  │                    (`npx @conxian/installer`)                     │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    │                                    │
│        ┌───────────────────────────┼───────────────────────────┐        │
│        ▼                           ▼                           ▼        │
│  ┌────────────┐             ┌────────────┐              ┌────────────┐  │
│  │ Market SDK │             │ Conxian    │              │ Conxian    │  │
│  │ (@conxian/ │             │ Gateway    │              │ Nexus      │  │
│  │ market-sdk)│             │ (REST/gRPC)│              │ (Attest)   │  │
│  └─────┬──────┘             └─────┬──────┘              └─────┬──────┘  │
│        │                          │                           │         │
└────────┼──────────────────────────┼───────────────────────────┼─────────┘
         │                          │                           │
         ▼                          ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL BYO DEFI & AGENT RAILS                      │
│                                                                         │
│  • BYO LLM Keys (DeepSeek / OpenAI / Anthropic)                         │
│  • Non-Custodial Wallets (sBTC / EVM ERC-8183 / Fedimint / Lightning)   │
│  • Hardware Enclaves (AWS Nitro / Android KeyMint TEE)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. Conxian Market SDK (`@conxian/market-sdk`)
- **Role:** Client-side value router, escrow manager, SLA evaluator, and trust tier detector.
- **Location:** Embedded directly inside client applications or agent microservices.

### 2. Conxian Gateway (`conxian-gateway`)
- **Role:** High-performance edge middleware bridging M2M REST/gRPC traffic with non-custodial settlement rails.
- **Connectivity:** Default public endpoints (e.g., `https://gateway.conxian.io` on Neon/Render) or client-hosted Docker instance (`conxian/gateway:latest`).

### 3. Conxian Nexus (`conxian-nexus`)
- **Role:** Verification & attestation Glass Node verifying hardware TEE/Enclave proofs.
- **Connectivity:** `https://nexus.conxian.io`.

---

## 4. Client First-Time Setup & Required Inputs

During initial onboarding, the client configures their local environment with the following inputs:

| Input Field | Purpose | Validation Rule |
|:---|:---|:---|
| **Client DID** | Decentralized Identifier (`did:conxian:...`) | Must begin with `did:` |
| **Gateway URL** | REST/gRPC ingress endpoint | Valid HTTP/HTTPS URL |
| **Nexus URL** | Attestation & proof endpoint | Valid HTTP/HTTPS URL |
| **Settlement Rail** | Default payment rail | One of 8 supported rails (`ERC8183_EVM`, `ALEX_sBTC`, `Fedimint`, `Lightning`, etc.) |
| **Trust Tier** | Hardware assurance tier | `Strict`, `Managed`, `Expedient`, or `ObserverOnly` |
| **BYO API Keys** | Inference keys (DeepSeek, OpenAI) | Non-empty string (stored locally only) |

---

## 5. End-to-End Connectivity Diagnostics & Zero-Custody Sanity Check

The client installer executes a 4-point automated diagnostic before confirming provisioning:

1. **Gateway Endpoint Ping:** Verifies REST/gRPC connectivity to the Gateway.
2. **Nexus Attestation Health Check:** Verifies attestation proof verification availability.
3. **LLM Provider Key Verification:** Confirms local BYOK access without sending keys to Conxian servers.
4. **Zero-Custody Audit:** Verifies that no private keys or unencrypted secret materials are present in the configuration payload.

---

## 6. Recommended Unified Installer Architecture

To simplify onboarding, Conxian recommends a **Unified Installer CLI** (`npx @conxian/installer` or `ConxianMarketSDK.provisionClientEnvironment()`).

The installer executes the following step-by-step workflow:
1. **Load/Interactive Prompt:** Collects `ClientOnboardingConfig`.
2. **Validate Configuration:** Ensures valid URLs, DIDs, and keys.
3. **Run Connectivity Diagnostics:** Tests Gateway, Nexus, and LLM endpoints.
4. **Conduct Zero-Custody Verification:** Confirms local key isolation.
5. **Instantiate & Provision SDK:** Returns an active `ConxianMarketSDK` instance ready to execute Job Cards.

---
*End of Client Onboarding Architecture Specification.*
