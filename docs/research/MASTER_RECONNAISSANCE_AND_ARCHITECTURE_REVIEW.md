# Master Reconnaissance & Architecture Review

> **Conxian Deep-Tech B2B Infrastructure Architecture Report**
> **Lead Systems Engineer Review — Session 64**
> **Generated:** 2026-09-16 | **Status:** Active Canonical Baseline

---

## 1. Executive Summary & Architectural Firewall Doctrine

Conxian is a pure **Deep-Tech B2B infrastructure vendor** specializing in hardware-secured, memory-safe sovereign infrastructure for Bitcoin L1, legacy banking (ISO 20022), and AI settlement.

Conxian **does NOT operate public DeFi protocols** or custody user funds. We license stateless container images and hardware execution parameters for enterprise clients to run entirely within their private clouds or hardware enclaves.

### Strict Domain Separation & Routing Firewall
Conxian maintains a strict legal and architectural firewall between the open-source protocol distribution surface and the corporate business entity.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STRICT DOMAIN ROUTING FIREWALL                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PROTOCOL & DEV SURFACE (conxian.org) - Pure Technical Distribution         │
│  ├── conxian-nexus        ──> nexus.conxian.org                             │
│  ├── conxian-gateway      ──> gateway.conxian.org                           │
│  ├── conxius-enclave-sdk  ──> sdk.conxian.org                               │
│  ├── conxius-platform     ──> platform.conxian.org                          │
│  └── conxian_market       ──> market.conxian.org                            │
│                                                                             │
│  CORPORATE & GOVERNANCE SURFACE (conxian-labs.com) - Sales, Legal & B2B BOS │
│  ├── conxian-business     ──> bos.conxian-labs.com                          │
│  └── conxian-labs-site    ──> www.conxian-labs.com                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Repository Sync & Initialization Baseline

- Organization repository sync verified via `git fetch --all -p` and `git submodule update --init --recursive`.
- Baseline index established across all core repositories:

| # | Repository | Surface / Domain | Role & Baseline Status |
|:---|:---|:---|:---|
| 1 | `lib-conxian-core` | `conxian.org` | Core Rust primitives: `TrustTier`, `SettlementRail`, `ChainId`, control model. |
| 2 | `conxian-nexus` | `nexus.conxian.org` | Glass Node state attestation, SPV/MMR proof verifier. |
| 3 | `conxian-gateway` | `gateway.conxian.org` | REST/gRPC Gateway, CON-1427 fee billing bridge, NTT relay. |
| 4 | `conxius-enclave-sdk` | `sdk.conxian.org` | Hardware enclave SDK: AWS Nitro, Android KeyMint, CCTP, FROST, DLC. |
| 5 | `conxius-platform` | `platform.conxian.org` | Control plane, CI/CD pipelines, release rulesets. |
| 6 | `conxius-wallet` | `conxian.org` | Non-custodial SAB multisig wallet, value-operation safety gate. |
| 7 | `conxian-business` | `bos.conxian-labs.com` | Commercial Operating System, 80/10/10 yield matrix, B2B sales portal. |
| 8 | `conxian_market` | `market.conxian.org` | Value layer, settlement orchestration, SLA engine, client installer (`@conxian/market-sdk`). |
| 9 | `conxian-labs-site` | `www.conxian-labs.com` | B2B corporate portal and executive presentation surface. |
| 10 | `conxian-docs` | `conxian.org` | Ecosystem technical documentation and research archive. |
| 11 | `conxian-ai` | `conxian.org` | Edge AI inference, BYO LLM provider integration, MultiversX AI skills. |
| 12 | `Conxian` | Archived Reference | Legacy smart contract monorepo; frozen and deprecated in favor of `@conxian/market-sdk`. |

---

## 3. Phase 2: Org-Wide Platform Review & Primitive Dependency Mapping

### Architectural Mapping
- `conxius-platform` manages control plane pipelines and deployment automation.
- Rust primitives in `lib-conxian-core` and `conxius-enclave-sdk` provide strict, memory-safe type definitions for `TrustTier`, `SettlementRail`, and hardware attestation certificates.
- `conxian-gateway` consumes Rust primitives and exposes REST/gRPC endpoints consumed by `@conxian/market-sdk`.

### Purged & Deprecated Dependencies
- **Purged Monorepo Contracts**: On-chain Solidity/Clarity smart contract monorepo (`Conxian/Conxian`) is deprecated and frozen.
- **BYO DeFi Protocol Adapters**: Value orchestration is entirely handled by `MarketAgnosticRouter` using external BYO protocols (ERC-8183, ALEX Stacks, Citrea, Lightning, Statechain Spark).

---

## 4. Phase 3: B2B Client Deployment Simulation

### Enterprise Installation Journey
1. **Purchase & Licensing**: Enterprise client purchases execution rights at `bos.conxian-labs.com`. Client pulls stateless container images from `market.conxian.org` and `sdk.conxian.org`.
2. **Environment Configuration (`.env`)**:
   ```env
   CONXIAN_GATEWAY_URL=https://gateway.conxian.org
   CONXIAN_NEXUS_URL=https://nexus.conxian.org
   CONXIAN_SETTLEMENT_RAIL=EVM_ERC8183
   CONXIAN_TRUST_TIER=STRICT
   CLIENT_DID=did:conxian:org:enterprise-001
   BYO_DEEPSEEK_API_KEY=sk-ds-isolated-local-key
   ISO20022_GATEWAY_ENDPOINT=https://swift.internal.bank/mx-bridge
   ```
3. **ISO 20022 Banking to Bitcoin L1 Flow**:
   - ISO 20022 MX message ingested -> Gateway generates CJCS Job Card.
   - Job Card routed to Enclave -> Nexus Glass Node verifies Nitro/KeyMint attestation.
   - Non-custodial settlement executed across specified rail (Bitcoin L1, sBTC, Lightning, ERC-8183).
4. **Installer Efficacy**:
   - `@conxian/market-sdk` provides `ClientInstallerEngine.runUnifiedInstallerCli()`, which verifies license entitlements, aligns deployment manifests, probes asset connectivity, enforces the domain routing firewall, and audits zero-custody compliance prior to container spin-up.

---

## 5. Phase 4: Issue Mapping & Scored Gap Analysis

### Canonical Gap Scoring Table (Security > Enterprise Routing > UI/UX)

| Gap ID | Repository | Category | Score (100) | Description | Recommended Action |
|:---|:---|:---|:---:|:---|:---|
| **P0-1** | `conxius-enclave-sdk#242` | Security | **99** | AWS Nitro enclave attestation document validation gap | Complete Nitro root cert validation in Rust enclave SDK |
| **P0-2** | `conxius-enclave-sdk#241` | Security | **98** | Android KeyMint hardware attestation root verifier gap | Integrate KeyMint root cert chain verifier |
| **P0-3** | `conxius-enclave-sdk#240` | Security | **97** | Root of trust certificate chain verifier for Strict tier | Implement trusted root CA store in enclave SDK |
| **P0-4** | `conxius-enclave-sdk#198` | Security | **96** | CCTP fail-closed enforcement under network partition | Enforce fail-closed guard in Gateway settlement bridge |
| **B2B-1** | `conxian_market` | Enterprise Routing | **95** | Domain routing firewall validation for B2B client onboarding | **COMPLETED in Session 64 (`src/client_onboarding.ts`)** |
| **B2B-2** | `conxius-platform#1082` | Enterprise Routing | **92** | Org-wide CI ruleset & green build gate enforcement | Standardize GitHub Actions CI across all org repos |
| **WAL-1** | `conxius-wallet#444` | Security | **90** | Wallet value-op safety gate & SAB multisig verification | Enforce SAB 3-of-5 multisig check on high-value settlements |
| **BOS-1** | `conxian-business#989` | UI/UX & Governance | **85** | Commercial BOS entitlement license portal | Wire `ClientEntitlementLicense` into `bos.conxian-labs.com` portal |

---

## 6. Phase 5: End-to-End Cycle Maintenance & Next Immediate Tasks

### State Updates Completed
- Code implementation updated in `@conxian/market-sdk` (`src/client_onboarding.ts`, `src/core_types.ts`, `src/sdk_bridge.ts`).
- Verified with 115 passing unit tests (`npx vitest run`).
- `docs/IMPLEMENTATION_TRACKER.md` and `ROADMAP.md` updated for Session 64.

### Next Immediate Code-Generation Tasks (Session 65 Focus)
1. **Upstream Enclave SDK Nitro Cert Verification (`conxius-enclave-sdk#242`)**: Resolve Nitro root cert gap to enable native Strict tier promotion without degradation.
2. **ISO 20022 Parser & CJCS Job Card Generator**: Build ISO 20022 MX message parser in `conxian-gateway` for automated banking settlement card creation.
3. **Org-Wide CI Enforcement (`conxius-platform#1082`)**: Finalize unified CI ruleset across all organizational repositories.

---
*Report authorized by Lead Systems Engineer for Conxian Ecosystem.*
