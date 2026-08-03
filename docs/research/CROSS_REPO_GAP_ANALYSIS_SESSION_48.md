# Cross-Repo Gap Analysis — Session 48

> **Generated:** 2026-08-01 | **Repos Audited:** 10 | **Open Issues:** 60 | **Code Gaps:** 23

---

## 1. Severity Summary

| Severity | Count | Repos Affected |
|:--------:|:-----:|:---------------|
| **P0 / Critical** | 8 | enclave-sdk(4), wallet(1), Conxian(1), business(1), platform(1) |
| **P1 / High** | 11 | enclave-sdk(2), gateway(1), Conxian(5), wallet(2), business(1) |
| **P2 / Medium** | 4 | Conxian(2), gateway(2) |
| **Infra/Hygiene** | 37 | All repos — deps, CI/CD, KB, stale branches |

---

## 2. P0 Critical Gaps — Must Resolve Before Mainnet

### 2.1 Enclave SDK: Attestation Chain Incomplete (4 gaps)

| Issue | Gap | Impact |
|:------|:----|:-------|
| [#242](https://github.com/Conxian/conxius-enclave-sdk/issues/242) | AWS Nitro attestation not qualified | No TEE for AWS workloads |
| [#241](https://github.com/Conxian/conxius-enclave-sdk/issues/241) | Android KeyMint/StrongBox not qualified | No TEE for mobile |
| [#240](https://github.com/Conxian/conxius-enclave-sdk/issues/240) | Attestation roots/collateral/revocation not operational | Trust chain can't be verified independently |
| [#198](https://github.com/Conxian/conxius-enclave-sdk/issues/198) | CCTP/AA/asset metadata not fail-closed | Cross-chain asset security gap |

**Impact:** TrustTier Managed and Strict cannot be enforced. The 6-rail settlement layer depends on enclave attestation for Statechain, sBTC, RGB, and Babylon rails. Without these, those rails remain at Expedient tier.

### 2.2 Conxian Main: Developer Sandbox (#480)

| Issue | Gap | Impact |
|:------|:----|:-------|
| [#480](https://github.com/Conxian/Conxian/issues/480) | Developer sandbox TTFV > 15 minutes | No onboarding pipeline for builders |

**Impact:** Without sandbox, the market's Fedimint community pools and builder ecosystem have no dev entry point.

### 2.3 conxius-wallet: Value-Operation Gate (#444)

| Issue | Gap | Impact |
|:------|:----|:-------|
| [#444](https://github.com/Conxian/conxius-wallet/issues/444) | No centralized value-operation gate | Software/synthetic success paths can bypass real value transfer |

**Impact:** Wallet can report success for transactions that never hit the chain. This affects all settlement visibility.

### 2.4 conxian-business: GitHub-First Operating Model (#943)

| Issue | Gap | Impact |
|:------|:----|:-------|
| [#943](https://github.com/Conxian/conxian-business/issues/943) | Linear-first references everywhere | Unclear single-source-of-truth for handoff |

**Impact:** BOS Gates 0–6 depend on this being resolved. Affects all repos.

### 2.5 conxius-platform: CI Validation Scripts (#1082)

| Issue | Gap | Impact |
|:------|:----|:-------|
| [#1082](https://github.com/Conxian/conxius-platform/issues/1082) | Missing CI validation scripts in unified workflow | CI/CD gates can't be enforced autonomously |

**Impact:** BOS Gate 1 (green CI) requires this. Affects all repos using org-wide CI.

---

## 3. P1 High-Priority Gaps — Post-Sandbox Launch

### 3.1 Conxian Main: Partnership Stack (5 gaps)

| Issue | Gap | Dependency |
|:------|:----|:-----------|
| [#527](https://github.com/Conxian/Conxian/issues/527) | Partnership fee policy legal model undecided | Legal review |
| [#488](https://github.com/Conxian/Conxian/issues/488) | 2% protocol fee collection not implemented | CON-1427 |
| [#496](https://github.com/Conxian/Conxian/issues/496) | Partnership fee contracts not deployed | #527, #488 |
| [#532](https://github.com/Conxian/Conxian/issues/532) | Partnership security/legal launch gate incomplete | Legal, compliance |
| [#530](https://github.com/Conxian/Conxian/issues/530) | Partnership gateway SDK + event indexing not done | #527 |

**Impact:** The market's 5-stream revenue model can't collect protocol fees. Break-even analysis ($20K/mo) is theoretical until CON-1427 is live.

### 3.2 Enclave SDK: Code-Quality Gates (2 gaps)

| Issue | Gap | Dependency |
|:------|:----|:-----------|
| [#260](https://github.com/Conxian/conxius-enclave-sdk/issues/260) | FROST statechain crypto gated behind `ProtocolUnsupported` | Audit completion |
| [#200](https://github.com/Conxian/conxius-enclave-sdk/issues/200) | WASM secret boundary not hardened | Architecture review |

**Code evidence:** `src/protocol/statechain.rs:19` — FROST DKG, threshold signing all fail with `ProtocolUnsupported`. `src/protocol/frost.rs:708` — same gate. `src/protocol/bitvm2.rs:637` — same. `src/protocol/ark.rs:525` — same.

### 3.3 Gateway: Adapter Completion (2 gaps)

| Issue | Gap | Status |
|:------|:----|:------|
| [#228](https://github.com/Conxian/conxian-gateway/issues/228) | RGB stash resolver not integrated | Stub exists (rgb_stash.rs), not wired |
| [#222](https://github.com/Conxian/conxian-gateway/issues/222) | CI/CD strict baseline not enforced | Tests failing, no blocking gates |

### 3.4 Conxian Main: Merge Gates (#515)

| Issue | Gap | Impact |
|:------|:----|:-------|
| [#515](https://github.com/Conxian/Conxian/issues/515) | Main branch merge gates not enforced + CODEOWNERS stale | Any PR can merge without review |

---

## 4. P2 Medium-Priority Gaps — Growth Phase

### 4.1 Conxian Main: Production Deployments

| Issue | Gap | Dependency |
|:------|:----|:-----------|
| [#507](https://github.com/Conxian/Conxian/issues/507) | sBTC vault incomplete | DLC CET (#220) + oracle config |
| [#500](https://github.com/Conxian/Conxian/issues/500) | Production oracle source + DEX wiring | Oracle contracts exist but not configured for mainnet |

### 4.2 Gateway: MRR Billing (#306)

| Issue | Gap | Status |
|:------|:----|:------|
| [#306](https://github.com/Conxian/conxian-gateway/issues/306) | P2: MRR/billing module not added | Billing engine exists (362 lines) but MRR tracking missing |

---

## 5. Code-Level Gaps — What Exists But Doesn't Work

### 5.1 Enclave-SDK: Protocol Gates

| Protocol | File | Gate Type | Unblocks |
|:---------|:-----|:----------|:---------|
| Statechain (Spark) | `protocol/statechain.rs` | `ProtocolUnsupported` | FROST DKG, threshold signing for VTXOs |
| BitVM2 | `protocol/bitvm2.rs` | `ProtocolUnsupported` | Optimistic proof verification |
| FROST | `protocol/frost.rs` | `ProtocolUnsupported` | Distributed key generation |
| Ark | `protocol/ark.rs` | `ProtocolUnsupported` | vTXO payment pool forfeiture |
| Fedimint DKG | `protocol/nexus/fedimint.rs` | `ProtocolUnsupported` | Guardian key ceremony |

> **Total gated:** 5 protocol surfaces across 577 lines of statechain struct validation but zero cryptographic execution.

### 5.2 Gateway: Research-Only Adapters

| Feature | File | Status |
|:--------|:-----|:------|
| DLC CET construction | `engine/bitcoin/dlc_oracle.rs` | Oracle stub, no CET path |
| BitVM3 garbled circuits | `engine/bitcoin/bitvm_adapter.rs` | Research only |
| RGB stash resolver | `engine/bitcoin/rgb_stash.rs` | Stub, not wired to issuer policy |
| RGB native | `engine/bitcoin/rgb_native.rs` | Partial, not integrated |
| Citrea adapter | `engine/ntt/citrea_adapter.rs` | Phase 3 placeholder |
| Rootstock adapter | `engine/ntt/rootstock_adapter.rs` | Stub |
| BIP-110 fee market | N/A | Research-phase evaluation only |
| Shadow observation | `engine/bitcoin/shadow_observation.rs` | API-side exists, engine-side not wired |

### 5.3 Conxian Main: Contract Coverage

| Contract | File | Status |
|:---------|:-----|:------|
| sBTC vault | `contracts/sbtc/dlc-manager.clar` | Stub — DLC bond + orchestrator exist, manager incomplete |
| Partnership fees | `contracts/vaults/fee-manager.clar` | Contract exists, not wired to gateway |
| Production oracle | `contracts/oracle/pyth-oracle-v4.clar` | V4 adapter exists, config incomplete |
| Developer sandbox | `gateway/` | TypeScript sandbox exists, no rapid provisioning |

### 5.4 lib-conxian-core: Chain Transport Isolation (#233)

The verifier module directly hardcodes 80+ chain identifiers in cross-chain envelope verification. No capability or provenance adapter layer exists between chain transports and the core verifier.

---

## 6. Infrastructure & Hygiene Gaps (37 total)

### 6.1 CI/CD Blockers

| Repo | Issue | Gap |
|:-----|:------|:----|
| conxius-platform | [#1082](https://github.com/Conxian/conxius-platform/issues/1082) | Missing CI validation scripts |
| conxius-platform | [#854](https://github.com/Conxian/conxius-platform/issues/854) | No org-wide GitHub rulesets |
| conxius-platform | [#958](https://github.com/Conxian/conxius-platform/issues/958) | Auto-merge not enabled |
| conxius-orbit | [#279](https://github.com/Conxian/conxius-orbit/issues/279) | Dependency review not restored |
| conxius-wallet | [#356](https://github.com/Conxian/conxius-wallet/issues/356) | CI/CD baseline not enforced |
| conxian-gateway | [#222](https://github.com/Conxian/conxian-gateway/issues/222) | Strict CI/CD baseline not enforced |

### 6.2 Governance & Policy

| Repo | Issue | Gap |
|:-----|:------|:----|
| conxian-nexus | [#174](https://github.com/Conxian/conxian-nexus/issues/174) | License policy blocked |
| conxian-nexus | [#178](https://github.com/Conxian/conxian-nexus/issues/178) | Gitleaks false positives |
| conxian_market | [#9](https://github.com/Conxian/conxian_market/issues/9) | Repository disposition undecided |
| conxian-business | [#942](https://github.com/Conxian/conxian-business/issues/942) | Nexus licensing decision log |
| Conxian | [#515](https://github.com/Conxian/Conxian/issues/515) | CODEOWNERS stale, no merge gates |

### 6.3 BOS Handoff Gates (0-6)

| Gate | Issue | Status | Blocker |
|:-----|:------|:-------|:--------|
| Gate 0 — Re-baseline | [#932](https://github.com/Conxian/conxian-business/issues/932), [#890](https://github.com/Conxian/conxian-business/issues/890) | In Progress | Linear-to-GitHub migration (#943, #944) |
| Gate 1 — Green CI | [#933](https://github.com/Conxian/conxian-business/issues/933) | In Progress | CI validation scripts (#1082) |
| Gate 2 — Safe authority transfer | [#934](https://github.com/Conxian/conxian-business/issues/934) | Pending | Gate 0 |
| Gate 3 — Testnet rehearsal | [#935](https://github.com/Conxian/conxian-business/issues/935) | Pending | Gates 0-2 |
| Gate 4 — Hardware attestation | [#936](https://github.com/Conxian/conxian-business/issues/936) | Pending | Enclave P0 issues (#240, #241, #242) |
| Gate 5 — Security acceptance | [#937](https://github.com/Conxian/conxian-business/issues/937) | Pending | Security review (#202) |
| Gate 6 — Mainnet handoff | [#938](https://github.com/Conxian/conxian-business/issues/938) | Pending | All above |

---

## 7. Cross-Repo Dependency Graph

```
Gate 0 (re-baseline)
   ├── #943 (Linear→GitHub)
   └── #942 (Nexus licensing)
        └── #174 (license policy)

Gate 1 (green CI)
   └── #1082 (CI scripts)
        └── #854 (rulesets), #958 (auto-merge)

Gate 4 (attestation)
   ├── #240 (attestation roots)
   ├── #241 (KeyMint)
   ├── #242 (Nitrogen)
   └── #198 (CCTP fail-closed)

Protocol Fee (CON-1427)
   ├── #488 (fee collection)
   ├── #496 (partnership fees)
   ├── #532 (legal gate)
   └── #527 (fee policy)

Settlement Rails
   ├── #260 (FROST/Statechain crypto)
   ├── #200 (WASM boundary)
   ├── #228 (RGB stash)
   ├── #507 (sBTC vault)
   └── #220 (DLC CET)
```

---

## 8. Market-Impact Assessment

| Market Capability | Dependency | Status | Risk |
|:------------------|:-----------|:------:|:----:|
| Statechain settlement | enclave-sdk #260 (FROST) | ⛔ Gated | HIGH — VTXO signing blocked |
| sBTC peg settlement | gateway sbtc bridge | ✅ Live | LOW — bridge operational |
| RGB asset settlement | gateway #228 (stash) | ⚠️ Partial | MEDIUM — stash resolver needed |
| Babylon treasury staking | gateway babylon adapter | ✅ Live | LOW — adapter wired |
| Fedimint community pools | gateway fedimint adapter | ✅ Live | LOW — adapter wired |
| Lightning settlement | Nexus adapter | ✅ Live | LOW — SRL-1 operational |
| 4-tier TrustTier pricing | enclave-sdk attestation | ⚠️ Degraded | HIGH — Managed/Strict tiers need P0 fixes |
| CJCS autonomous SLA | sla_bounty_system.md | 🟡 Design | MEDIUM — doc exists, no runtime |
| 5-stream revenue | CON-1427 (#488) | ⛔ Blocked | CRITICAL — no fee collection |
| Developer sandbox | #480 | ⛔ Blocked | HIGH — no builder onboarding |

---

## 9. Recommendation: Critical Path

```
Week 1:  Gate 0 → Gate 1 (#943, #1082)
Week 2:  Enclave P0 (#240, #241, #242) → Gate 4
Week 3:  CON-1427 (#488) → Protocol fees live
Week 4:  Enclave P0 (#198, #202) → Gate 5
Week 5:  Developer sandbox (#480) → Builder onboarding
Week 6+: FROST audit (#260), DLC CET (#220), sBTC vault (#507)
```

> **TL;DR:** 8 P0 gaps. Market's 5-stream revenue model and 4-tier pricing are both gated on P0 enclave attestation + CON-1427 fee collection. Statechain settlement (the most innovative rail) is gated on FROST audit. Without these, the market operates at Expedient tier only — 2 rails (Lightning/Fedimint), flat 2% fee, no institutional differentiation.
