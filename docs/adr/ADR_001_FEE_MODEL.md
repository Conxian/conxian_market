# ADR-001: Protocol Fee Model — Authoritative Versioned Decision

> **Status:** Accepted | **Date:** 2026-08-03 | **Version:** 1.0
> **Supersedes:** Gateway #247 allocation diagram; conxian_market #6 RFC
> **Authoritative for:** Fee basis, recipients, percentages, rounding, custody, exposure caps, pause/exit

---

## Context

Issue [#6](https://github.com/Conxian/conxian_market/issues/6) proposed a 2% protocol fee with ALEX integration. The model has since been refined through Session 48 into a 4-tier TrustTier pricing system backed by `src/fee_calculator.ts`, `docs/knowledge_base/trust_tier_pricing.md`, and `docs/research/FUNDING_AND_ECONOMICS.md`.

A conflict exists between two documented allocation models:

| Source | Builder | Protocol | Ecosystem | Conflict |
|--------|:-------:|:--------:|:---------:|----------|
| `FUNDING_AND_ECONOMICS.md` §2.3 | 80% | 10% | 10% | Authoritative |
| Gateway #247 settlement diagram | 80% | 2% | 18% | **Superseded** |

This ADR resolves the conflict and establishes the single authoritative fee model. Until this ADR is published, the Gateway remains fail-closed on production venue defaults (per [conxian-gateway PR #297](https://github.com/Conxian/conxian-gateway/pull/297)).

---

## Decision

### 1. Fee Basis and Percentages

**Total protocol fee: 2%** of settlement amount, charged at settlement time.

#### 1.1 Builder Revenue Split (80/10/10)

```
Total Settlement Value ($100)
    │
    ├── 80% → Builder (Agent Creator)         $80.00
    ├── 10% → Platform Treasury               $10.00  ◄── protocol fee funds this
    └── 10% → Ecosystem Stakeholders          $10.00
```

#### 1.2 Platform Treasury Allocation (50/30/20)

Of the 10% platform treasury:

| Recipient | Share | Of $10 Treasury |
|-----------|:-----:|:---------------:|
| Operations (CI/CD, SDKs, Nexus, audits) | 50% | $5.00 |
| Founder/Contributor Compensation (4yr vesting) | 30% | $3.00 |
| Ecosystem Growth (grants, liquidity mining) | 20% | $2.00 |

**The Gateway #247 diagram showing `Protocol 2% / Ecosystem 18%` is superseded.** The 80/10/10 builder matrix in `FUNDING_AND_ECONOMICS.md` §2.3 is authoritative.

### 2. 4-Tier TrustTier Pricing Model

| Tier | Verification | Protocol Fee | Premium | Effective Rate | Use Case |
|------|:------------|:------------:|:-------:|:--------------:|----------|
| **Strict** | TEE + ZK proof | Negotiated | Negotiated | Custom | Institutional settlement |
| **Managed** | Enclave attestation | 2.0% | +0.5% | **2.5%** | Professional builders |
| **Expedient** | Light client proof | 2.0% | — | **2.0%** | Standard agent settlement |
| **ObserverOnly** | None | — | — | **Free** | Discovery/browsing |

#### 2.1 Premium Surcharge Destination

The +0.5% Managed premium and negotiated Strict premium flow to the SAB treasury, not the general 50/30/20 split. This funds enclave attestation infrastructure.

#### 2.2 Tier-Available Rails

| Rail | ObserverOnly | Expedient | Managed | Strict |
|------|:------------:|:---------:|:-------:|:------:|
| Lightning | — | ✅ 1.0% | ✅ 1.0% | ✅ |
| Fedimint | — | ✅ 1.0% | ✅ 1.0% | ✅ |
| ALEX/Stacks | — | ✅ 2.0% | ✅ 2.0% | ✅ |
| EVM/ERC-8183 | — | ✅ 2.0% | ✅ 2.5% | ✅ |
| sBTC | — | — | ✅ 2.5% | ✅ |
| Statechain (Spark) | — | — | ✅ 2.0% | ✅ |
| RGB | — | — | ✅ 2.0% | ✅ |
| Babylon | — | — | ✅ 0.5%* | ✅ |

> \* Babylon = yield share only, not settlement fee.

### 3. Fee Decay Timeline

| Phase | Duration | Rate | Governance |
|-------|----------|:----:|------------|
| Launch Stabilization | 0–12 months | 2.0% | Automatic |
| Growth | 12–36 months | 1.5% | DAO vote (60%) |
| Mature | 36+ months | 1.0% | DAO vote (60%) |

Decay is **DAO-governed** per `FUNDING_AND_ECONOMICS.md` §2.2. Emergency pause via 2-of-3 SAB multisig.

### 4. Rounding

All fee calculations use integer basis points (bps):

```
feeSat = (amountSat × feeBps) / 10000
```

- Division truncates toward zero (standard integer math).
- The effective rate in reporting is `feeBps / 10000` as a decimal fraction.
- Implemented in `src/fee_calculator.ts:calculateRailFee()`.

### 5. Custody and Signer Authority

Per `docs/AGENTS.md` §3:

| Wallet Class | Custody | Purpose |
|-------------|---------|---------|
| `SAB_DEPLOYER_MULTISIG` | SAB 3-of-5 | Contract deploys, upgrades |
| `SAB_PAYOUT_MULTISIG` | SAB 3-of-5 | Bounties, royalties (capped) |
| `SAB_EMERGENCY_PAUSE_MULTISIG` | SAB 2-of-3 | Pause/isolate only |
| `SAB_EMERGENCY_RECOVERY_MULTISIG` | SAB 3-of-5 | Unpause, key rotation |
| `DAO_TIMELOCK` | DAO | Policy changes (time-delayed) |
| `PROTOCOL_VAULTS` | System/DAO | Fee/treasury custody (rules-based) |

**TREASURY-VAULT**: Passive collection only — no outbound transfers.  
**SAB-TREASURY-MS**: Operational treasury (3-of-5, medium spend).  
**DAO-TREASURY-MS**: Long-term reserves (5-of-7, high spend).

### 6. ALEX Exposure Cap and Exit

Per `FUNDING_AND_ECONOMICS.md` §3.3:

| Control | Value |
|---------|-------|
| Maximum treasury exposure to ALEX ecosystem | **20%** |
| Multi-sig requirement | 3-of-5 |
| TVL-triggered exit | Automated if TVL drops >50% |
| Diversification requirement | Minimum 3 settlement rails active |

### 7. Pause and Exit Ownership

- **Pause authority:** `SAB_EMERGENCY_PAUSE_MULTISIG` (2-of-3) — pause only, no value transfer.
- **Unpause authority:** `SAB_EMERGENCY_RECOVERY_MULTISIG` (3-of-5).
- **Protocol shutdown:** DAO vote (60%) triggers staged unwind via `DAO_TIMELOCK`.
- **Fee rate change:** DAO vote (60%) with minimum 48-hour timelock.
- **No single personal wallet** holds pause or exit authority at any stage.

---

## Consequences

### Positive
- Single authoritative document resolves Gateway #247 allocation conflict.
- Gateway can proceed from fail-closed to staged rollout.
- All percentages, custody roles, and caps are recorded in one place.

### Negative
- Strict tier revenue remains theoretical until TEE+ZK P0s close (#198, #202, #240–#242).
- Managed tier revenue requires enclave attestation P0s (#240–#242).

### Implementation Status

| Component | Status | Location |
|-----------|:------:|----------|
| Fee calculator (Market) | ✅ Shipped | `src/fee_calculator.ts` |
| Gateway billing bridge | ✅ Shipped | `conxian-gateway:billing.rs` |
| Clarity contract activation | ⬜ Phase C | `fee-manager.clar` (stub) |
| Treasury auto-staking | ⬜ Phase D | Babylon integration |
| Gateway #247 diagram fix | ⬜ | See action items |

---

## References

- `docs/research/FUNDING_AND_ECONOMICS.md` — Full economic model, revenue streams, break-even
- `docs/knowledge_base/trust_tier_pricing.md` — Tier detection, fee schedule, SLA templates
- `docs/research/SETTLEMENT_RAILS.md` — 6 settlement rails, bridge status
- `docs/research/CON1427_IMPLEMENTATION_PLAN.md` — 4-phase implementation plan
- `src/fee_calculator.ts` — Production fee calculator (363 lines)
- [Gateway #247](https://github.com/Conxian/conxian-gateway/issues/247) — Superseded allocation diagram
- [Gateway PR #297](https://github.com/Conxian/conxian-gateway/pull/297) — Fail-closed venue defaults

---

*This ADR is the authoritative versioned decision for the Conxian protocol fee model. All agent sessions, Gateway implementations, and contract deployments MUST reference this document. Conflicts with earlier documents are resolved in favor of this ADR.*
