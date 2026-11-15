# ADR-001: Protocol Fee Model — Authoritative Versioned Decision

> **Status:** Accepted | **Date:** 2026-08-03 | **Version:** 1.1 (2026-11-14)
> **Supersedes:** Gateway #247 allocation diagram; conxian_market #6 RFC
> **Authoritative for:** Fee *recipients and split* (the matched-job per-settlement split; 50/30/20 treasury split), rounding, custody, exposure caps, pause/exit
> **Amended by [ADR-007](ADR_007_TWO_PRODUCT_RATE_MODEL.md) (2026-11-14, Accepted):**
> §1.1 (80/10/10) is **reframed** as the *matched-job* product's per-settlement split;
> §2 (the 2.0% tier table) is **superseded** by the two-product rates; §1.2 (50/30/20) is
> **retained**. The fee **rate** is ADR-005's (dynamic hybrid), scoped to the **rail**
> product. The fee **basis** is Option A (#358). Read this ADR together with ADR-007
> before applying any rate.

---

## Context

Issue [#6](https://github.com/Conxian/conxian_market/issues/6) proposed a 2% protocol fee with ALEX integration. The model has since been refined into a dynamic hybrid fee model (ADR-004/ADR-005) backed by `src/fee_calculator.ts`, `docs/knowledge_base/trust_tier_pricing.md`, and `docs/research/FUNDING_AND_ECONOMICS.md`.

A conflict exists between two documented allocation models:

| Source | Builder | Protocol | Ecosystem | Conflict |
|--------|:-------:|:--------:|:---------:|----------|
| `FUNDING_AND_ECONOMICS.md` §2.3 | 80% | 10% | 10% | Authoritative |
| Gateway #247 settlement diagram | 80% | 2% | 18% | **Superseded** |

This ADR resolves the conflict and establishes the single authoritative fee model. Until this ADR is published, the Gateway remains fail-closed on production venue defaults (per [conxian-gateway PR #297](https://github.com/Conxian/conxian-gateway/pull/297)).

---

## Decision

### 1. Fee Basis and Percentages

**The protocol fee rate is defined by ADR-005** (dynamic hybrid: single
volume-decay percentage + per-rail flat floor). This ADR is authoritative only
for *where the fee goes*, not how much it is.

The fee is charged on the gross settlement amount at settlement time:

```
Gross settlement value (locked in escrow)
    │
    ├── Protocol fee  F = max(amount × decayed_bps/10000, rail_floor) × load_factor
    │        (ADR-005; decayed_bps ∈ {50, 25, 15, 10})
    │
    └── Net = gross − F   →  builder matrix (80/10/10)
             ├── 80% → Builder (Agent Creator)
             ├── 10% → Platform Treasury   ◄── this is what F funds
             └── 10% → Ecosystem Stakeholders
```

> **Clarification (2026-11-14):** earlier revisions showed "80/10/10" *and* "2%
> protocol fee" on the same diagram without stating the base. They are on
> different bases: the 80/10/10 split applies to the **net** (`gross − F`), and
> the protocol fee `F` is a separate, additional deduction. The old 2% rate is
> retired (ADR-005); the ten-percent platform-treasury share of the *net* is a
> distribution line, not the protocol fee.

#### 1.1 Builder Revenue Split (80/10/10) — applied to net

```
Net after protocol fee (e.g. $100)
    ├── 80% → Builder (Agent Creator)         $80.00
    ├── 10% → Platform Treasury               $10.00  ◄── funds from the fee, not the split
    └── 10% → Ecosystem Stakeholders          $10.00
```

#### 1.2 Platform Treasury Allocation (50/30/20) — applied to the fee F

| Recipient | Share |
|-----------|:-----:|
| Operations (CI/CD, SDKs, Nexus, audits) | 50% |
| Founder/Contributor Compensation (4yr vesting) | 30% |
| Ecosystem Growth (grants, liquidity mining) | 20% |

> The Gateway #247 diagram showing `Protocol 2% / Ecosystem 18%` remains
> **superseded**. The 80/10/10 builder matrix is authoritative for the net split.

### 2. TrustTier Pricing Model

The **fee rate** is ADR-005's dynamic model (see `src/fee_calculator.ts`). The
trust tier still governs *which rails are available* and the Managed premium
(if re-enabled):

| Tier | Verification | Premium over base rate | Use Case |
|------|:------------|:----------------------:|----------|
| **Strict** | TEE + ZK proof | Negotiated | Institutional settlement |
| **Managed** | Enclave attestation | +0.5% (proposed; not yet active) | Professional builders |
| **Expedient** | Light client proof | — | Standard agent settlement |
| **ObserverOnly** | None | Settlement disabled | Discovery/browsing |

> The base rate is the ADR-005 volume-decay schedule (0.50% → 0.10%) composed
> with the per-rail flat floor — **not** a flat 2%. The +0.5% Managed premium is
> not wired (`DEFAULT_FEATURE_FLAGS.attestationAvailable === false`).

#### 2.1 Premium Surcharge Destination

The +0.5% Managed premium and negotiated Strict premium flow to the SAB treasury, not the general 50/30/20 split. This funds enclave attestation infrastructure.

#### 2.2 Tier-Available Rails

Availability only (rates are ADR-005's dynamic model; the per-rail flat floor
differs by rail cost — see ADR-005 §3.2):

| Rail | ObserverOnly | Expedient | Managed | Strict |
|------|:------------:|:---------:|:-------:|:------:|
| Lightning | — | ✅ | ✅ | ✅ |
| Fedimint | — | ✅ | ✅ | ✅ |
| ALEX/Stacks | — | ✅ | ✅ | ✅ |
| EVM/ERC-8183 | — | ✅ | ✅ | ✅ |
| sBTC | — | — | ✅ | ✅ |
| Statechain (Spark) | — | — | ✅ | ✅ |
| RGB | — | — | ✅ | ✅ |
| Babylon | — | — | ✅ * | ✅ |

> \* Babylon = yield share only, not settlement fee. Statechain and RGB are
> advertised but `RAIL_CAPABILITIES[].ready === false` (fail-closed).

### 3. Fee Rate Schedule

The rate is **ADR-005's** dynamic model — a single volume-decay percentage
composed with a per-rail flat floor. There is no time-based 2%/1.5%/1% decay:

| Volume tier (30-day) | Decayed rate |
|----------------------|:------------:|
| `TIER_1` | 0.50% |
| `TIER_2` | 0.25% |
| `TIER_3` | 0.15% |
| `TIER_4` | 0.10% |

`effective_fee_sat = max(amount × decayed_bps/10000, rail_floor) × load_factor`,
with `rail_floor = rail_cost × 1.25` and `load_factor ∈ [1.0, 3.0]`. DAO-governed;
emergency pause via 2-of-3 SAB multisig.

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
| Clarity contract activation | ✅ Re-homed to `conxian_market` | `contracts/protocol-fee-vault.clar` (ADR-006) |
| Treasury auto-staking | ⬜ Phase D | Babylon integration |
| Gateway #247 diagram fix | ⬜ | See action items |

---

## References

- `docs/research/FUNDING_AND_ECONOMICS.md` — Full economic model, revenue streams, break-even
- `docs/knowledge_base/trust_tier_pricing.md` — Tier detection, fee schedule, SLA templates
- `docs/research/SETTLEMENT_RAILS.md` — 8 settlement rails, bridge status
- `docs/research/CON1427_IMPLEMENTATION_PLAN.md` — 4-phase implementation plan
- `src/fee_calculator.ts` — Production dynamic fee calculator (ADR-004/ADR-005)
- `docs/adr/ADR_005_COMPETITIVE_RATES_WITH_COST_RECOVERY.md` — the live fee *rate*
- `docs/research/FEE_DESTINATION_AND_CUSTODY.md` — where the collected fee lands
- [Gateway #247](https://github.com/Conxian/conxian-gateway/issues/247) — Superseded allocation diagram
- [Gateway PR #297](https://github.com/Conxian/conxian-gateway/pull/297) — Fail-closed venue defaults

---

*This ADR is the authoritative versioned decision for the Conxian protocol fee model. All agent sessions, Gateway implementations, and contract deployments MUST reference this document. Conflicts with earlier documents are resolved in favor of this ADR.*
