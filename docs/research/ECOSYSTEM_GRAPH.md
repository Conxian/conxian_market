# Conxian Ecosystem — Full Dependency & Capability Graph

> **Version:** 1.0 | **Session:** 52 | **Date:** 2026-08-03
> **Purpose:** Single-source graph of all 16 repos, 55 open issues, cross-repo dependencies, and phased implementation roadmap.

---

## 1. Repository Inventory & Dependency Graph

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CONXIAN ECOSYSTEM GRAPH                                │
│                                                                               │
│  LAYER 0 — GOVERNANCE                                                        │
│  ┌──────────────────┐  ┌──────────────────────┐                              │
│  │  conxian-business  │  │  .github (public)    │                              │
│  │  (BOS Gates 0-6)  │  │  (Org-wide policy)   │                              │
│  │  9 open issues     │  │  4 open issues        │                              │
│  └────────┬──────────┘  └──────────┬───────────┘                              │
│           │                        │                                           │
│  LAYER 1 — CORE PRIMITIVES                                                    │
│  ┌──────────────────┐  ┌──────────────────────┐                              │
│  │ lib-conxian-core  │◄─│ conxius-enclave-sdk   │                              │
│  │ (Shared types)    │  │ (HW enclave, 50 mods) │                              │
│  │ 2 open issues      │  │ 9 open issues (5 P0)  │                              │
│  └────────┬──────────┘  └──────────┬───────────┘                              │
│           │                        │                                           │
│  LAYER 2 — INFRASTRUCTURE                                                      │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ conxian-gateway   │  │  conxian-nexus       │  │  conxius-platform     │    │
│  │ (Middleware/REST) │  │  (Glass Node/proofs) │  │  (CI/CD, scaffold)   │    │
│  │ 5 open issues      │  │  3 open issues       │  │  6 open issues        │    │
│  └────────┬──────────┘  └──────────┬───────────┘  └──────────┬───────────┘    │
│           │                        │                           │                │
│  LAYER 3 — PROTOCOL & VALUE                                                    │
│  ┌──────────────────┐  ┌──────────────────────┐                              │
│  │    Conxian        │  │   conxian_market      │                              │
│  │  (218 contracts)  │  │  (SDK bridge/fees)   │                              │
│  │  9 open issues     │  │  1 open issue         │                              │
│  └────────┬──────────┘  └──────────┬───────────┘                              │
│           │                        │                                           │
│  LAYER 4 — USER SURFACE                                                        │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ conxius-wallet    │  │   conxian_ui         │  │ conxian-labs-site    │    │
│  │ (Android wallet)  │  │  (Web frontend)      │  │ (Public website)     │    │
│  │ 3 open issues      │  │  1 open issue        │  │  0 open issues       │    │
│  └──────────────────┘  └──────────────────────┘  └──────────────────────┘    │
│                                                                               │
│  LAYER 5 — TOOLING                                                             │
│  ┌──────────────────┐  ┌──────────────────────┐                              │
│  │ conxius-orbit     │  │ conxian.github.io    │                              │
│  │ (Deploy toolkit)  │  │ (Pages site)         │                              │
│  │ 2 open issues      │  │ 1 open issue         │                              │
│  └──────────────────┘  └──────────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Dependency Matrix

| Consumer → | gateway | nexus | platform | wallet | Conxian | market | orbit | ui |
|-----------|:-------:|:-----:|:--------:|:------:|:-------:|:------:|:-----:|:--:|
| **lib-conxian-core** | ✅ | ✅ | — | — | — | ✅ TS | ✅ | — |
| **enclave-sdk** | ✅ enclave | ✅ attest | ✅ CI | ✅ | — | ✅ bridge | — | — |
| **gateway** | — | ✅ proof | — | — | ✅ contract | ✅ REST | — | — |
| **nexus** | ← proof | — | — | — | — | — | — | — |
| **business** | BOS | BOS | BOS | BOS | BOS | BOS | BOS | BOS |

---

## 2. Issue Heatmap (55 Open Issues)

### P0 / Priority-Critical (14 issues)

| # | Repo | Title | Blocks |
|---|------|-------|--------|
| 240 | enclave-sdk | Attestation roots + revocation | Managed/Strict tiers |
| 241 | enclave-sdk | Android KeyMint qualification | Mobile attestation |
| 242 | enclave-sdk | AWS Nitro attestation | Cloud TEE |
| 198 | enclave-sdk | CCTP fail-closed | Cross-chain security |
| 202 | enclave-sdk | Security review + release evidence | Production deploy |
| 488 | Conxian | 2% Protocol Fee Collection | Revenue |
| 496 | Conxian | Partnership Fee Contracts | Revenue split |
| 890 | business | BOS Gate 0: SAB handoff re-baseline | Mainnet launch |
| 934 | business | BOS Gate 2: Authority transfer | Mainnet launch |
| 935 | business | BOS Gate 3: Testnet rehearsal | Mainnet launch |
| 936 | business | BOS Gate 4: HW attestation | Mainnet launch |
| 937 | business | BOS Gate 5: Security acceptance | Mainnet launch |
| 938 | business | BOS Gate 6: Mainnet handoff | Mainnet launch |
| 444 | wallet | Value-op gate | Settlement verification |

### Escalated / Blocked (7 issues)

| # | Repo | Title |
|---|------|-------|
| 43 | .github | Org-wide operating model alignment |
| 47 | .github | Security boundary verification |
| 53 | .github | Repository presentation metadata |
| 174 | nexus | License policy restoration |
| 189 | gateway | BitVM3 adapter (research) |
| 220 | gateway | DLC CET construction |
| 233 | lib-conxian-core | Chain transport adapter isolation |

### Revenue / Economics (10 issues)

| # | Repo | Title | Revenue Impact |
|---|------|-------|:-------------:|
| 488 | Conxian | 2% Protocol Fee Collection | 71% of $21.1K |
| 496 | Conxian | Partnership Fee Contracts | 15% |
| 529 | Conxian | Partner usage ledger + split settlement | 10% |
| 500 | Conxian | Oracle source + DEX wiring | Infrastructure |
| 8 | market | Treasury dashboard | Reporting |
| 1167 | platform | Protocol handoff routing alignment | Operations |
| 1168 | platform | Founder rights + revenue routing | Legal |
| 189 | gateway | BitVM3 adapter | Future |
| 220 | gateway | DLC CET | Future |
| 245 | gateway | BIP-110 fee market impact | Future |

---

## 3. Cross-Repo Dependency Chains

### Chain A: Attestation → TrustTier → Revenue
```
enclave-sdk #240,#241,#242 (attestation roots)
  └─► lib-conxian-core (TrustTier, control_model)
       └─► conxian_market (fee_calculator.ts: Managed/Strict tiers)
            └─► Conxian #488 (2% fee collection)
                 └─► Revenue: $21.1K/mo target
```
**Status:** 🔒 Blocked on 3 P0 attestation issues. Current: Expedient-only ($1,500/mo).

### Chain B: BOS Handoff → Mainnet Launch
```
conxian-business Gate 0 (SAB re-baseline)
  └─► Gate 2 (authority transfer)
       └─► Gate 3 (testnet rehearsal)
            └─► Gate 4 (HW attestation ← depends on enclave-sdk P0s)
                 └─► Gate 5 (security acceptance)
                      └─► Gate 6 (mainnet handoff)
```
**Status:** 🔴 Gate 0-3 blocked on org-wide alignment. Gates 4-6 blocked on enclave-sdk P0s.

### Chain C: SDK → Gateway → Settlement
```
lib-conxian-core (v0.3.1, 50 SDK modules) ✅ Session 52
  └─► conxian-gateway (billing.rs, REST API) ✅ Phase A+B
       └─► Conxian (Clarity contracts) ⬜ Phase C
            └─► conxian_market (SDK bridge) ✅ Session 52
```
**Status:** ✅ Core + Gateway + Market wired. ⬜ Contract activation pending.

### Chain D: Protocol Fee → Treasury
```
conxian_market (fee_calculator.ts)
  └─► gateway (billing.rs: ProtocolFeeRecord)
       └─► Conxian #488 (fee-manager.clar)
            └─► Conxian #496 (fee-orchestrator.clar: 50/30/20 split)
                 └─► Treasury (Babylon staking)
```
**Status:** ⚠️ Phase A+B done. Phase C blocked on testnet deploy keys.

---

## 4. Capability Coverage Matrix

### SDK Module → Consumer Coverage

| SDK Module | lib-core | gateway | nexus | market | wallet | platform |
|-----------|:--------:|:-------:|:-----:|:------:|:------:|:--------:|
| bitcoin/taproot/bip322 | ✅ core | ✅ | ✅ | ✅ bridge | ✅ | — |
| lightning | ✅ core | ✅ SRL-1 | ✅ adapter | ✅ bridge | ✅ LND | — |
| stacks/sBTC | ✅ core | ✅ bridge | ✅ | ✅ bridge | — | ✅ orbit |
| rgb | ✅ core | ⚠️ #228 | — | ⚠️ stub | — | — |
| babylon | ✅ core | ✅ adapter | — | ✅ bridge | — | — |
| fedimint | ✅ core | ✅ adapter | — | ✅ bridge | — | — |
| dlc | ✅ core | 🟡 stub | — | ⚠️ CET stub | — | — |
| frost/musig2 | ✅ core | ✅ muSig2 | — | ⚠️ muSig2-only | ✅ | — |
| statechain | ✅ sdk | 🔒 gate | — | 🔒 gate | — | — |
| ark | ✅ sdk | 🔒 gate | — | 🔒 gate | — | — |
| bitvm/bitvm2 | ✅ sdk | 🔬 research | — | 🔒 gate | — | — |
| cctp | ✅ sdk | — | — | — | — | — |
| ethereum/solana | ✅ sdk | ⚠️ stub | — | ✅ bridge | — | — |
| covenant | ✅ core | — | — | — | — | — |
| intent | ✅ sdk | — | — | ✅ bridge | — | — |
| settlement/solver | ✅ sdk | ✅ settle | — | ✅ bridge | — | — |
| swap_router | ✅ sdk | ✅ ALEX | — | ✅ bridge | — | — |
| economy/M2M | ✅ sdk | ✅ M2M | — | ✅ bridge | — | — |
| identity | ✅ sdk | ✅ resolve | — | ✅ bridge | ✅ DID | — |
| job_card | ✅ sdk | ✅ bounty | — | ✅ bridge | — | ✅ CJCS |
| zkml | ✅ sdk | — | — | ✅ bridge | — | — |
| opportunity | ✅ sdk | — | — | ✅ bridge | — | — |
| credit | ✅ sdk | — | — | ✅ bridge | — | — |
| sidl | ✅ sdk | ✅ prep | — | ✅ bridge | — | — |
| bisq/boltz/changelly | ✅ sdk | — | — | — | ✅ | — |
| wormhole/ntt | ✅ sdk | ⚠️ stub | — | — | — | — |
| x402 | ✅ sdk | ✅ filter | — | — | — | — |
| config/state/telemetry | ✅ sdk | ✅ | ✅ | ✅ | — | ✅ |

**Legend:** ✅ = production | ⚠️ = partial/stub | 🟡 = stub | 🔬 = research | 🔒 = gated | — = not consumed

---

## 5. Phased Implementation Roadmap

### Phase 0 — Foundation (COMPLETE ✅)
| Task | Status |
|------|:------:|
| lib-conxian-core re-exports all 50 SDK modules | ✅ PR #241 |
| conxian_market SDK bridge (27 capabilities) | ✅ PR #22 |
| ADR-001 fee model resolution | ✅ PR #21 |
| Gateway billing.rs + REST API | ✅ |
| FUNDING_AND_ECONOMICS.md complete | ✅ |

### Phase 1 — Attestation Unlock (ENCLAVE-SDK P0s)
| Issue | Priority | Effort |
|-------|:--------:|:------:|
| #240 Attestation roots + revocation | 🔴 P0 | M |
| #241 Android KeyMint | 🔴 P0 | M |
| #242 AWS Nitro attestation | 🔴 P0 | M |
| #198 CCTP fail-closed | 🔴 P0 | L |
| #202 Security review acceptance | 🔴 P0 | L |

**Unlocks:** Managed + Strict TrustTiers, Premium surcharge revenue (+$5K/mo)

### Phase 2 — Protocol Fee Activation (CON-1427)
| Issue | Priority | Effort |
|-------|:--------:|:------:|
| #488 2% Protocol Fee Collection | 🔴 P0 | L |
| #496 Partnership Fee Contracts | 🟠 P1 | M |
| #529 Partner usage ledger + split settlement | 🟠 P1 | M |
| #500 Oracle source + DEX wiring | 🟡 P2 | M |

**Unlocks:** 71% of $21.1K/mo revenue ($15K/mo)

### Phase 3 — Gateway Hardening
| Issue | Priority | Effort |
|-------|:--------:|:------:|
| #228 RGB stash → issuer policy | 🟠 P1 | M |
| #220 DLC CET construction | 🟠 P1 | L |
| #245 BIP-110 fee market impact | 🟡 P2 | M |
| #189 BitVM3 adapter | 🟡 P2 | XL |
| #233 Chain transport adapter isolation | 🟡 P2 | L |

**Unlocks:** Full 8-rail settlement, DLC prediction markets

### Phase 4 — BOS Handoff → Mainnet
| Issue | Priority | Effort |
|-------|:--------:|:------:|
| #890 Gate 0: SAB re-baseline | 🔴 P0 | L |
| #934 Gate 2: Authority transfer | 🔴 P0 | L |
| #935 Gate 3: Testnet rehearsal | 🔴 P0 | L |
| #936 Gate 4: HW attestation | 🔴 P0 | M |
| #937 Gate 5: Security acceptance | 🔴 P0 | L |
| #938 Gate 6: Mainnet handoff | 🔴 P0 | M |

**Unlocks:** Mainnet launch with full custody

### Phase 5 — Org-Wide Alignment
| Issue | Priority | Effort |
|-------|:--------:|:------:|
| #43 GitHub operating model | 🟠 P1 | L |
| #47 Security boundary verification | 🟠 P1 | M |
| #53 Repository presentation metadata | 🟡 P2 | S |
| #174 License policy restoration | 🟠 P1 | S |
| #1167 Protocol handoff routing | 🟠 P1 | L |
| #1168 Founder rights + revenue routing | 🟠 P1 | M |
| #444 Wallet value-op gate | 🔴 P0 | M |
| #233 Core chain transport isolation | 🟡 P2 | L |

---

## 6. Revenue Impact by Phase

| Phase | What Unlocks | Monthly Revenue | % Target |
|:-----:|-------------|:--------------:|:--------:|
| **Now** | Expedient-only (Fedimint + Babylon) | $1,500 | 7% |
| **Phase 1** | +Managed tier (attestation) | $6,500 | 31% |
| **Phase 2** | +Protocol fee (CON-1427) | $21,100 | 100% |
| **Phase 3** | +Full 8-rail settlement | $25,000+ | 118% |
| **Phase 4** | Mainnet launch | $50,000+ | 237% |
| **Phase 5** | Org-wide optimization | $100,000+ | 474% |

---

*This graph is the authoritative cross-repo reference. Update on each phase completion.*
