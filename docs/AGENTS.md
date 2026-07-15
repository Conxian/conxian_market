# Conxian Agent Knowledge Base (M2M Induction)

> **Purpose:** Permanent operational memory for AI agents working on the Conxian ecosystem.  
> **Scope:** This file defines the canonical ethos, patterns, and boundaries for all agentic sessions.  
> **Owner:** Conxian Labs | **Version:** 1.0 | **Last Updated:** 2026-07-15

---

## 0. THE CONXIAN UNIFIED THEORY (v2.0)

### Core Equation
```
V_X → Maximize (Execution Velocity)
O_C → Minimize (Operational Cost)
A_S → Maximize (System Autonomy)
```

### Mandates
- **Execution Velocity ($V_X$):** Prioritize AI leverage to crush milestones before $O_C$ exhaustion.
- **System Autonomy ($A_S$):** Minimize manual oversight. Manual intervention is a Phase 3 failure; drive $O_C \to 0$.
- **Zero Secret Egress (ZSE):** No sensitive operational, strategy, or financial material may be tracked in the active Git index.

---

## 1. IDENTITY SPLIT (AUTHORITATIVE)

### Conxian = Protocol / DeFi / DAO-facing
- **Conxian/Conxian:** Protocol core, 218 Clarity smart contracts, mainnet-ready
- **lib-conxian-core:** Shared Rust primitives for chain adapters
- **conxian_market:** Settlement core, marketplace (THIS REPO)

### Conxian-Labs = Builder / Operator / Company
- **conxian-business:** BOS (Business Operations System) - private governance
- **conxius-platform:** CI/CD, orchestration, platform scaffolding
- **conxius-orbit:** Deployment tooling, contract rollout

### Product Naming (Conxius)
- **conxius-wallet:** Sovereign non-custodial wallet (Android-first, v1.9.5)
- **conxius-enclave-sdk:** Hardware enclave SDK (v2.0.12 - Production)

### Infrastructure
- **conxian-gateway:** Rust middleware, ISO 20022, industrial bridge
- **conxian-nexus:** Glass Node, MMR proofs, multi-chain verification
- **conxian_ui:** Public web interface

---

## 2. THE SOVEREIGN PRINCIPLE

### Zero Secret Egress (ZSE)
- No sensitive operational, strategy, or financial material in Git
- Signing keys never stored in plain text or public repos
- Detailed strategy/financials in Linear (private) not Git

### No Personal Dependency After Handoff
- No launch-critical automation may depend on a single personal wallet
- Bootstrap wallet is TEMPORARY only
- All production paths must use SAB-controlled multisigs

### Principals Over Addresses
- All protocol-level recipient logic must use contract principals
- Use role-based principals via `conxian-access`
- Never hardcode personal wallet addresses

---

## 3. WALLET ARCHITECTURE (SAB-Owned Custody)

### Canonical Wallet Classes

| Wallet Class | Type | Custody | Purpose | Spend Limit |
|:--------------|:-----|:--------|:--------|:------------|
| `BOOTSTRAP_OPERATOR_WALLET` | Standard | Operator (TEMP) | Bootstrap deploy only | None after handoff |
| `SAB_DEPLOYER_MULTISIG` | Standard | SAB (3-of-5) | Contract deploys, upgrades | Deploy gas only |
| `SAB_BOS_EXECUTOR_KEY` | Standard | SAB (System) | Keeper ops, automation | Gas buffer only |
| `SAB_PAYOUT_MULTISIG` | Standard | SAB (3-of-5) | Bounties, royalties | Medium, capped |
| `SAB_EMERGENCY_PAUSE_MULTISIG` | Standard | SAB (2-of-3) | Pause/isolate only | None |
| `SAB_EMERGENCY_RECOVERY_MULTISIG` | Standard | SAB (3-of-5) | Unpause, key rotation | None routine |
| `DAO_TIMELOCK` | Contract | DAO | Policy changes, delays | Time-delayed |
| `PROTOCOL_VAULTS` | Contract | System/DAO | Fee/treasury custody | Rules-based |

### Critical Rules
1. **TREASURY-VAULT** = Passive collection ONLY (no outbound)
2. **SAB-TREASURY-MS** = Operational treasury (3-of-5, medium spend)
3. **DAO-TREASURY-MS** = Long-term reserves (5-of-7, high spend)
4. **Emergency** = Pause-only (no unpause, no value transfer)

---

## 4. BOS STAGES (Bootstrap → SAB → DAO)

### Stage 0 — Bootstrap Allowed
- Bootstrap wallet deploys and initializes
- No production automation assumes bootstrap exists

### Stage 1 — Establish SAB Custody
- Create SAB multisigs (3-of-5 preferred)
- Provision SAB_BOS_EXECUTOR_KEY in enclave/HSM

### Stage 2 — Move Admin Surfaces Out
- Transfer contract-owner/admin from bootstrap to SAB
- Set conxian-access roles to SAB authorities

### Stage 3 — Automation Cutover (HARD REQUIREMENT)
- All BOS automation uses SAB_BOS_EXECUTOR_KEY
- **NO** launch-critical path depends on single personal wallet

### Stage 4 — DAO Alignment
- Configure DAO_TIMELOCK
- Transfer policy-critical admin surfaces to timelock

### Stage 5 — Bootstrap Decommission
- Remove bootstrap from all allowlists/roles
- Treat bootstrap key as revoked

---

## 5. AGENT PATTERNS

### MCP (Model Context Protocol)
- All agent handoffs use MCP
- Hub acts as MCP Host coordinating sub-agents
- BYOK mandatory (Bring Your Own Keys)

### ERC-8183 Escrow
- Programmable settlement standard
- Builder protection + User safety
- Yield matrix: 80% Builder / 10% Platform / 10% Stakeholders

### Thin Orchestrator
- Hub manages routing ONLY
- Never perform heavy AI inference on centralized infra
- Push compute to edge/BYOK

### Trust Tiers (CON-791)
- **Strict:** TEE + ZK (Institutional)
- **Standard:** Enclave attestation (Production)
- **Basic:** API key only (Experimental)

---

## 6. ECONOMIC MODEL

### Protocol Fee: 2%
```
50% → Operations (CI/CD, SDKs, Nexus, Audits)
30% → Founders (4-year vesting)
20% → Ecosystem (Grants, Liquidity Mining)
```

### Fee Decay Timeline
| Phase | Duration | Rate |
|:------|:--------:|:----:|
| Launch | 0-12 months | 2.0% |
| Growth | 12-36 months | 1.5% |
| Mature | 36+ months | 1.0% |

### Treasury Allocation
- 40% Stablecoins (USDC, USDT, sBTC)
- 30% RWA (Tokenized T-bills)
- 20% Liquid Staking (ETH, STX)
- 10% Native Token

---

## 7. SETTLEMENT RAILS

### Primary (ALEX/Stacks)
- sBTC/USDC pools for AI labor
- ALEX Launchpad (APower allocation)
- Stacks L2 native settlement

### Secondary (Multi-chain)
- EVM (Uniswap, Aave)
- Fedimint (Federation)
- Citrea (Bitcoin L2)
- Lightning (SRL-1 via Nexus)

### Institutional
- ISO 20022 messaging (Gateway)
- ZK-Compliance proofs
- TEE attestation

---

## 8. DOCUMENTATION STANDARDS

### Zero Secret Egress Compliance
- No signer identities in Git
- No key material in repos
- No concrete wallet principals
- Strategy/financials → Linear (private)

### Hygiene Rules
- No build artifacts in root (`*.log`, `*.txt`, `*.patch`)
- Sensitive paths → `.gitignore` + Linear manifest
- Run `verify_knowledge_retention.py` before commits

### File Naming
- `SAB_WALLET_ARCHITECTURE_AND_CONTROL_MATRIX.md` - Wallet classes
- `SAB_DAO_HANDOFF_PROTOCOL.md` - Handoff stages
- `BOS_WALLET_CONTROL_MODEL.md` - Custody model

---

## 9. REPOSITORY WORKING PATTERNS

### conxian_market (THIS REPO)
- **Role:** The Value Layer - PRIMARY revenue mechanism
- **Ethos:** Settlement core, marketplace, treasury
- **Standards:** MCP-native, ERC-8183, 2% protocol fee
- **Guided by:** FUNDING_AND_ECONOMICS.md, FULL_SYSTEM_ARCHITECTURE.md

### conxian-business (PRIVATE)
- **Role:** CNS - Business Operations System
- **Ethos:** Zero Secret Egress, BOS state machine
- **Contains:** AGENTS.md, wallet architecture, handoff protocols

### conxius-enclave-sdk (Production v2.0.12)
- **Role:** Hardware security primitives
- **Features:** TEE, FROST DKG, BitVM2, MuSig2, BYOK

### conxian-gateway (Active v0.1.4)
- **Role:** Industrial middleware
- **Features:** ISO 20022, Fedimint, Citrea, X402

### conxian-nexus (Active v0.4.19)
- **Role:** Glass Node, verification layer
- **Features:** MMR proofs, multi-chain, SRL-1

---

## 10. KEY TERMINOLOGY

| Term | Definition |
|:-----|:-----------|
| **SAB** | Sovereign Advisory Board - governing entity |
| **BOS** | Business Operations System - orchestration layer |
| **ZSE** | Zero Secret Egress - no secrets in Git |
| **MCP** | Model Context Protocol - agent handoff standard |
| **BYOK** | Bring Your Own Keys - sovereign security |
| **ERC-8183** | Programmable escrow standard |
| **SRL-1** | Simplified Revenue Ledger (Lightning resilience) |
| **MMR** | Merkle Mountain Range - state proofs |
| **TEE** | Trusted Execution Environment |

---

## 11. WORKING RULES FOR AGENTS

### DO
- Read AGENTS.md first at session start
- Check FUNDING_AND_ECONOMICS.md for economic decisions
- Verify all wallet references against SAB architecture
- Follow ZSE compliance (no secrets in Git)
- Use contract principals, not addresses
- Reference Linear for sensitive operational data

### DON'T
- Hardcode personal wallet addresses
- Assume bootstrap wallet is permanent
- Put strategy/financials in Git commits
- Skip ZSE compliance checks
- Pivot from defined economic model
- Create stub documentation without implementation

### ASK FIRST
- Any changes to wallet architecture
- Any treasury-related modifications
- Any secrets or credentials
- Any changes to fee models
- Any governance modifications

---

## 12. RESEARCH DOCUMENT CHAIN

For economic decisions, ALWAYS reference in order:
1. `docs/research/FUNDING_AND_ECONOMICS.md` - Fee model
2. `docs/research/FULL_SYSTEM_ARCHITECTURE.md` - Integration
3. `docs/research/MARKET_UNIFIED_POSITIONING.md` - Enhancement
4. `docs/knowledge_base/operating_manual.md` - Operations
5. `docs/GOVERNANCE.md` - Governance rules
6. `ROADMAP.md` - Current milestones

---

## 13. QUICK REFERENCE

### Economic Model
```
Protocol Fee: 2%
├── 50% → Operations ($X/year based on volume)
├── 30% → Founders (4-year vesting)
└── 20% → Ecosystem (Grants, Liquidity)
```

### Break-Even
```
$240K/year ÷ 0.02 = $12M/year = $33K/day
```

### Treasury Targets
- 12-month runway minimum ($240K)
- 40/30/20/10 asset allocation
- 3-of-5 multisig required

### ALEX Integration
- Primary settlement rail
- sBTC/USDC pools
- APower launchpad allocation

---

**SOVEREIGN. INDUSTRIAL. BTC-NATIVE.**

*"Architecting the rails where the user owns the train."*

---

*This file is the authoritative agent induction document. All agentic sessions must read and adhere to this document before executing work on the Conxian ecosystem.*
