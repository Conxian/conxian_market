# CON-1427: Protocol Fee Collection — Implementation Plan

> **Issue:** [#488](https://github.com/Conxian/Conxian/issues/488) — Implement 2% Protocol Fee Collection
> **Status:** Research Complete → Implementation Phase | **Repo Map:** 4 affected | **Revenue Impact:** 71% of $21.1K/mo target

---

## 1. Executive Summary

CON-1427 is the **single highest-leverage P0** across the entire Conxian ecosystem. It alone recovers 71% of the projected $21,100/mo launch revenue by enabling protocol fee collection on the 4 production-ready settlement rails (ALEX/Stacks, sBTC, Lightning, Fedimint).

### Current State

| Component | Status | What Exists |
|-----------|:------:|-------------|
| Clarity fee contracts | ⚠️ Stub | `fee-manager.clar` is a no-op; `protocol-fee-collector.clar` is full but not called; `integration-fee-collector.clar` is full for partner billing |
| Gateway billing engine | ⚠️ Partial | 356-line MRR module tracks relay messages and uptime but has zero settlement integration |
| Market fee calculator | 🟡 Design | `trust_tier_pricing.md` §3 has TypeScript pseudocode — not implemented |
| Settlement → Fee pipeline | ⛔ Missing | No event triggers fee calculation; no calculation calls contracts |

### Target State

```
SettlementEvent (Gateway)
    │
    ▼
FeeCalculator (Market middleware)     ← trust_tier_pricing.md §3
    │  detectTrustTier(req) → calculateFee(amount, tier)
    │
    ▼
SettlementBillingBridge (Gateway)     ← NEW: billing.rs extension
    │  accumulateProtocolFee(event, fee)
    │  generateProtocolFeeReport(period)
    │
    ▼
Clarity Fee Contracts (Conxian)
    │  protocol-fee-collector.clar ← SIP-010 transfer
    │  fee-orchestrator.clar      ← 50/30/20 split
    │
    ▼
Treasury (conxius-platform)
       SAB treasury → Babylon staking (3-5% APY)
```

---

## 2. Architecture — 4-Component Pipeline

### 2.1 Market: FeeCalculator Middleware

**File:** `conxian_market/src/fee_calculator.ts` (new)

Implements the tier detection + fee calculation logic from `trust_tier_pricing.md` §2-3.

```typescript
// trust_tier_pricing.md §2 — Tier detection
function detectTrustTier(req: SettlementRequest): TrustTier

// trust_tier_pricing.md §3 — Fee calculation  
function calculateFee(amount: bigint, tier: TrustTier): bigint

// NEW — Rail-specific fee
function calculateRailFee(amount: bigint, tier: TrustTier, rail: SettlementRail): bigint

// NEW — Batch fee report
function generateFeeReport(events: SettlementEvent[]): FeeReport
```

**Key decisions:**
- Expedient tier: flat 2% (ALEX, sBTC, Lightning, Fedimint → all 2% except LN/Fedimint at 1%)
- Managed tier: +0.5% premium for Statechain, sBTC, RGB, Babylon rails
- Strict tier: negotiated, not computed here
- Fee is calculated in market middleware, forwarded to gateway as `X-Conxian-Fee` header

### 2.2 Gateway: SettlementBillingBridge

**File:** `conxian-gateway/internal/engine/src/billing.rs` (extension of existing 356 lines)

Extends the billing module with protocol fee accumulation:

```rust
// NEW structs
pub struct ProtocolFeeRecord {
    pub settlement_id: String,
    pub rail: SettlementRail,
    pub tier: TrustTier,
    pub amount: u64,         // satoshis
    pub fee_amount: u64,      // satoshis (2% = amount * 200 / 10000)
    pub fee_rate_bps: u16,    // 200 = 2%, 100 = 1%, 250 = 2.5%
    pub timestamp: i64,
    pub builder_id: String,
    pub tx_id: Option<String>,
}

pub struct ProtocolFeeReport {
    pub period: BillingPeriod,
    pub total_settled: u64,
    pub total_fees: u64,
    pub by_rail: HashMap<SettlementRail, RailFeeBreakdown>,
    pub by_tier: HashMap<TrustTier, u64>,
    pub records: Vec<ProtocolFeeRecord>,
}

// NEW function
pub fn accumulate_protocol_fee(
    records: &mut Vec<ProtocolFeeRecord>,
    settlement: &SettlementEvent,
    tier: TrustTier,
    fee_amount: u64,
)

pub fn generate_protocol_fee_report(
    period: BillingPeriod,
    records: &[ProtocolFeeRecord],
) -> ProtocolFeeReport
```

### 2.3 Gateway → Conxian: Fee Settlement Contract Call

**Integration point:** Gateway's `stacks/contract_bridge.rs` or `stacks/alex.rs`

```rust
// Pseudocode for contract-bridge fee settlement
pub async fn settle_protocol_fee(
    &self,
    fee_report: &ProtocolFeeReport,
) -> Result<TxId, BridgeError> {
    let contract = "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.protocol-fee-collector";
    let function = "collect-protocol-fee";

    // Call protocol-fee-collector.clar with:
    // - source: identified by integration ID
    // - stream: settlement-rail stream ID
    // - amount: total fees in sats
    // - asset: STX or sBTC (SIP-010)

    let tx = self.stacks_client
        .contract_call(contract, function, &[
            fee_report.total_fees,
            fee_report.period.start,
            fee_report.period.end,
        ])
        .await?;

    Ok(tx.txid)
}
```

### 2.4 Conxian: Fee Distribution (50/30/20)

**File:** `contracts/vaults/fee-orchestrator.clar` (needs activation)

```clarity
;; 50% → Operations (protocol-fee-collector principal)
;; 30% → Founders (vesting contract, 4-year cliff)  
;; 20% → Ecosystem (grants multisig)
;;
;; Called by protocol-fee-collector after successful sweep
(define-public (distribute-protocol-fees (amount uint))
  (let (
    (ops-share (/ (* amount u50) u100))       ;; 50%
    (founders-share (/ (* amount u30) u100))   ;; 30%
    (eco-share (- amount ops-share founders-share)) ;; 20%
  )
  ;; ... transfer ops-share to operations wallet
  ;; ... transfer founders-share to vesting contract
  ;; ... transfer eco-share to grants multisig
  (ok true)
))
```

---

## 3. Rail-Specific Fee Rates

| Rail | Expedient | Managed | Strict | Notes |
|------|:--------:|:-------:|:------:|-------|
| ALEX/Stacks | 2% (200 bps) | 2% | Negotiated | Primary swap settlement |
| sBTC | 2% (200 bps) | 2.5% | Negotiated | BTC peg-in/out |
| Lightning | 1% (100 bps) | 1% | Negotiated | LN routing fees already apply |
| Fedimint | 1% (100 bps) | 1% | Negotiated | Community bears ops cost |
| EVM (ERC-8183) | 2% (200 bps) | 2.5% | Negotiated | Programmable escrow |
| Statechain | N/A | 2% (200 bps) | Negotiated | Gated on FROST audit (#260) |
| RGB | N/A | 2% (200 bps) | Negotiated | Partial (stash #228) |
| Babylon | N/A | 0.5% (yield share) | Negotiated | Treasury only, not settlement |

> Fee rates match `SETTLEMENT_RAILS.md` rail comparison table §9 and `trust_tier_pricing.md` §3.

---

## 4. Implementation Phases

### Phase A: Fee Calculator (Market) — Day 1-2

- [ ] Create `conxian_market/src/fee_calculator.ts`
- [ ] Implement `detectTrustTier()` from `trust_tier_pricing.md` §2
- [ ] Implement `calculateFee()` with rail-specific rates
- [ ] Implement `calculateRailFee()` with per-rail overrides
- [ ] Write tests: all 4 tiers × 8 rails = 32 scenarios
- [ ] Export as npm package `@conxian/fee-calculator`

### Phase B: Settlement Bridge (Gateway) — Day 3-5

- [ ] Extend `billing.rs` with `ProtocolFeeRecord` and `ProtocolFeeReport`
- [ ] Implement `accumulate_protocol_fee()`
- [ ] Implement `generate_protocol_fee_report()`
- [ ] Wire to settlement event stream in engine
- [ ] Add `/api/v1/admin/protocol-fees` endpoint
- [ ] Add Prometheus metrics: `conxian_protocol_fees_total`, `conxian_protocol_fees_by_rail`

### Phase C: Contract Activation (Conxian) — Day 6-8

- [ ] Replace `fee-manager.clar` stub with real distribution logic
- [ ] Activate `fee-orchestrator.clar` with 50/30/20 split
- [ ] Wire `protocol-fee-collector.clar` to receive from gateway
- [ ] Register settlement rail stream IDs
- [ ] Testnet deployment + integration test with gateway

### Phase D: Treasury Integration — Day 9-10

- [ ] Connect collected fees to SAB treasury
- [ ] Babylon staking: auto-stake 25% of treasury balance
- [ ] Treasury dashboard queries: `monitoring.md` §4
- [ ] Monthly transparency report: `MARKET-001` (#8)

---

## 5. Revenue Impact Projection

| Phase | What Ships | Monthly Revenue | Cumulative |
|:-----:|-----------|:--------------:|:----------:|
| **Current** | No fee collection | $1,500 | 7% |
| **A+B** | Expedient fee calculator + billing bridge (no contract) | $0 (tracked only) | 7% |
| **A+B+C** | Contracts activated + gateway wired | $15,000 | 71% |
| **+Attestation P0** | Managed tier operational | $20,600 | 98% |
| **+D** | Treasury auto-staking + dashboard | $21,100 | 100% |

> Phase A+B delivers the tracking infrastructure. Phase C is the actual revenue unlock.

---

## 6. Dependencies

| Dependency | Status | Blocker? |
|-----------|:------:|:--------:|
| Gateway CI/CD (#222) | P1 | No — billing.rs already compiles |
| Stacks testnet access | ✅ | No |
| Clarity contract deployment keys | Needs ops | Yes — phase C gate |
| Partnership fee policy (#527) | P1 | No — 2% protocol fee is independent |
| Enclave attestation (#240-#242) | P0 | No — Expedient rails work without attestation |
| Fee manager contract (#496) | P1 | Yes for 50/30/20 split, Phase D |

---

## 7. Test Plan

### Market Fee Calculator (Phase A)
- `detectTrustTier`: mock 4 header combinations → 4 tiers
- `calculateFee`: 100K sats @ 2% = 2,000 sats; 100K @ 1% = 1,000 sats; 100K @ 2.5% = 2,500 sats
- `calculateRailFee`: Lightning @ Expedient → 1%; sBTC @ Managed → 2.5%
- `generateFeeReport`: 10 settlement events → aggregated by rail + tier

### Gateway Bridge (Phase B)
- Unit: `accumulate_protocol_fee` correctly sums records
- Unit: `generate_protocol_fee_report` aggregates by rail and tier
- Integration: settlement event → fee accumulated → report generated
- Integration: `/api/v1/admin/protocol-fees` returns JSON report

### Contract Integration (Phase C)
- Testnet: gateway calls `protocol-fee-collector.clar` → STX transferred
- Testnet: `fee-orchestrator.clar` distributes 50/30/20
- Testnet: full settlement → fee → distribution cycle
- Mainnet: 1-week shadow mode (track only, no transfer) → review → activate

---

*"CON-1427 isn't a feature. It's the engine that funds everything else."*
