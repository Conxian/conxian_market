# Conxian Funding & Economics: Multi-Dimensional DeFi Monetary System

> **Status:** Active Research | **Last Updated:** 2026-07-15  
> **Version:** 1.0 | **Owner:** Conxian Labs

---

## Executive Summary

This document defines the **Multi-Dimensional DeFi Monetary System** for the Conxian Ecosystem. It addresses the critical requirement: **sustainable funding at launch** while remaining healthy for all stakeholders. The system leverages **ALEX (Bitcoin DeFi on Stacks)** as the primary launchpad with integrated settlement rails, supplemented by cross-chain adapters for EVM and other Bitcoin L2s.

### Core Challenge
> "I don't want to be stuck with too little funds to operate or compensate, but [the model] must be healthy for all."

**Solution:** A tiered, sustainable fee architecture that scales with ecosystem growth—conservative at launch, maturing into a diversified treasury model.

---

## 1. Industry Research Summary

### 1.1 Protocol Fee Benchmarks

| Protocol | Fee Rate | Revenue Model | Sustainability |
|:---------|:--------:|:--------------|:---------------|
| **Uniswap** | 0.05% | Direct to LP | ✅ High |
| **Curve** | 0.04% | veCRV governance | ✅ High |
| **Balancer** | 10% | FeeSplitter | ⚠️ Medium |
| **Babylon Finance** | 15% team | 4-year vesting | ⚠️ Medium |
| **Ocean Protocol** | Variable | Provider splits | ✅ High |
| **Akash Network** | Burn-mint | Compute credits | ✅ High |
| **Golem** | 0% | Token appreciation | ❌ Risky |

### 1.2 Key Findings

- **No protocol implements 1%→0.75% decay model** — This would be unprecedented
- **ALEX launchpad** enables multi-chain IDOs with APower allocation mechanism
- **DAO treasuries** require 12-24 months stablecoin runway minimum
- **Sustainable range:** 1-5% platform fees for infrastructure protocols

---

## 2. Multi-Dimensional DeFi Monetary System Architecture

### 2.1 Layer 1: Protocol Fee Structure

```
┌─────────────────────────────────────────────────────────────────┐
│   PROTOCOL FEE: dynamic hybrid (ADR-005)                        │
│   rate = max(amount × decayed_bps/10000, rail_floor) × load     │
│   decayed_bps: 50 / 25 / 15 / 10  (0.50% → 0.10% by volume)     │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ├── 50% → Operations Treasury
                    │         ├── CI/CD & Infrastructure
                    │         ├── SDK Development & Maintenance
                    │         ├── Nexus (Glass Node) Operations
                    │         └── Security Audits (Quarterly)
                    │
                    ├── 30% → Founder/Contributor Compensation
                    │         ├── 4-Year Vesting Schedule
                    │         ├── Performance Bonuses (DAO-voted)
                    │         └── Emergency Fund (6-month cap)
                    │
                    └── 20% → Ecosystem Growth
                              ├── Builder Grants
                              ├── Liquidity Mining Programs
                              └── Bug Bounty & Security
```

> The retired static 2% rate is superseded by ADR-005 (Accepted 2026-11-14).
> The 50/30/20 split of the collected fee is unchanged.

### 2.2 Layer 2: Fee Rate Schedule (ADR-005)

| Volume tier (30-day) | Fee Rate | Rationale |
|:---------------------|:--------:|:----------|
| **TIER_1** | 0.50% | Launch / low volume |
| **TIER_2** | 0.25% | Scale |
| **TIER_3** | 0.15% | High volume |
| **TIER_4** | 0.10% | High-velocity M2M |

> Every settlement also carries a **per-rail flat floor** (`rail_cost × 1.25`), so
> the fee never rounds to zero on micro-settlements. Rate changes are
> **DAO-governed**; emergency pause via 2-of-3 multisig.

### 2.3 Layer 3: Revenue Allocation Matrix (80/10/10 Integration)

The 80/10/10 builder matrix applies to the **net** (`gross − protocol fee`):

| Recipient | Allocation | Purpose |
|:----------|:----------:|:--------|
| **Builder (Agent Creator)** | 80% | Direct builder compensation |
| **Platform Treasury** | 10% | Operations & development |
| **Ecosystem Stakeholders** | 10% | Governance incentives |

**The collected protocol fee `F` splits:**
- 50% → Operations
- 30% → Founder Compensation Pool
- 20% → Ecosystem Growth

---

## 3. ALEX Integration Strategy

### 3.1 Why ALEX for Launch

| Factor | ALEX Advantage |
|:-------|:---------------|
| **Bitcoin-Native** | sBTC peg for trustless settlement |
| **Launchpad** | APower mechanism for allocation |
| **Multi-Chain** | Stacks + Bitcoin L2 integration |
| **Clarity Contracts** | Auditable, readable smart contracts |
| **Infrastructure** | AMM, Orderbook, Staking, Farming |

### 3.2 ALEX Launch Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CONXIAN LAUNCH SEQUENCE                  │
├─────────────────────────────────────────────────────────────┤
│  Phase 1: ALEX IDO                                          │
│  ├── APower staking for allocation                          │
│  ├── Liquidity bootstrapping (50% raise → LP)               │
│  └── Token listing on ALEX DEX                               │
│                                                              │
│  Phase 2: Settlement Rail Integration                        │
│  ├── sBTC/USDC pools for AI labor settlement                │
│  ├── Cross-chain adapters (EVM, Fedimint, Citrea)          │
│  └── ERC-8183 Escrow on Stacks                               │
│                                                              │
│  Phase 3: Treasury Diversification                           │
│  ├── RWA allocation (Tokenized T-bills)                     │
│  ├── Stablecoin reserves (USDC, USDT)                       │
│  └── Liquid staking yield                                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 ALEX Risk Mitigation

⚠️ **Critical Security Alert:** ALEX experienced two major exploits:
- May 2024: ~$4.3M (XLink bridge)
- June 2025: ~$8.37M (Verification bypass)

**Mitigation Strategy:**
1. **Time-locked treasury exposure** — Maximum 20% treasury in ALEX ecosystem
2. **Multi-sig controls** — 3-of-5 multisig for all ALEX-based transactions
3. **Rapid exit protocol** — Automated triggers if TVL drops >50%
4. **Diversification requirement** — Minimum 3 settlement rails active

---

### 3.4 Session 48: New Revenue Streams (2026-08-01)

All 17 core modules wired across 5 consumers. New settlement rails unlocked:

#### Tiered Pricing Revenue

| Tier | Verification | Fee | Revenue Mix Target |
|:----:|:------------|:---:|:------------------:|
| **Strict** | TEE + ZK | Negotiated | 10% of volume (high value) |
| **Managed** | Enclave attestation | ADR-005 dynamic + 0.5% premium (inactive) | 40% of volume |
| **Expedient** | Light client | ADR-005 dynamic | 50% of volume |
| **ObserverOnly** | None | Free | 0% (discovery only) |

> Premium tier (+0.5% on Managed, negotiated on Strict) funds enclave attestation infrastructure.

#### Babylon Treasury Staking (MARKET-014)

| Parameter | Value |
|-----------|-------|
| Max treasury allocation | 25% |
| Expected APY | 3–5% BTC-denominated |
| Yield destination | 50% ops / 30% founders / 20% ecosystem |
| Monthly yield (@5 BTC staked) | 0.0125–0.0208 BTC |

#### Fedimint Community Pools (MARKET-015)

| Fee | Rate | Set By |
|-----|-----:|--------|
| Mint fee (e-cash issue) | 0.1–0.5% | Community governance |
| Market protocol fee | 1% (reduced) | Conxian treasury |

> Reduced (community bears operational costs). Standard rate is the ADR-005 dynamic model, not 2%.

#### Statechain VTXO Fees (MARKET-010)

| Operation | Fee | Revenue Impact |
|-----------|----:|---------------|
| VTXO creation | 0.1% of amount | Micro — low margin, high volume |
| VTXO transfer | Flat 100 sats | Near-zero — infrastructure play |
| Market protocol fee | ADR-005 dynamic (0.50%→0.10% + floor) | Standard settlement revenue |

#### Updated Revenue Projections

> **Superseded basis (2026-11-14):** the figures below were computed under the
> retired **2%** static rate. Under ADR-005 the base rate is **0.50%** at launch
> (volume-decay 0.50%→0.10% + per-rail floor). The "Base" column below is shown
> at both rates; the remaining streams (premium, staking, Fedimint) are unchanged
> as research targets. Recompute the full model before using these externally.

| Scenario | Volume | Base @2% (retired) | Base @0.50% (ADR-005) | +0.5% Premium | Staking Yield | Fedimint | **Total @0.50%** |
|----------|-------:|-------------------:|----------------------:|:------------:|:------------:|:--------:|-----------------:|
| Launch (mo 1–3) | $1M/mo | $20K | **$5K** | $450 | $150 | $500 | **~$6.1K** |
| Growth (mo 4–6) | $3M/mo | $60K | **$15K** | $3K | $400 | $1.5K | **~$19.9K** |
| Mature (mo 7–12) | $10M/mo | $200K | **$50K** | $15K | $800 | $5K | **~$70.8K** |

> The per-rail floor raises the *effective* rate above 0.50% on small
> settlements, so realised revenue sits between the floor and the headline rate.

#### Per-Rail Revenue Breakdown (ADR-005: one rate, 0.50%)

| Rail | Volume Share | Rate | Monthly Rev (@$1M vol) | Monthly Rev (@$10M vol) |
|------|:-----------:|-----:|----------------------:|------------------------:|
| ALEX/Stacks | 35% | 0.50% | $1,750 | $17,500 |
| sBTC | 25% | 0.50% | $1,250 | $12,500 |
| Lightning | 15% | 0.50% | $750 | $7,500 |
| Fedimint | 10% | 0.50% | $500 | $5,000 |
| EVM (ERC-8183) | 10% | 0.50% | $500 | $5,000 |
| Statechain (Spark) | 3% | 0.50% | $150 | $1,500 |
| RGB | 2% | 0.50% | $100 | $1,000 |
| **Base total** | **100%** | | **$5,000** | **$50,000** |
| Premium surcharge (not active) | (25% of vol) | +0.5% | $1,250 | $12,500 |
| Babylon yield | N/A | 3-5% APY | $150 | $800 |

> Per ADR-005 the percentage is a **single** volume-based rate — rail differences
> live only in the flat floor, not the rate. The retired table showed 2%/1% per
> rail.

#### Revenue Distribution (50/30/20)

> Figures below are the **retired 2%-basis** illustration; under ADR-005 the base
> is ~4× lower (see the projection table above). The 50/30/20 split ratio is
> unchanged.

```
┌──────────────────────────────────────────────────────────────┐
│                  REVENUE DISTRIBUTION                         │
│                                                               │
│  $21.1K/mo (Launch)           $220.8K/mo (Mature)            │
│                                                               │
│  ┌──────────────┐              ┌──────────────┐              │
│  │ Ops (50%)    │              │ Ops (50%)    │              │
│  │ $10,550/mo   │              │ $110,400/mo  │              │
│  │ CI/CD+Nexus+ │              │ CI/CD+Nexus+ │              │
│  │ SDK+Audit    │              │ SDK+Audit    │              │
│  └──────────────┘              └──────────────┘              │
│  ┌──────────────┐              ┌──────────────┐              │
│  │ Founders(30%)│              │ Founders(30%)│              │
│  │ $6,330/mo    │              │ $66,240/mo   │              │
│  │ 4yr vesting  │              │ 4yr vesting  │              │
│  └──────────────┘              └──────────────┘              │
│  ┌──────────────┐              ┌──────────────┐              │
│  │ Ecosystem    │              │ Ecosystem    │              │
│  │ (20%)        │              │ (20%)        │              │
│  │ $4,220/mo    │              │ $44,160/mo   │              │
│  │ Grants+Liq   │              │ Grants+Liq   │              │
│  └──────────────┘              └──────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

> Distribution via Clarity contract (CON-1427) with 48-hour timelock on governance changes.
> All rail revenue flows through the same 50/30/20 split regardless of source.

### 4.1 Minimum Viable Treasury (MVT)

At launch, we target **12-month runway** minimum:

| Cost Category | Monthly Estimate | Annual |
|:--------------|:----------------:|:------:|
| **Infrastructure** | $3,000 | $36,000 |
| **Development** | $8,000 | $96,000 |
| **Security Audits** | $5,000 | $60,000 |
| **Legal/Compliance** | $2,000 | $24,000 |
| **Operations** | $2,000 | $24,000 |
| **Total** | **$20,000** | **$240,000** |

### 4.2 Break-Even Volume Calculation

```
Required Annual Revenue = $240,000
Platform Fee (ADR-005 launch) = 0.50%
Break-Even Volume = $240,000 / 0.005 = $48,000,000/year
Break-Even Volume = $48M / 365 = ~$131,500/day

(Under the retired 2% rate the break-even was $12M/year = ~$33K/day; the lower
competitive rate moves it up ~4×. The per-rail floor raises the effective rate on
small settlements, partially offsetting this.)
```

### 4.3 Volume Milestones

| Milestone | Daily Volume | Annual Revenue | Runway |
|:----------|:------------:|:--------------:|:------:|
| **Break-Even (ADR-005 @0.50%)** | $131,500 | $240K | 12 months |
| **Sustainable** | $400,000 | $730K | 36+ months |
| **Growth** | $2,000,000 | $3.65M | Expansion mode |
| **Mature** | $4,000,000+ | $7.3M+ | Full decentralization |

> Volumes scaled from the retired 2%-basis table (×4 for the 0.50% rate).

---

## 5. Founder Compensation Framework

### 5.1 Compensation Principles

1. **Vesting Schedule:** 4-year cliff, monthly thereafter
2. **Performance-Linked:** 50% base, 50% DAO-voted bonus
3. **Sustainable Cap:** Maximum 30% of platform treasury annually
4. **Emergency Limit:** 6-month compensation held in escrow

### 5.2 Allocation Table

| Role | Base Allocation | Vesting | Performance Cap |
|:-----|:---------------:|:--------:|:---------------:|
| **Core Founders** | 4.5% of fees | 4 years | 2x base |
| **Key Contributors** | 2.5% of fees | 3 years | 1.5x base |
| **Advisors** | 1.0% of fees | 2 years | 1x base |

> **Comparison:** Babylon Finance uses 15% team fee. We use **4.5% of fees** (not tokens), which is more defensible and aligned with "infrastructure" positioning.

---

## 6. Treasury Management

### 6.1 Asset Allocation Strategy

Following DAO treasury best practices:

| Asset Class | Target % | Purpose |
|:------------|:--------:|:--------|
| **Stablecoins** | 40% | Operations runway |
| **RWA/T-Bills** | 30% | Low-vol yield |
| **Liquid Staking** | 20% | Yield generation |
| **Native Token** | 10% | Governance alignment |

### 6.2 Governance Controls

- **Multisig:** 3-of-5 SAFE multisig for all treasury operations
- **Timelock:** 48-hour delay for transactions >$50,000
- **Veto Rights:** DAO can pause via 60% vote
- **Reporting:** Monthly transparency dashboard
- **Audits:** Quarterly third-party treasury audits

---

## 7. Comparison: 1% vs 4.5% vs Industry

### 7.1 Historical Comparison (pre-ADR-005)

> This analysis predates ADR-005; the rate was later set to the dynamic model
> (0.50%→0.10% + per-rail floor), not 2%.

| Model | Rate | Pros | Cons |
|:------|:----:|:-----|:-----|
| **1% (Infrastructure)** | 1% | Most defensible, lowest friction | May underfund operations |
| **2% (Balanced)** ✓ | 2% | Sustainable operations, fair to all | Moderate extraction |
| **4.5% (Your Current)** | 4.5% | Better compensation | Regulatory risk, perception |
| **Industry Average** | 2-5% | Market standard | Varies by protocol |

### 7.2 Decision Matrix

```
┌────────────────────────────────────────────────────────┐
│   SUPERSEDED: rate is ADR-005 dynamic (0.50%→0.10%) │
├────────────────────────────────────────────────────────┤
│ ✅ More legally defensible than 4.5%                  │
│ ✅ Sustainable 12-month runway at launch               │
│ ✅ Aligned with "routing only" ethos                  │
│ ✅ Lower regulatory risk                               │
│ ✅ Community sees you as infrastructure                │
│ ✅ Competitive with Ocean Protocol, Balancer           │
│ ✅ Can reduce to 1% after stabilization              │
└────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Checklist

### Phase 1: Pre-Launch (Weeks 1-4)
- [ ] Deploy ALEX IDO smart contracts
- [ ] Establish 3-of-5 multisig treasury
- [ ] Set up transparent reporting dashboard
- [ ] Complete initial security audit
- [ ] Publish fee structure documentation

### Phase 2: Launch (Weeks 5-8)
- [ ] Execute ALEX IDO
- [ ] Initialize settlement pools (sBTC/USDC)
- [ ] Activate 80/10/10 yield matrix
- [ ] Enable protocol fee collection (ADR-005 dynamic)
- [ ] Begin monthly treasury reporting

### Phase 3: Stabilization (Months 3-12)
- [ ] Monitor volume vs. break-even
- [ ] Quarterly security audits
- [ ] Governance token distribution
- [ ] Evaluate fee adjustment (ADR-005 volume-decay tiers)

---

## 9. Key Metrics Dashboard

| Metric | Target | Warning | Critical |
|:-------|:------:|:-------:|:--------:|
| **Treasury Runway** | 12+ months | 6 months | 3 months |
| **Daily Volume** | $33K+ | $15K | $5K |
| **Protocol Revenue** | $20K/month | $10K/month | $3K/month |
| **Active Builders** | 50+ | 20 | 5 |
| **Protocol Fee (launch)** | 0.50% | N/A | N/A |

---

## 10. References

- [ALEX Lab Documentation](https://docs.alexlab.co/)
- [DAO Treasury Management](https://blockchaindefispecialist.com/Tokenomics%20of%20DAO%20Treasuries.pdf)
- [Uniswap Protocol Fee Report](https://gauntlet.xyz/resources/uniswap-protocol-fee-report)
- [Ocean Protocol Fees](https://docs.oceanprotocol.com/developers/contracts/fees)
- [State Channels for Micropayments](https://ethereum.org/developers/docs/scaling/state-channels)
- [ERC-8183 Escrow Standard](https://eips.ethereum.org/EIPS/eip-8183)

---

## Appendix A: Fee Flow Diagram

```
Gross settlement ($100) — locked in ERC-8183 escrow
        │
        ▼
┌─────────────────────────────────────────┐
│  Protocol fee  F = max($100 × 0.50%, floor)   ($0.50 at launch) │
└─────────────────────────────────────────┘
        │
        ├──► 50% → Operations
        ├──► 30% → Founders
        └──► 20% → Ecosystem

Net = $100 − F  ($99.50)
        │
        ▼
┌─────────────────────────────────────────┐
│            80 / 10 / 10 split           │
│  ├── 80% → Builder                       │
│  ├── 10% → Platform Treasury             │
│  └── 10% → Ecosystem Stakeholders        │
└─────────────────────────────────────────┘
```

> The fee **rate** is ADR-005's dynamic model (0.50%→0.10% by volume + per-rail
> floor), not the retired flat 2%. The 80/10/10 split applies to the **net**.

---

## Appendix B: Vesting Schedule

| Year | Founders | Contributors | Advisors |
|:----:|:--------:|:------------:|:--------:|
| 0-1 | 0% (Cliff) | 0% (Cliff) | 0% (Cliff) |
| 1-2 | 25% | 33% | 50% |
| 2-3 | 50% | 66% | 100% |
| 3-4 | 75% | 100% | N/A |
| 4+ | 100% | N/A | N/A |

---

## 5. Revenue Model Risk Assessment (Session 48 Gap Analysis)

### 5.1 Current Blockers

The 5-stream revenue model is **theoretical** until these P0 gaps close:

| Stream | Status | Blocker | Revenue at Risk |
|--------|:------:|---------|:---------------:|
| Protocol fee (ADR-005 dynamic) | ⛔ Blocked | CON-1427 contract not deployed (#488) | 50% of revenue |
| Premium surcharge (+0.5%) | ⛔ Blocked | No enclave attestation (#240-#242) | 15% of revenue |
| Institutional (negotiated) | ⛔ Blocked | No TEE+ZK proof chain (#198, #202) | 10% of revenue |
| Community pools (1%) | ✅ Ready | Fedimint adapter wired | 5% of revenue |
| Staking yield (3-5% APY) | ✅ Ready | Babylon adapter wired | 5% of revenue |

> **Current realizable revenue:** ~$1,500/mo (Fedimint + Babylon only) vs. **target** $21,100/mo at launch.
> **Revenue gap:** 93% of projected revenue is blocked on 3 P0 issues.

### 5.2 Degraded Revenue Scenarios

| Scenario | What Works | Monthly Revenue | vs. Target |
|----------|-----------|----------------:|:----------:|
| **Expedient-only** (current) | Fedimint pools + Babylon staking | $1,500 | 7% |
| **+CON-1427** (fee collection live) | Expedient rails at ADR-005 rate | $15,000 | 71% |
| **+Attestation P0** (Managed tier) | All rails at tiered rates | $20,600 | 98% |
| **Full 5-stream** (all P0 closed) | Institutional + premiums | $21,100 | 100% |

### 5.3 Break-Even Timeline Impact

| Scenario | Monthly Burn | Revenue | Runway (w/o raise) |
|----------|:-----------:|:------:|:------------------:|
| Expedient-only | $20,000 | $1,500 | 6 months |
| +CON-1427 | $20,000 | $15,000 | 14 months |
| +Attestation | $20,000 | $20,600 | **Break-even** |
| Full 5-stream (at $10M vol) | $30,000 | $220,800 | **Sustainable** |

> **Action:** CON-1427 (#488) is the single highest-leverage P0. It alone recovers 71% of revenue.
> Attestation P0s (#240-#242) unlock the remaining 27% and achieve break-even.

---

*This document is a living specification. All changes require DAO governance approval.*
