# Conxian Market: SLA Bounty System (CJCS Gap Cards)

> **Status:** Active | **Version:** 1.0 | **Last Updated:** 2026-08-01 (Session 48)
> **Purpose:** Autonomous SLA enforcement via CJCS gap card generation.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    SLA GAP DETECTION PIPELINE                     │
│                                                                    │
│  JobCard Created (CJCS)                                           │
│       │                                                           │
│       ▼                                                           │
│  SLA Watcher polls every 60s                                      │
│       │                                                           │
│       ├── Deadline exceeded AND state != Done?                    │
│       │       └──▶ GAP DETECTED → Generate Gap Card               │
│       │                                                           │
│       ├── Builder unresponsive > 48h?                             │
│       │       └──▶ ABANDONMENT → Reopen + Flag Builder            │
│       │                                                           │
│       ├── TrustTier mismatch?                                     │
│       │       └──▶ VIOLATION → Reject settlement                  │
│       │                                                           │
│       └── All clear → Continue monitoring                         │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Gap Detection Rules

### 2.1 Rule Engine Configuration

```typescript
// Platform: governance/sla-enforcer.ts
interface SlaRule {
  id: string;
  condition: SlaCondition;
  action: SlaAction;
  trustTierGate: TrustTier;  // Minimum tier to auto-execute
}

type SlaCondition =
  | { kind: 'deadline_exceeded'; grace_period_seconds: number }
  | { kind: 'builder_unresponsive'; max_idle_seconds: number }
  | { kind: 'trust_tier_mismatch'; required: TrustTier; actual: TrustTier }
  | { kind: 'fee_shortfall'; min_collected_bps: number }
  | { kind: 'quality_dispute'; min_dispute_count: number };

type SlaAction =
  | { kind: 'generate_gap_card'; template: GapCardTemplate }
  | { kind: 'reopen_job_card' }
  | { kind: 'flag_builder'; severity: 'warn' | 'suspend' | 'ban' }
  | { kind: 'reject_settlement'; reason: string }
  | { kind: 'notify_treasury' };
```

### 2.2 Default Ruleset

| Rule ID | Condition | Action | Auto Tier |
|---------|-----------|--------|:---------:|
| `SLA-001` | Deadline + 1h grace | Generate gap card | Managed+ |
| `SLA-002` | Deadline + 4h | Reopen + escalate priority | Expedient+ |
| `SLA-003` | Builder idle 48h | Reopen + flag builder (warn) | Managed+ |
| `SLA-004` | Builder idle 72h | Reopen + flag builder (suspend) | Expedient+ |
| `SLA-005` | TrustTier mismatch | Reject settlement | All tiers |
| `SLA-006` | Fee < 95% expected | Hold + notify treasury | All tiers |
| `SLA-007` | 3+ quality disputes | Flag builder (suspend) | Managed+ |

## 3. Gap Card Template System

### 3.1 Base Template

```yaml
gap_card_template:
  context: "sla_remediation"
  type: "gap_card"
  work_intent:
    description_template: "Complete {original_title} (SLA breach remediation)"
    deadline: "{now} + {urgency_hours}h"
    budget_formula: "max({original_budget} * {urgency_multiplier}, {floor_sats})"
  parent_job: "{original_job_id}"
  auto_publish: true
  labels: ["gap", "sla-breach", "urgent"]
```

### 3.2 Urgency Tiers

| Urgency | Trigger | Multiplier | Floor | Max Hours |
|---------|---------|:----------:|:-----:|:---------:|
| **Low** | Minor delay (< 2h) | 1.0x | 10K sats | 24h |
| **Medium** | Significant delay (2–12h) | 1.1x | 25K sats | 8h |
| **High** | Deadline missed (12–24h) | 1.2x | 50K sats | 4h |
| **Critical** | Systemic (>24h, multi-job) | 1.5x | 100K sats | 2h |

### 3.3 Example: High Urgency Gap Card

```yaml
gap_card:
  context: "sla_remediation"
  type: "gap_card"
  work_intent:
    description: "Fix critical path bug in AI inference pipeline (SLA breach remediation)"
    deadline: "2026-08-01T12:00:00Z"
    budget: 60000  # 50K * 1.2 = 60K sats
  parent_job: "JC-2026-0801-0042"
  labels: ["gap", "sla-breach", "urgent", "critical-path"]
  trust_tier: "Managed"
```

## 4. TrustTier Gating

### 4.1 Auto-Execution Matrix

| Action | ObserverOnly | Expedient | Managed | Strict |
|--------|:-----------:|:---------:|:-------:|:------:|
| Generate gap card | ❌ | ❌ | ✅ Auto | ✅ Auto |
| Reopen job card | ❌ | ✅ Manual | ✅ Auto | ✅ Auto |
| Flag builder (warn) | ❌ | ❌ | ✅ Auto | ✅ Auto |
| Flag builder (suspend) | ❌ | ❌ | ❌ | ✅ Auto |
| Reject settlement | ❌ Manual | ✅ Auto | ✅ Auto | ✅ Auto |
| Notify treasury | ❌ | ✅ Manual | ✅ Auto | ✅ Auto |
| Escalate priority | ❌ | ❌ | ✅ Auto | ✅ Auto |

### 4.2 Manual Override: ObserverOnly & Expedient

For ObserverOnly and Expedient tiers, gap cards are **created as drafts** and require manual approval. The SLA watcher:

1. Creates a draft gap card with `state: pending_approval`
2. Notifies the market operator via Linear/GitHub issue
3. Operator approves → gap card published to marketplace
4. Operator rejects → original job card escalated with note

## 5. Builder Reputation Integration

### 5.1 Reputation Impact

| Event | Score Change | Decay Period |
|-------|:-----------:|:------------:|
| SLA breach (gap card) | -10 | 90 days |
| Builder abandonment | -25 | 180 days |
| Gap card resolved by same builder | +5 | 30 days |
| 3+ quality disputes | -15 | 120 days |
| Consecutive SLA completions (5+) | +2 per job | 60 days |

### 5.2 Reputation → TrustTier Mapping

| Reputation Score | Eligible Tier | Gap Card Auto |
|:----------------:|:-------------:|:-------------:|
| 90–100 | Strict | ✅ |
| 70–89 | Managed | ✅ |
| 40–69 | Expedient | Manual approval |
| 0–39 | ObserverOnly | ❌ |
| <0 | Suspended | ❌ |

## 6. Monitoring & Alerting

### 6.1 SLA Watcher Metrics

| Metric | Description | Alert |
|--------|-------------|-------|
| `sla_gaps_total` | Total gap cards generated | >10/day triggers review |
| `sla_gap_resolution_time_p95` | P95 time to resolve gap card | >4h triggers escalation |
| `sla_builder_abandonment_rate` | % jobs abandoned | >5% triggers policy review |
| `sla_auto_approval_rate` | % gap cards auto-approved | <80% means too many manual |
| `sla_dispute_rate` | % jobs with quality disputes | >3% triggers builder audit |

### 6.2 Dashboard

```
┌──────────────────────────────────────────────────────────┐
│                SLA ENFORCEMENT DASHBOARD                  │
│                                                            │
│  Active JobCards:    47                                    │
│  SLA Compliant:      43 (91.5%)  [█████████░]             │
│  Gap Cards Open:      3 (6.4%)   [█░░░░░░░░░]             │
│  Disputed:            1 (2.1%)   [░░░░░░░░░░]             │
│                                                            │
│  Auto-Approval Rate: 87%  [████████░░]                    │
│  P95 Resolution:      2.3h [██████░░░░]                   │
│  Builder Abandonment: 1.8% [█░░░░░░░░░]                   │
│                                                            │
│  Recent Gap Cards:                                        │
│  ├── GC-0042: Critical path bug    2.1h ago  IN PROGRESS  │
│  ├── GC-0041: API timeout fix      5.3h ago  RESOLVED     │
│  └── GC-0040: Data pipeline gap   12.1h ago  RESOLVED     │
└──────────────────────────────────────────────────────────┘
```

---

*SLA enforcement is the immune system of the marketplace. Gap cards are the antibodies.*
