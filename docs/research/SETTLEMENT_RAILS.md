# Conxian Market: Settlement Rails Catalog

> **Status:** Active | **Version:** 1.0 | **Last Updated:** 2026-08-01 (Session 48)
> **Purpose:** Canonical reference for every settlement rail available to the Conxian market layer.

---

## 1. Rail Overview

| # | Rail | Protocol | Trust Tier | Settlement Type | Fee Model | Status |
|---|------|----------|:----------:|----------------|-----------|:------:|
| 1 | **Statechain (Spark)** | Spark VTXO | T2 Managed | Off-chain BTC transfer | VTXO transfer fee + L1 withdrawal | ✅ v2.0.12 |
| 2 | **sBTC (Stacks)** | Stacks L2 | T2 Managed | BTC peg-in/peg-out | 0% rail fee (protocol 2% only) | ✅ Wired |
| 3 | **RGB** | RGB L2/L3 | T2 Managed | Contract-backed asset | 2% protocol fee | ✅ Wired |
| 4 | **Babylon** | BTC staking | T2 Managed | Staking yield | Babylon protocol fee + market 0.5% | ✅ Wired |
| 5 | **Fedimint** | Federation | T1 Expedient | E-cash settlement | Mint fee (community-set) + market 1% | ✅ Wired |
| 6 | **Lightning** | LN (SRL-1) | T1 Expedient | Instant micropayments | LN routing fee + market 1% | ✅ Wired |
| 7 | **ALEX/Stacks** | Stacks L2 | T1 Expedient | AMM swap settlement | ALEX pool fee + protocol 2% | ✅ Active |
| 8 | **EVM (ERC-8183)** | Ethereum/L2s | T1 Expedient | Programmable escrow | Gas + protocol 2% | ✅ Active |

---

## 2. Statechain (Spark) — Off-Chain VTXO Settlement

### 2.1 Protocol Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    STATECHAIN VTXO LIFECYCLE                      │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │ DEPOSIT  │───▶│  TRANSFER    │───▶│  WITHDRAW    │            │
│  │ BTC→VTXO │    │ Owner→Owner  │    │ VTXO→BTC L1  │            │
│  └──────────┘    └──────────────┘    └──────────────┘            │
│       │                │                     │                    │
│       ▼                ▼                     ▼                    │
│  User+SE key      New owner key       On-chain settlement         │
│  2-of-2 MuSig2    Old shares burned   Timelock expiry             │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Trust Model

- **2-of-2 signing**: User key + Spark Entity (FROST threshold among n operators)
- **1-of-n trust**: As long as one SE operator behaves honestly, funds are secure
- **Forfeit mechanism**: Backup exit transactions with decrementing timelocks
- **Leaf architecture**: vUTXO tree for arbitrary-amount transfers

### 2.3 Fee Structure

| Operation | Fee | Recipient |
|-----------|----:|-----------|
| VTXO creation (deposit) | 0.1% of amount | Spark Entity operators |
| VTXO transfer (owner change) | Flat 100 sats | Spark Entity operators |
| VTXO withdrawal (to L1) | Bitcoin mining fee | Bitcoin miners |
| Market protocol fee | 2% of settlement | Conxian treasury |

### 2.4 Market Integration

**Use case**: AI agent-to-agent micropayments without on-chain fees.

```
Builder completes AI task
       │
       ▼
Market creates VTXO for settlement amount
       │
       ▼
VTXO transferred to Builder's statechain key
       │
       ▼
Builder can: hold (off-chain), transfer (to another agent), withdraw (to L1)
```

### 2.5 Implementation Status

| Component | Status | Location |
|-----------|:------:|----------|
| Structural validation | ✅ Done | `enclave-sdk/src/protocol/statechain.rs` (577 lines) |
| FROST DKG integration | ✅ Done | Parameterized on `FrostCiphersuite` |
| Key rotation | ⚠️ Gated | `ProtocolUnsupported` until audit |
| Threshold signing | ⚠️ Gated | `ProtocolUnsupported` until audit |
| VTXO lifecycle state machine | ✅ Done | Deposited → Transferred → Withdrawn |
| Market settlement adapter | ❌ TODO | MARKET-010 |

---

## 3. sBTC (Stacks) — Peg Monitoring & Settlement

### 3.1 Protocol Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    sBTC PEG LIFECYCLE                              │
│                                                                    │
│  DEPOSIT:  BTC L1 ──▶ Signer Set ──▶ Stacks Mint (sBTC)          │
│           PENDING  →  ACCEPTED   →  CONFIRMED                     │
│                                                                    │
│  WITHDRAW: Stacks Burn ──▶ Signer Set ──▶ BTC L1                 │
│           PENDING     →  ACCEPTED    →  CONFIRMED                 │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Monitoring Metrics (Emily API)

| Metric | Source | Alert Threshold |
|--------|--------|:---------------:|
| Peg ratio (sBTC:BTC) | `SbtcBridgeMetrics` | < 0.98 or > 1.02 |
| Deposit confirmation time | Emily API | > 6 Stacks blocks |
| Withdrawal confirmation time | Emily API | > 12 Stacks blocks |
| Signer quorum health | Emily API | < 70% online |
| Total sBTC supply | On-chain | Track against BTC reserve |
| Daily volume | `SbtcOperation` stream | Baseline ± 3σ |

### 3.3 Fee Structure

| Operation | Fee | Notes |
|-----------|----:|-------|
| BTC→sBTC deposit | 0% | Signer-operated |
| sBTC→BTC withdrawal | 0% | Signer-operated |
| Market protocol fee | 2% | Applied to settlement value |

### 3.4 Market Integration

**Use case**: Primary settlement rail for AI labor. sBTC liquidity tracked in real-time for treasury dashboard.

---

## 4. RGB — Contract-Backed Asset Settlement

### 4.1 Protocol Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    RGB ASSET LIFECYCLE                             │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │  ISSUE   │───▶│  TRANSFER    │───▶│  REDEEM      │            │
│  │ RGB-20/21│    │ Contract     │    │ Settle on L1 │            │
│  └──────────┘    │ state update │    └──────────────┘            │
│                  └──────────────┘                                  │
│                                                                    │
│  All operations validated against contract schema (RGB Schema)     │
│  State transitions committed via Bitcoin OP_RETURN anchor          │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Asset Types

| Standard | Type | Market Use |
|----------|------|------------|
| **RGB-20** | Fungible token | Settlement instruments, stablecoins, fee tokens |
| **RGB-21** | Non-fungible asset | Work product certificates, reputation badges, identity |
| **RGB-25** | Collectible | Limited editions, achievement tokens |

### 4.3 Fee Structure

| Operation | Fee | Recipient |
|-----------|----:|-----------|
| Asset issuance | One-time 50K sats | RGB contract deployer |
| State transition | Bitcoin fee (anchor) | Bitcoin miners |
| Market protocol fee | 2% of settlement | Conxian treasury |

### 4.4 Market Integration

**Use case**: Contract-enforced settlement rules. RGB-20 tokens as AI labor settlement instruments. RGB-21 for unique work product ownership.

---

## 5. Babylon — BTC Staking Yield

### 5.1 Protocol Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    BABYLON STAKING LIFECYCLE                       │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │  STAKE   │───▶│  ACTIVE      │───▶│  UNBOND      │            │
│  │ BTC lock │    │ Yield accrual│    │ Timelock     │            │
│  └──────────┘    └──────────────┘    └──────────────┘            │
│                                          │                        │
│                                          ▼                        │
│                                    ┌──────────────┐              │
│                                    │  CLAIM       │              │
│                                    │ BTC + yield  │              │
│                                    └──────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 SAB Treasury Staking Policy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max allocation | 25% of treasury | Remainder must stay liquid |
| Min lock time | 21 days (≈1K blocks) | Babylon minimum |
| Max lock time | 180 days | Liquidity constraint |
| Finality providers | Top 10 by stake | Decentralization floor |
| Max per provider | 20% of staked amount | Concentration risk |
| Yield destination | 50% ops / 30% founders / 20% ecosystem | Standard split |

### 5.3 Risk Matrix

| Risk | Severity | Mitigation |
|------|:--------:|------------|
| Slashing (double-sign) | HIGH | Provider diversity, stake cap per provider |
| Unbonding delay | MEDIUM | Minimum 25% treasury in liquid stablecoins |
| Provider centralization | MEDIUM | Rotate providers quarterly |
| Smart contract exploit | HIGH | Only stake through audited adapter |
| BTC price volatility | LOW | Yield is BTC-denominated |

### 5.4 Fee Structure

| Fee | Rate | Recipient |
|-----|-----:|-----------|
| Babylon protocol fee | Variable | Babylon finality providers |
| Market staking fee | 0.5% of yield | Conxian treasury |
| Withdrawal fee | Bitcoin mining fee | Bitcoin miners |

---

## 6. Fedimint — Community Settlement Pools

### 6.1 Protocol Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    FEDIMINT MINT LIFECYCLE                        │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │  CREATE  │───▶│  OPERATE     │───▶│  DISSOLVE    │            │
│  │ Mint +   │    │ E-cash issue │    │ Redeem all   │            │
│  │ Guardians│    │ Transfers    │    │ Back to BTC  │            │
│  └──────────┘    └──────────────┘    └──────────────┘            │
│                                                                    │
│  Guardians: 3-of-5 threshold recommended                          │
│  E-cash: blinded signatures, privacy-preserving                   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Community Pool Requirements

| Requirement | Minimum | Recommended |
|-------------|:-------:|:-----------:|
| Guardians | 3 | 5 |
| Threshold | 2-of-3 | 3-of-5 |
| Initial liquidity | 0.1 BTC | 1 BTC |
| Guardian stake | 0.01 BTC | 0.1 BTC |
| Uptime SLA | 95% | 99.5% |

### 6.3 Fee Structure

| Fee | Rate | Set By |
|-----|-----:|--------|
| Mint fee (e-cash issue) | 0.1% – 0.5% | Community governance |
| Transfer fee | 0% | Protocol |
| Redemption fee | 0% | Protocol |
| Market protocol fee | 1% (reduced) | Conxian treasury |

> Fedimint market fee is reduced to 1% (vs standard 2%) because the community bears operational costs.

### 6.4 Market Integration

**Use case**: Community-organized agent markets. Agents in the same federation settle via e-cash with zero per-transaction cost. Market protocol fee collected on mint entry and redemption exit.

---

## 7. Trust Tier → Rail Selection Matrix

| Trust Tier | Available Rails | Verification |
|:----------:|-----------------|:------------:|
| **ObserverOnly** | None (discovery only) | None |
| **Expedient** | Lightning, ALEX, Fedimint, EVM | Light client |
| **Managed** | All Expedient + Statechain, sBTC, RGB, Babylon | Enclave attestation |
| **Strict** | All rails | TEE + ZK proof |

---

## 8. Settlement Flow: End-to-End AI Labor Payment

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI LABOR SETTLEMENT FLOW                          │
│                                                                      │
│  1. Client creates JobCard (CJCS) with settlement amount             │
│                          │                                           │
│  2. TrustTier detection: read attestation, assign tier               │
│       ├── Strict → Institutional ZK-verified escrow                  │
│       ├── Managed → Statechain VTXO or sBTC peg                      │
│       └── Expedient → Lightning or Fedimint e-cash                   │
│                          │                                           │
│  3. Builder completes work → SLA validation                          │
│       ├── SLA met → auto-settle via selected rail                    │
│       └── SLA breach → auto-generate CJCS gap card (MARKET-013)      │
│                          │                                           │
│  4. Protocol fee collection: 2% → treasury                           │
│       ├── 50% → Operations (CI/CD, SDKs, Nexus, audits)              │
│       ├── 30% → Founders (4-year vesting)                            │
│       └── 20% → Ecosystem (grants, liquidity mining)                 │
│                          │                                           │
│  5. Treasury yield (Babylon staking) on idle reserves                 │
│       └── Yield split: 50% ops / 30% founders / 20% ecosystem        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Rail Comparison for Market Route Selection

| Dimension | Statechain | sBTC | RGB | Lightning | Fedimint | Babylon |
|-----------|:----------:|:----:|:---:|:---------:|:--------:|:-------:|
| **Finality** | Operator-set | 6 blocks | 1 anchor | Instant | Guardian-set | 1K blocks |
| **Throughput** | ∞ (off-chain) | Stacks TPS | Anchor rate | LN TPS | Federation | N/A (staking) |
| **Privacy** | Medium | Low | High | Medium | High | Low |
| **Counterparty Risk** | 1-of-n trust | Signer set | Contract schema | Channel peer | Guardians | Provider |
| **Min Amount** | 10K sats | 1 sat | 1 sat | 1 msat | 1 sat | 0.005 BTC |
| **Market Fee** | 2% | 2% | 2% | 1% | 1% | 0.5% (yield) |
| **Use Case** | Agent payments | Primary settlement | Asset settlement | Micro-payments | Community pools | Treasury yield |

---

## 10. Gateway Adapter Readiness (Session 48 Gap Analysis)

Each rail depends on a gateway adapter. Production readiness varies:

| Rail | Gateway Adapter | File | Readiness | Issue |
|------|:---------------|:-----|:---------:|:------|
| sBTC | `stacks/sbtc.rs` | `engine/src/stacks/sbtc.rs` | ✅ Production | — |
| Lightning | Nexus bridge | N/A (Nexus) | ✅ Production | — |
| ALEX/Stacks | `stacks/alex.rs` | `engine/src/stacks/alex.rs` | ✅ Production | — |
| Babylon | `bitcoin/babylon_adapter.rs` | `engine/src/bitcoin/babylon_adapter.rs` | ✅ Production | — |
| Fedimint | `bitcoin/fedimint_adapter.rs` | `engine/src/bitcoin/fedimint_adapter.rs` | ✅ Production | — |
| RGB | `bitcoin/rgb_adapter.rs` | `engine/src/bitcoin/rgb_adapter.rs` | ⚠️ Partial | [#228](https://github.com/Conxian/conxian-gateway/issues/228) — stash resolver needed |
| Statechain | Via enclave-sdk | `conxius-enclave-sdk` | ⛔ Gated | [#260](https://github.com/Conxian/conxius-enclave-sdk/issues/260) — FROST `ProtocolUnsupported` |
| DLC | `bitcoin/dlc_oracle.rs` | `engine/src/bitcoin/dlc_oracle.rs` | 🟡 Stub | [#220](https://github.com/Conxian/conxian-gateway/issues/220) — CET path not built |
| BitVM3 | `bitcoin/bitvm_adapter.rs` | `engine/src/bitcoin/bitvm_adapter.rs` | 🔬 Research | [#189](https://github.com/Conxian/conxian-gateway/issues/189) — garbled circuits |

### Adapter Legend
- ✅ **Production** — Adapter wired, tested, CI green
- ⚠️ **Partial** — Core adapter exists, integration edge incomplete
- 🟡 **Stub** — Type scaffolding exists, no execution path
- 🔬 **Research** — Evaluation-phase, no production code
- ⛔ **Gated** — Protocol exists but crypto ops behind `ProtocolUnsupported`

> **4 rails are production-ready** (sBTC, Lightning, ALEX, Babylon, Fedimint).
> **Statechain** is the most strategically important rail but entirely gated on enclave-sdk #260.
> **DLC** and **BitVM3** remain research-phase; not part of the 6-rail settlement catalog.

---

*"Architecting the rails where the user owns the train."*
