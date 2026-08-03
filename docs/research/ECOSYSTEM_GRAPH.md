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

---

## 7. Per-Repo Needs Analysis — What Each Repo Gets From SDK Alignment

### 🟢 HIGH IMPACT (SDK alignment directly enables or significantly helps)

#### `lib-conxian-core` — THE SDK ALIGNMENT ITSELF
| Dimension | Detail |
|-----------|--------|
| What it does | Canonical shared type system, protocol primitives |
| What SDK alignment delivered | `src/sdk.rs` re-exports all 50 enclave-sdk modules across 6 feature-gated categories; `full-sdk` meta-feature |
| What it still needs | Issue #233 (chain transport adapter isolation); 6 underutilized modules need consumers (`crypto`, `enclave`, `deployment`, `cjcs`, `babylon`, `fedimint`) |
| Next action | Mark `full-sdk` as default feature; create consumer wiring for 6 underutilized modules |

#### `conxian_market` — PRIMARY CONSUMER
| Dimension | Detail |
|-----------|--------|
| What it does | AI labor marketplace, SDK bridge, fee calculation, settlement orchestration |
| What SDK alignment delivered | `ConxianMarketSDK` with 27 capabilities wired through Gateway REST; real verification (not stubs); 8-rail settlement |
| What it still needs | P0-gated capabilities (TEE+ZK verification, Statechain, Ark, DLC CET); RGB adapter (gateway #228); issue #9 (repo disposition governance) |
| Next action | Resolve issue #9 (merge into gateway vs. standalone); add CI/CD baseline; publish npm package |

#### `conxian-gateway` — INFRASTRUCTURE CONSUMER
| Dimension | Detail |
|-----------|--------|
| What it does | Runtime orchestration, REST API (50+ endpoints), 8 settlement rails, billing engine |
| What SDK alignment delivered | Can use `lib-conxian-core = { features = ["full-sdk"] }` instead of separate enclave-sdk dependency; billing.rs wired to ProtocolFeeRecord |
| What it still needs | Issue #228 (RGB stash resolver); #220 (DLC CET construction); #306 (MRR billing tracking); #189 (BitVM3 research); #245 (BIP-110 fee market impact) |
| Next action | Reduce dependency count by switching to `full-sdk`; wire `sdk::cross_cutting::economy` for MRR billing; implement DLC CET path |

#### `conxian-nexus` — VERIFICATION CONSUMER
| Dimension | Detail |
|-----------|--------|
| What it does | Universal chain node & proof layer, observation/sync/verification |
| What SDK alignment delivered | Can access all enclave-sdk modules through lib-conxian-core without direct enclave-sdk dependency; resolves license boundary question for #174 |
| What it still needs | Isuse #174 (license policy blocked); attestation types should upgrade from X.509 stubs to `sdk::enclave_sdk::attestation`; 5 of 17 core modules not yet consumed |
| Next action | Switch to `full-sdk` feature; add enclave attestation verifier using `sdk::enclave_sdk::attestation`; resolve license boundary |

#### `conxian-business` — GOVERNANCE
| Dimension | Detail |
|-----------|--------|
| What it does | BOS handoff gates 0-6, strategic/legal/operational documents |
| What SDK alignment delivered | Single audit surface for enclave capabilities via `sdk::enclave_sdk::*` re-exports; simplifies Gates 4-6 attestation verification chain |
| What it still needs | Gates 0-6 progression; enclave-sdk P0 attestation issues must be resolved before Gate 4 (HW attestation); issue #943 (Linear→GitHub migration) |
| Next action | Update gate documents to reference the single `full-sdk` attestation path; add SDK alignment as a Gate 0 checkpoint |

#### `Conxian/Conxian` — SMART CONTRACTS
| Dimension | Detail |
|-----------|--------|
| What it does | 218 Clarity contracts: protocol primitives, DeFi logic, DAO governance, fee collection |
| What SDK alignment delivered | Type system + fee logic (Phase A+B); ProtocolFeeRecord type and fee calculation ready for contract wire-up |
| What it still needs | Issue #488 (2% fee collection — deploy `fee-manager.clar`); #496 (partnership fee contracts); #480 (dev sandbox P0); testnet deploy keys |
| Next action | Deploy `fee-manager.clar` on testnet; wire to gateway billing endpoint; create `fee-orchestrator.clar` for 50/30/20 split |

#### `conxius-orbit` — DEPLOYMENT CLI
| Dimension | Detail |
|-----------|--------|
| What it does | CLI for deploying Stacks contracts, builder toolkit |
| What SDK alignment delivered | Makes `contract_bridge` and `deployment` types from lib-conxian-core accessible; enables planned integrations that have been documented but not implemented |
| What it still needs | Issue #279 (dependency review not restored); consume `contract_bridge` (ClarityCall, ContractBridge, SignedContractCall); consume `DeploymentPlan` |
| Next action | Add `lib-conxian-core` dependency; integrate `contract_bridge` for typed principal deployment; wire `DeploymentPlan` for deploy orchestration |

### 🟡 INDIRECT IMPACT (SDK alignment simplifies but doesn't directly change)

#### `.github` — ORG-WIDE POLICY
- **What SDK alignment does:** Simplifies CI dependency graph — one source of truth for SDK types means fewer CI verification targets
- **Next action:** Update CODEOWNERS and workflow templates to reflect single `full-sdk` dependency path

#### `conxius-platform` — CI/CD SCAFFOLDING
- **What SDK alignment does:** Makes CI validation simpler — scripts verify `lib-conxian-core` with `full-sdk` instead of checking both crates independently
- **Next action:** Write CI validation script for `full-sdk` feature; add org-wide GitHub ruleset for SDK dependency paths

#### `conxius-wallet` — SOVEREIGN WALLET
- **What SDK alignment does:** Wallet uses enclave-sdk directly for signing — SDK alignment matters only for control_model types. The `sdk::enclave_sdk::replay_guard` provides primitives to help fix issue #444 (value-op gate)
- **Next action:** Investigate using `sdk::enclave_sdk::replay_guard` for settlement verification in the value-op gate

#### `demo-repository` — BUILDER TEMPLATE
- **What SDK alignment does:** If used as a builder onboarding template, should reference `lib-conxian-core` with `full-sdk` instead of direct enclave-sdk dependency
- **Next action:** Update template to use canonical `full-sdk` path

### ⚪ NO IMPACT (Not relevant to SDK alignment)

- **`conxian_ui`** — Frontend that talks to gateway's HTTP API. No SDK types consumed.
- **`conxian-labs-site`** — Static marketing site. Zero code dependencies.
- **`conxian.github.io`** — GitHub Pages documentation. No SDK relevance.
- **`.github-private`** — Secrets/config store. No relevance.

---

## 8. Remaining Gaps — What's Still Blocked

### Enclave-SDK P0 Attestation (5 issues → blocks 4 repos)

| Issue | Blocks | Revenue Impact |
|-------|--------|:-------------:|
| #240 Attestation roots + revocation | lib-core, gateway, nexus, market | Managed/Strict tiers |
| #241 Android KeyMint qualification | wallet, enclave-sdk | Mobile attestation |
| #242 AWS Nitro attestation | gateway, nexus | Cloud TEE |
| #198 CCTP fail-closed | gateway, Conxian | Cross-chain security |
| #202 Security review acceptance | ALL repos | Production deploy gate |

### Contract Deployment Gaps (4 issues → blocks 3 repos)

| Issue | Blocks | Revenue Impact |
|-------|--------|:-------------:|
| #488 2% Protocol Fee Collection | Conxian | $15K/mo |
| #496 Partnership Fee Contracts | Conxian | $3K/mo |
| #529 Partner usage ledger | Conxian, gateway | $2K/mo |
| #480 Dev sandbox | Conxian | Builder onboarding |

### Gateway Implementation Gaps (5 issues → blocks 2 repos)

| Issue | Blocks | Feature |
|-------|--------|---------|
| #228 RGB stash resolver | gateway, market | RGB rail |
| #220 DLC CET construction | gateway, market | Prediction markets |
| #306 MRR billing | gateway | Revenue tracking |
| #189 BitVM3 adapter | gateway, nexus | Recursive proof verification |
| #245 BIP-110 fee market impact | gateway | Fee optimization |

### Governance & CI Gaps (7 issues → blocks all repos)

| Issue | Repo | Type |
|-------|------|------|
| #43 Operating model alignment | .github | Org-wide |
| #47 Security boundary verification | .github | Security |
| #53 Repo presentation metadata | .github | Presentation |
| #174 License policy | nexus | Legal |
| #1082 CI validation scripts | platform | CI/CD |
| #854 GitHub rulesets | platform | CI/CD |
| #444 Wallet value-op gate | wallet | Security |

---

## 9. Consumer Wiring — Current vs. Target

| Consumer | Current SDK Path | Target SDK Path | Effort |
|----------|:----------------:|:---------------:|:------:|
| lib-conxian-core | 5 types via `enclave` feature | 50 modules via `full-sdk` | ✅ Done |
| conxian_market | Fee calculator only | ConxianMarketSDK (27 caps) | ✅ Done |
| conxian-gateway | Separate enclave-sdk dep | `full-sdk` on lib-core | S — switch dep |
| conxian-nexus | 12/17 core modules, no enclave | `full-sdk` + attestation | M — add attestation |
| Conxian/Conxian | No SDK dep | Market SDK for fee types | L — deploy contracts |
| conxius-orbit | No core dep | contract_bridge + deployment | M — add dep + wire |
| conxius-wallet | Direct enclave-sdk | Keep direct + replay_guard | S — investigate |
| conxius-platform | No SDK dep | CI validation of full-sdk | S — add CI check |
| conxian_ui | No SDK dep | Optional: npm SDK pkg | S — optional |
| conxian-business | No SDK dep | Reference full-sdk path | S — docs update |
