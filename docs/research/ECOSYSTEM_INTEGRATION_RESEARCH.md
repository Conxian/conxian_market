# Conxian Market — Full Ecosystem Integration Research

| Metadata | Value |
|---|---|
| Classification | Public-safe research |
| Status | Phase 0 — 2026-08-02 |
| Authority | [Market issue #9](https://github.com/Conxian/conxian_market/issues/9) |
| Ethos alignment | Sovereign, Productive, Federated, BYOK, Multi-Deployment |

## Executive Summary

The Conxian Marketplace is the **primary value capture mechanism** of the Conxian ecosystem.
Every other repo — gateway, nexus, enclave-sdk, wallet, platform — is infrastructure that
enables the market. This document maps the full integration architecture and expansion
research, aligned to the five pillars of Conxian ethos:

1. **Sovereign AI (BYOK)** — Users control keys, data, and inference costs
2. **Productive AI** — Real-economy modules, not consumer chatbots
3. **Federated** — MCP-only handoffs; thin platform, thick edge
4. **Multi-Deployment** — Cloud, Edge-Local, On-Prem Sovereign
5. **DeFi-Agnostic** — Orchestration over any financial primitive

---

## Integration Architecture

### 1. conxian-gateway → Market Settlement Rails

```
┌──────────────────────────────────────────────────────────────────────┐
│  MARKETPLACE (Discovery → Escrow → Settlement → Fee Distribution)    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐   │
│  │  Agent Discovery │───▶│  ERC-8183 Escrow  │───▶│  Settlement    │   │
│  │  (MCP Handoff)   │    │  (BYOK custody)   │    │  (2% fee)      │   │
│  └─────────────────┘    └──────────────────┘    └────────────────┘   │
│           │                       │                      │           │
│           ▼                       ▼                      ▼           │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │              CONXIAN GATEWAY (Settlement Rails)              │    │
│  │  • ISO 20022 pacs.008/009 ingestion                         │    │
│  │  • x402 Payment Required → escrow trigger                    │    │
│  │  • UCV-1 universal chain verification                        │    │
│  │  • BitVM / Babylon / RGB adapter families                    │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Integration points:**
- **Settlement ingestion**: Gateway's ISO 20022 and x402 parsers feed marketplace escrow
- **Chain verification**: UCV-1 proves settlement finality before escrow release
- **Fee capture**: Gateway routes 2% protocol fee → 50/30/20 treasury allocation
- **Status**: Gateway v0.1.4 active, settlement parsers production-ready. Market→Gateway
  integration requires escrow contract deployment and fee-distribution wiring.

### 2. conxian-nexus → Market Trust & ZK Verification

```
┌──────────────────────────────────────────────────────────────────────┐
│  NEXUS TRUST LAYER                                                   │
│  • ZK proof verification of agent computation                        │
│  • Attestation chain validation                                      │
│  • Federated trust scoring                                           │
│  • License/copyright enforcement                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  MARKETPLACE CONSUMPTION:                                            │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ 1. Agent publishes ZK proof of computation integrity          │    │
│  │ 2. Nexus verifies proof → issues trust attestation            │    │
│  │ 3. Marketplace uses attestation for:                          │    │
│  │    • Builder reputation scoring                               │    │
│  │    • SLA bounty adjudication                                  │    │
│  │    • Escrow release gating                                    │    │
│  │    • License fee computation                                  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Integration points:**
- **ZK proof verification**: Nexus v0.4.19 provides proof verification; market consumes trust scores
- **Builder reputation**: ZK-verified computation history → trust-tier pricing
- **SLA enforcement**: Nexus attestations gate escrow release on SLA compliance
- **Status**: Nexus v0.4.19 active. Market→Nexus integration requires trust-tier pricing
  model and attestation-gated escrow logic.

### 3. conxius-enclave-sdk → Market BYOK & Hardware Security

```
┌──────────────────────────────────────────────────────────────────────┐
│  ENCLAVE SDK (BYOK Mandate)                                          │
│  • AWS Nitro TEE attestation                                         │
│  • Android KeyMint/StrongBox                                         │
│  • Durable replay protection                                         │
│  • CCTP / account abstraction fail-closed                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  MARKETPLACE CONSUMPTION:                                            │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ 1. User provisions BYOK via Enclave SDK                       │    │
│  │ 2. Enclave produces TEE attestation + key proof               │    │
│  │ 3. Marketplace verifies attestation before:                   │    │
│  │    • Allowing agent deployment                                │    │
│  │    • Authorizing escrow deposits                              │    │
│  │    • Releasing settlement funds                               │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Integration points:**
- **BYOK provisioning**: Enclave SDK v2.0.12 provides key generation in TEE
- **Attestation gating**: Marketplace requires valid TEE attestation for value-bearing operations
- **Multi-deployment**: Cloud (Nitro), Edge (KeyMint), On-Prem (custom TEE) all supported
- **Status**: Enclave SDK v2.0.12 active, attestation code 2600+ lines. Production provider
  qualification pending (P0 issues #240, #241, #242).

### 4. lib-conxian-core → Market Chain Abstraction

**30+ chain adapters.** Marketplace settlement can route through any supported chain:
Bitcoin, Stacks, Liquid, Rootstock, Babylon, Ethereum, Solana, and 23+ others.

### 5. Conxian/Conxian → Market Smart Contracts

**Protocol contracts for fee collection, escrow, and governance.** Marketplace deploys
market-specific contracts on the Conxian protocol layer.

---

## Expansion Research — Five Horizons

### Horizon 1: Core Settlement (NOW)
- Gateway ISO 20022 / x402 → escrow trigger
- Basic 2% fee distribution (50/30/20)
- Builder registry with basic reputation
- **Dependencies**: Gateway v0.1.4 ✅, escrow contract deployment 🔴

### Horizon 2: Trust & Reputation (3-6 months)
- Nexus ZK proof integration for builder trust scoring
- SLA bounty system with automated adjudication
- Trust-tier pricing: verified builders get lower fees
- **Dependencies**: Nexus v0.4.19 ✅, trust-tier model design 📋

### Horizon 3: BYOK & Sovereignty (6-9 months)
- Mandatory TEE attestation for value-bearing operations
- Full BYOK lifecycle: provision → attest → operate → revoke
- On-Prem deployment lane for enterprise sovereign users
- **Dependencies**: Enclave P0 attestation chain 🔴

### Horizon 4: Federated Agent Network (9-12 months)
- MCP-only handoff standard enforced
- Cross-builder agent composition (multi-agent workflows)
- Federated discovery: agents discover each other across builders
- **Dependencies**: MCP standard ratification, cross-builder auth

### Horizon 5: Global Liquidity (12-18 months)
- Multi-chain settlement via lib-conxian-core adapters
- Cross-chain escrow (ERC-8183 across EVM + Bitcoin L2s)
- Institutional ingress via gateway ISO 20022 production
- **Dependencies**: All above horizons + Gateway production deployment

---

## Ethos Alignment Checklist

| Pillar | Integration Status | Gap |
|--------|-------------------|-----|
| **Sovereign AI (BYOK)** | Enclave SDK provides TEE key gen | Provider qualification pending (P0) |
| **Productive AI** | ERP/ISO 20022/x402 parsers exist | Real-economy modules need builder onboarding |
| **Federated (MCP)** | MCP handoff design documented | Standard ratification + enforcement |
| **Multi-Deployment** | Cloud/Edge/On-Prem architecture defined | On-Prem lane needs deployment guide |
| **DeFi-Agnostic** | 30+ chain adapters in lib-conxian-core | Cross-chain escrow not deployed |

---

## Non-Authorization Boundary

This document defines integration research and architecture. It does not authorize
production action, release, or acceptance. Each integration point requires independent
verification and owner approval.

---

*Governed by [GitHub-first BOS research-cycle operating model](https://github.com/Conxian/conxian-business/blob/dev/docs/GITHUB_FIRST_BOS_OPERATING_MODEL.md).*
