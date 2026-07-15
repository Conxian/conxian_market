# Treasury Deployment Implementation Guide

> **Status:** Implementation Ready | **Date:** 2026-07-15  
> **Phase:** Phase 0 - Pre-Launch | **Owner:** Conxian Labs

---

## Executive Summary

This guide provides step-by-step implementation for deploying the **3-of-5 multisig treasury** following the SAB wallet architecture defined in `SAB_WALLET_ARCHITECTURE_AND_CONTROL_MATRIX.md`.

**Key Principle:** Custody lives in contract principals, NOT in human wallets.

---

## 1. Pre-Deployment Checklist

### 1.1 Required Components

| Component | Repository | Status |
|:----------|:-----------|:-------|
| **PROTOCOL_VAULTS** | Conxian/Conxian | To be deployed |
| **SAB_TREASURY_MS** | Conxian/Conxian | To be configured |
| **DAO_TIMELOCK** | Conxian/Conxian | To be configured |
| **Conxius Wallet** | conxius-wallet | v1.9.5 ready |
| **Conxius Enclave SDK** | conxius-enclave-sdk | v2.0.12 ready |
| **Orbit CLI** | conxius-orbit | Ready |

### 1.2 Prerequisites

- [ ] SAB signer set identified (5 members required)
- [ ] Each signer has Conxius Wallet provisioned
- [ ] Hardware security confirmed (TEE/StrongBox)
- [ ] Key ceremony scheduled
- [ ] FROST DKG infrastructure ready
- [ ] Emergency contacts documented (off-Git, ZSE compliant)

---

## 2. Stage 1: Define SAB Signer Set

### 2.1 Signer Requirements

```
SAB TREASURY MULTISIG: 3-of-5
├── Signer 1: [Identity TBD]
├── Signer 2: [Identity TBD]
├── Signer 3: [Identity TBD]
├── Signer 4: [Identity TBD]
└── Signer 5: [Identity TBD]

Emergency Set:
├── SAB_EMERGENCY_PAUSE: 2-of-3
└── SAB_EMERGENCY_RECOVERY: 3-of-5
```

### 2.2 Signer Criteria

| Criteria | Requirement |
|:---------|:-----------|
| **Geographic distribution** | Minimum 3 different jurisdictions |
| **Role diversity** | Mix of technical and governance |
| **Independence** | No more than 2 from same organization |
| **Availability** | 24/7 for emergency response |
| **Security** | TEE/HSM-capable device required |

### 2.3 Signer Onboarding

```bash
# 1. Provision Conxius Wallet for each signer
pnpm --filter @conxius/wallet install
pnpm --filter @conxius/wallet dev

# 2. Enable TEE/StrongBox security
# Settings > Security > Enable Hardware Security

# 3. Export public key for FROST DKG
conxius-cli key export --public --signer <signer_id>
```

---

## 3. Stage 2: Deploy PROTOCOL_VAULTS

### 3.1 Contract Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PROTOCOL VAULTS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    TREASURY-VAULT                                │    │
│  │  • Passive collection only                                        │    │
│  │  • No outbound transfers                                          │    │
│  │  • Protocol fee destination                                       │    │
│  │  • Balance: [PROTOCOL_FEES]                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                            │
│                              ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    SAB-TREASURY-MS                               │    │
│  │  • 3-of-5 SAB multisig                                           │    │
│  │  • Medium spend limit                                              │    │
│  │  • Operational expenses                                            │    │
│  │  • Monthly allocation: $20,000                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                            │
│                              ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    DAO-TREASURY-MS                               │    │
│  │  • 5-of-7 DAO multisig                                           │    │
│  │  • High spend limit                                               │    │
│  │  • Long-term reserves                                             │    │
│  │  • Reserve rebalancing                                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Deployment Commands

```bash
# Navigate to Conxian protocol repo
cd ../Conxian

# Deploy PROTOCOL_VAULTS using Orbit CLI
conxius-orbit deploy \
  --contract treasury-vault \
  --network mainnet \
  --admin SAB_DEPLOYER_MULTISIG

conxius-orbit deploy \
  --contract sab-treasury-ms \
  --network mainnet \
  --signers "signer1,signer2,signer3,signer4,signer5" \
  --threshold 3

conxius-orbit deploy \
  --contract dao-treasury-ms \
  --network mainnet \
  --signers "dao1,dao2,dao3,dao4,dao5,dao6,dao7" \
  --threshold 5

# Verify deployment
conxius-orbit verify --contract treasury-vault --network mainnet
```

### 3.3 Initial Configuration

```clarity
;; treasury-vault.clar configuration
(impl-trait 'SP3...treasury-trait)

;; Set protocol fee recipient
(set-protocol-fee-recipient .sab-treasury-ms)

;; Configure fee allocation
(set-fee-allocation
  {
    operations: u50,
    founders: u30,
    ecosystem: u20
  }
)

;; Enable fee collection (CON-1427)
(enable-protocol-fees true)
```

---

## 4. Stage 3: Configure FROST DKG Key Ceremony

### 4.1 FROST DKG Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FROST DKG KEY CEREMONY                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Round 1: Commitment                                                        │
│  ├── Each signer generates commitment (DLEQ proof)                       │
│  └── Broadcasts commitment to all other signers                         │
│                                                                          │
│  Round 2: Share Distribution                                              │
│  ├── Each signer computes shares for all other signers                   │
│  └── Uses Feldman's VSS                                                  │
│                                                                          │
│  Round 3: Share Verification                                              │
│  ├── Each signer verifies received shares                                 │
│  └── Publishes verification result                                       │
│                                                                          │
│  Round 4: Key Generation                                                  │
│  ├── All signers compute public key                                      │
│  └── Each signer has share for signing                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Implementation via Enclave SDK

```rust
// Using conxius-enclave-sdk for FROST DKG
use conxius_enclave_sdk::{FrostDkg, KeyPackage};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize FROST DKG for 3-of-5
    let frost = FrostDkg::new(3, 5)?;
    
    // Signer 1: Round 1 - Generate commitment
    let commitment_1 = frost.generate_commitment()?;
    
    // Signer 2: Round 1 - Generate commitment  
    let commitment_2 = frost.generate_commitment()?;
    
    // Signer 3: Round 1 - Generate commitment
    let commitment_3 = frost.generate_commitment()?;
    
    // ... all 5 signers generate commitments ...
    
    // Round 2: Each signer distributes shares
    let shares = frost.distribute_shares(&[commitment_1, commitment_2, commitment_3, commitment_4, commitment_5])?;
    
    // Round 3: Verify shares
    let verified = frost.verify_shares(&shares)?;
    
    // Round 4: Generate signing key
    let key_package = frost.generate_key_package(&verified)?;
    
    // Store key package in TEE
    key_package.store_in_enclave()?;
    
    Ok(())
}
```

### 4.3 MuSig2 Aggregate Signing

```rust
// Using conxius-enclave-sdk for MuSig2
use conxius_enclave_sdk::{MuSig2, PartialSignature};

fn sign_transaction(
    key_packages: Vec<KeyPackage>,
    message: &[u8],
) -> Result<AggregatedSignature, Error> {
    // Create MuSig2 session
    let musig = MuSig2::new();
    
    // Generate nonces
    let nonces: Vec<Nonce> = key_packages
        .iter()
        .map(|kp| musig.generate_nonce(kp))
        .collect();
    
    // Compute aggregate nonce
    let agg_nonce = musig.aggregate_nonces(&nonces)?;
    
    // Create partial signatures
    let partial_sigs: Vec<PartialSignature> = key_packages
        .iter()
        .map(|kp| musig.partial_sign(kp, &agg_nonce, message))
        .collect();
    
    // Aggregate signatures
    let signature = musig.aggregate_signatures(&partial_sigs)?;
    
    Ok(signature)
}
```

---

## 5. Stage 4: Connect DAO_TIMELOCK

### 5.1 Timelock Configuration

```clarity
;; dao-timelock.clar configuration
(impl-trait 'SP3...timelock-trait)

;; Set minimum delay (48 hours = 288 blocks on Stacks)
(set-min-delay u288)

;; Configure governance contract
(set-governance-contract .dao-governance)

;; Set DAO policy authority
(set-policy-authority .dao-policy-ms)
```

### 5.2 Policy Governance Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DAO POLICY FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. PROPOSE                                                            │
│     └── DAO_POLICY_AUTHORITY submits proposal                            │
│                                                                          │
│  2. QUEUE                                                              │
│     └── Proposal queued in DAO_TIMELOCK                                 │
│          └── Minimum 48-hour delay (288 blocks)                         │
│                                                                          │
│  3. WAIT                                                               │
│     └── Community review period                                          │
│                                                                          │
│  4. EXECUTE                                                            │
│     └── Anyone can execute after delay                                   │
│          └── Changes applied to protocol contracts                       │
│                                                                          │
│  5. VERIFY                                                             │
│     └── On-chain verification via conxian-nexus                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Stage 5: Configure Emergency Controls

### 6.1 Emergency Multisig Setup

```bash
# Deploy emergency pause multisig (2-of-3)
conxius-orbit deploy \
  --contract sab-emergency-pause-ms \
  --network mainnet \
  --signers "guardian1,guardian2,guardian3" \
  --threshold 2

# Deploy emergency recovery multisig (3-of-5)
conxius-orbit deploy \
  --contract sab-emergency-recovery-ms \
  --network mainnet \
  --signers "guardian1,guardian2,guardian3,guardian4,guardian5" \
  --threshold 3

# Configure pause triggers
conxius-orbit configure \
  --contract treasury-vault \
  --pause-trigger sab-emergency-pause-ms
```

### 6.2 Emergency Actions Matrix

| Scenario | Authority | Action |
|:---------|:----------|:-------|
| **Smart contract exploit** | SAB_EMERGENCY_PAUSE_MS | Pause affected contracts |
| **Key compromise** | SAB_EMERGENCY_RECOVERY_MS | Rotate compromised keys |
| **Oracle failure** | SAB_EMERGENCY_PAUSE_MS | Pause price-dependent contracts |
| **Regulatory action** | DAO_POLICY_AUTHORITY | Legal response via DAO_TIMELOCK |

---

## 7. Stage 6: Integrate with Protocol Contracts

### 7.1 CON-1427 Fee Collection

```clarity
;; Update conxian-access.clar
(impl-trait 'SP3...access-trait)

;; Set treasury as protocol fee recipient
(set-protocol-fee-recipient .treasury-vault)

;; Configure fee parameters
(set-protocol-fee
  {
    rate: u200,      ;; 2% (200 basis points)
    min-volume: u1000000,  ;; Minimum $1 volume
    recipient: .treasury-vault
  }
)

;; Enable fee collection
(enable-fee-collection true)
```

### 7.2 Fee Distribution Configuration

```clarity
;; Configure automatic fee distribution
(set-fee-distribution
  {
    operations: {
      wallet: .sab-treasury-ms,
      percentage: u50,
      vesting: none
    },
    founders: {
      wallet: .sab-treasury-ms,
      percentage: u30,
      vesting: {
        cliff: 31536000,  ;; 1 year
        duration: 126144000  ;; 4 years
      }
    },
    ecosystem: {
      wallet: .sab-treasury-ms,
      percentage: u20,
      vesting: none
    }
  }
)
```

### 7.3 ALEX Settlement Integration

```bash
# Configure ALEX as primary settlement venue
conxius-orbit configure \
  --settlement alex \
  --network mainnet \
  --pools sBTC-USDC,STX-USDC \
  --vault treasury-vault

# Enable sBTC/USDC settlement pools
conxius-orbit configure \
  --settlement alex \
  --enable-pools true
```

---

## 8. Verification & Testing

### 8.1 Pre-Launch Verification Checklist

```bash
#!/bin/bash
# verify_treasury_setup.sh

echo "=== TREASURY SETUP VERIFICATION ==="

# 1. Verify contract deployments
echo "[1/7] Verifying contract deployments..."
conxius-orbit verify --contract treasury-vault --network mainnet
conxius-orbit verify --contract sab-treasury-ms --network mainnet
conxius-orbit verify --contract dao-treasury-ms --network mainnet
conxius-orbit verify --contract dao-timelock --network mainnet

# 2. Verify multisig configuration
echo "[2/7] Verifying multisig configuration..."
conxius-orbit verify --multisig sab-treasury-ms --threshold 3 --signers 5

# 3. Verify FROST DKG key ceremony
echo "[3/7] Verifying FROST DKG..."
conxius-enclave-sdk verify-key-ceremony --session-id <session>

# 4. Verify emergency controls
echo "[4/7] Verifying emergency controls..."
conxius-orbit verify --contract emergency-pause --network mainnet
conxius-orbit verify --contract emergency-recovery --network mainnet

# 5. Verify CON-1427 fee collection
echo "[5/7] Verifying fee collection..."
conxius-orbit verify --feature protocol-fees --network mainnet

# 6. Verify ALEX integration
echo "[6/7] Verifying ALEX integration..."
conxius-orbit verify --settlement alex --network mainnet

# 7. Verify bootstrap removal
echo "[7/7] Verifying bootstrap removal..."
python3 scripts/verify_bos_production_boundary.py
python3 scripts/verify_contamination_guard.py

echo "=== VERIFICATION COMPLETE ==="
```

### 8.2 Test Scenarios

| Test | Expected Result | Pass Criteria |
|:-----|:---------------|:-------------|
| **Single signer send** | REJECTED | 1-of-5 fails |
| **Two signer send** | REJECTED | 2-of-5 fails |
| **Three signer send** | APPROVED | 3-of-5 succeeds |
| **Emergency pause** | APPROVED | 2-of-3 succeeds |
| **Emergency recovery** | APPROVED | 3-of-5 succeeds |
| **Bootstrap key send** | REJECTED | Bootstrap removed |

---

## 9. Handoff Execution

### 9.1 SAB Handoff Protocol (From SAB_DAO_HANDOFF_PROTOCOL.md)

| Step | Action | Verification |
|:-----|:-------|:------------|
| **P-1** | Document all SAB wallet principals | ✅ Completed |
| **P-2** | Replace hardcoded principals with SAB | ✅ Completed |
| **H-1** | Deploy governance-handover contract | ⬜ Execute |
| **H-2** | Initiate ownership transfer | ⬜ Execute |
| **H-3** | SAB signers claim ownership | ⬜ Execute |
| **V-1** | Verify no bootstrap in privileged roles | ⬜ Verify |

### 9.2 Final Verification

```bash
# Run final verification
python3 scripts/verify_bos_production_boundary.py

# Expected output:
# [✓] BOOTSTRAP_OPERATOR_WALLET: NOT FOUND in privileged roles
# [✓] All admin/owner roles: SAB-controlled
# [✓] All emergency authorities: Configured
# [✓] All vaults: Contract principals only
# [✓] ZSE Compliance: PASSED
```

---

## 10. Operations Runbook

### 10.1 Routine Treasury Operations

| Operation | Authority | Process |
|:----------|:----------|:-------|
| **Operational spend < $10K** | SAB 3-of-5 | Submit → Approve → Execute |
| **Operational spend $10K-$50K** | SAB 3-of-5 + DAO approval | Submit → DAO vote → Execute |
| **Reserve rebalancing** | DAO 5-of-7 | Propose → Timelock → Execute |
| **Fee parameter change** | DAO via TIMELOCK | Propose → 48hr → Execute |

### 10.2 Monthly Reporting

```bash
# Generate treasury report
conxius-orbit report --treasury --period monthly \
  --output treasury-report-$(date +%Y-%m).json

# Report includes:
# - Total holdings by asset
# - Fee collection summary
# - Operational spending
# - Ecosystem distributions
# - Runway calculation
```

### 10.3 Quarterly Audits

- Third-party treasury audit (required)
- FROST DKG key ceremony review
- Emergency response drill
- ZSE compliance audit
- Security assessment

---

## 11. Success Metrics

### 11.1 Treasury Health Dashboard

| Metric | Target | Warning | Critical |
|:-------|:------:|:-------:|:--------:|
| **Runway** | 12+ months | 6 months | 3 months |
| **Daily Volume** | $33K+ | $15K | $5K |
| **Protocol Revenue** | $20K/month | $10K/month | $3K/month |
| **Stablecoin %** | 40%+ | 25% | 15% |
| **Multisig Quorum** | 3-of-5 | 2-of-5 | <2 |

### 11.2 Key Performance Indicators

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TREASURY KPI DASHBOARD                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Month: July 2026                                                       │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  RUNWAY         │  │  MONTHLY REVENUE  │  │  ACTIVE BUILDERS │   │
│  │  14 months      │  │  $24,500         │  │  42             │   │
│  │  [████████████░] │  │  [████████████░] │  │  [██████████░░] │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  DAILY VOLUME    │  │  STABLECOIN %    │  │  MULTISIG STATUS │   │
│  │  $41,200        │  │  45%            │  │  3-of-5 HEALTHY  │   │
│  │  [█████████████] │  │  [███████████░] │  │  [█████████████] │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## References

- [SAB_WALLET_ARCHITECTURE_AND_CONTROL_MATRIX.md](https://github.com/Conxian/conxian-business/blob/main/docs/SAB_WALLET_ARCHITECTURE_AND_CONTROL_MATRIX.md)
- [SAB_DAO_HANDOFF_PROTOCOL.md](https://github.com/Conxian/conxian-business/blob/main/docs/SAB_DAO_HANDOFF_PROTOCOL.md)
- [CON-1427 Implementation](https://linear.app/conxian/issue/CON-1427)
- [Conxius Enclave SDK](https://crates.io/crates/conxius-enclave-sdk)

---

*This guide implements the treasury deployment following SAB wallet architecture. Execute Stage by Stage and verify before proceeding.*
