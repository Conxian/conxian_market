# Conxian Market: Monitoring & Alerting

> **Status:** Active | **Version:** 1.0 | **Last Updated:** 2026-08-01 (Session 48)
> **Purpose:** Real-time monitoring specifications for all settlement rails and treasury health.

---

## 1. sBTC Peg Monitoring (Emily API)

### 1.1 Data Source

```rust
// Gateway: internal/engine/src/stacks/sbtc.rs
pub struct SbtcBridgeMetrics {
    pub total_sbtc_supply: u64,       // sats
    pub btc_reserve: u64,             // sats (signer-set controlled)
    pub pending_deposits: u64,        // count
    pub pending_withdrawals: u64,     // count
    pub avg_deposit_confirm_blocks: f64,
    pub avg_withdrawal_confirm_blocks: f64,
    pub signer_quorum_health: f64,    // 0.0 – 1.0
    pub last_updated: SystemTime,
}
```

### 1.2 Alert Thresholds

| Metric | Green | Yellow | Red | Action |
|--------|:-----:|:------:|:---:|--------|
| Peg ratio (sBTC:BTC) | 0.99–1.01 | 0.98–0.99 or 1.01–1.02 | <0.98 or >1.02 | Page on-call |
| Deposit confirmation | ≤3 blocks | 4–6 blocks | >6 blocks | Investigate signer set |
| Withdrawal confirmation | ≤6 blocks | 7–12 blocks | >12 blocks | Escalate to signers |
| Signer quorum health | ≥90% | 70–89% | <70% | Emergency protocol |
| Daily volume Δ | ±50% | ±80% | ±200% | Investigate anomaly |
| Pending ops backlog | ≤10 | 11–50 | >50 | Rate-limit new ops |

### 1.3 Dashboard Queries

```sql
-- Peg health over time
SELECT ts, (total_sbtc_supply::float / btc_reserve::float) AS peg_ratio
FROM sbtc_metrics
WHERE ts > NOW() - INTERVAL '24 hours'
ORDER BY ts;

-- Deposit confirmation latency (P95)
SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY confirm_blocks)
FROM sbtc_operations
WHERE kind = 'deposit' AND state = 'CONFIRMED'
  AND ts > NOW() - INTERVAL '1 hour';

-- Signer quorum trend
SELECT ts, signer_quorum_health
FROM sbtc_metrics
WHERE ts > NOW() - INTERVAL '7 days'
ORDER BY ts;
```

---

## 2. Fedimint Mint Health

### 2.1 Data Source

```rust
// Gateway: internal/engine/src/bitcoin/fedimint_adapter.rs
pub struct FedimintMintHealth {
    pub mint_id: String,
    pub community_name: String,
    pub total_liquidity_sats: u64,
    pub active_guardians: u8,
    pub required_threshold: u8,
    pub e_cash_in_circulation: u64,
    pub pending_issuances: u64,
    pub pending_redemptions: u64,
    pub last_guardian_heartbeat: SystemTime,
}
```

### 2.2 Alert Thresholds

| Metric | Green | Yellow | Red | Action |
|--------|:-----:|:------:|:---:|--------|
| Guardian count vs threshold | ≥ threshold | threshold - 1 | < threshold | Page mint admin |
| Guardian heartbeat | ≤30s | 30–120s | >120s | Investigate guardian |
| E-cash vs liquidity | ≤80% | 80–95% | >95% | Provision more liquidity |
| Pending redemption backlog | ≤5 | 6–20 | >20 | Rate-limit redemptions |
| Mint uptime | ≥99.5% | 99–99.5% | <99% | Failover to backup |

---

## 3. Babylon Staking Health

### 3.1 Data Source

```rust
// Gateway: internal/engine/src/bitcoin/babylon_adapter.rs
pub struct StakingIntent {
    pub staker_pubkey: String,
    pub finality_provider_pubkey: String,
    pub amount_sats: u64,
    pub lock_time_blocks: u64,
}

pub struct StakingPosition {
    pub intent: StakingIntent,
    pub state: StakingState,  // Pending, Active, Unbonding, Claimed
    pub accrued_yield_sats: u64,
    pub created_at: u64,      // block height
    pub unlocks_at: u64,      // block height
}
```

### 3.2 Alert Thresholds

| Metric | Green | Yellow | Red | Action |
|--------|:-----:|:------:|:---:|--------|
| Total staked % of treasury | ≤25% | 25–35% | >35% | Rebalance to liquid |
| Single provider concentration | ≤20% | 20–30% | >30% | Rotate stake |
| Unbonding positions | ≤10% | 10–20% | >20% | Investigate mass exit |
| Provider slashing events | 0 | 1 | ≥2 | Remove provider |
| Yield deviation from expected | ±10% | ±25% | ±50% | Investigate provider |

---

## 4. Treasury Health Dashboard

### 4.1 Key Metrics

```
┌──────────────────────────────────────────────────────────┐
│                 TREASURY HEALTH DASHBOARD                  │
│                                                            │
│  Runway:        8.2 months  [████████░░] 82%              │
│  Daily Volume:  $28,400     [███████░░░] 86% of $33K      │
│  Monthly Rev:   $17,040     [████████░░] 85% of $20K      │
│                                                            │
│  Asset Allocation:                                         │
│  ├── Stablecoins:  38%  [████████░░] Target: 40%          │
│  ├── RWA:          28%  [██████░░░░] Target: 30%          │
│  ├── Liquid Staking:22%  [█████░░░░░] Target: 20%         │
│  └── Native Token: 12%  [███░░░░░░░] Target: 10%          │
│                                                            │
│  Staking Yield (Babylon):                                  │
│  ├── Total Staked:  2.5 BTC                                │
│  ├── APY:           3.2%                                  │
│  └── Monthly Yield: 0.0067 BTC                             │
│                                                            │
│  sBTC Peg: 0.998  [GREEN]  Signer Health: 94% [GREEN]    │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Treasury Health Indicators

| Indicator | Healthy | Warning | Critical |
|:----------|:-------:|:-------:|:--------:|
| Runway (months) | 12+ | 6 | 3 |
| Daily volume | $33K+ | $15K | $5K |
| Monthly revenue | $20K+ | $10K | $3K |
| Stablecoin % | 40%+ | 25% | 15% |
| Max single-asset exposure | ≤40% | 40–60% | >60% |
| Protocol fee collection rate | ≥99% | 95–99% | <95% |

---

## 5. CJCS SLA Monitoring

### 5.1 Gap Detection Rules

| Rule | Condition | Action |
|------|-----------|--------|
| **Stale JobCard** | `state = Pending AND age > 24h` | Raise priority, notify market |
| **SLA Breach** | `completed_at > deadline` | Auto-generate gap card (MARKET-013) |
| **Builder Abandonment** | `state = Accepted AND no_activity > 48h` | Reopen JobCard, flag builder |
| **TrustTier Violation** | `builder_trust_tier < required_tier` | Reject settlement, require upgrade |
| **Fee Shortfall** | `collected_fee < expected_fee` | Hold settlement, notify treasury |

### 5.2 Auto-Bounty Template

```yaml
# Generated when SLA gap detected
gap_card:
  context: "SLA breach remediation"
  type: "gap_remediation"
  work_intent:
    description: "Fix and complete failed SLA for job {original_job_id}"
    deadline: "+4h from generation"
    budget: "{original_budget} * 1.2"  # 20% urgency premium
  trust_tier: "Managed"
  auto_assign: false  # Open to marketplace
  parent_job: "{original_job_id}"
```

---

## 6. Integration Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Gateway    │────▶│   Metrics    │────▶│  Dashboard   │
│  sbtc.rs     │     │   Collector  │     │  (Grafana)   │
│  fedimint.rs │     │   (Prometheus)│     │              │
│  babylon.rs  │     └──────────────┘     └──────────────┘
└──────────────┘            │                      │
                            ▼                      ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Alertmanager │────▶│  PagerDuty   │
                     │  (rules.yml)  │     │  (on-call)   │
                     └──────────────┘     └──────────────┘
```

### 6.1 Prometheus Metrics Endpoints

| Service | Endpoint | Port |
|---------|----------|:----:|
| Gateway engine | `/metrics` | 9090 |
| sBTC bridge | `/metrics/sbtc` | 9091 |
| Fedimint adapter | `/metrics/fedimint` | 9092 |
| Babylon adapter | `/metrics/babylon` | 9093 |

---

*Monitoring is the nervous system of autonomous settlement. Every rail must be observable.*
