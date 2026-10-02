# Changelog

All notable changes to the Conxian Market SDK (`@conxian/market-sdk`) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2026-10-02

### Added
- **Dynamic Hybrid Fee Floor & System Load Self-Adjustment Engine (ADR-004)**: Implemented `calculateDynamicFee`, `calculateVolumeDecayedBps`, `getRailDefaultFlatFloor`, and `projectDynamicRevenueScenario` in `src/fee_calculator.ts`.
- **Zero-Value Trap Protection**: Enforced rail-specific flat satoshi floors (`Lightning`: 10 sats, `Statechain`/`Fedimint`: 25 sats, `RGB`: 20 sats, `sBTC`/`AlexStacks`/`Babylon`: 50 sats, `EVM`: 100 sats) to protect protocol nodes against micro-payment payload resource exhaustion.
- **Logarithmic 30-Day Volume Decay Curve**: Automated base fee rate decay ($200\text{ bps} \to 150\text{ bps} \to 75\text{ bps} \to 25\text{ bps}$) for high-velocity M2M autonomous agent transactions while preserving a 10 bps minimum percentage floor.
- **Dynamic System Load Scaling**: Integrated `systemLoadFactor` ($1.0\times - 3.0\times$) to dynamically adjust settlement fees under peak network congestion and mempool load.
- **Enterprise Dedicated Pipe Subscription Capping**: Supported fee capping for enterprise subscription clients down to flat satoshi execution floors.
- **SDK Bridge Integration**: Exposed dynamic fee calculator and revenue projection tools on `ConxianMarketSDK` (`src/sdk_bridge.ts`).
- **Research & Architectural Specifications**: Created `docs/research/SESSION_71_RESEARCH_EXPANSION_AND_GAP_MATRIX.md` and `docs/adr/ADR_004_DYNAMIC_FEE_FLOOR_MODEL.md`.
- **Unit Test Coverage**: Added comprehensive unit tests in `tests/fee_calculator.test.ts` and `tests/sdk_bridge.test.ts` verifying 164 passing tests across the repository.

## [0.2.2] - 2026-09-19

### Added
- **Org-Wide SLA Positioning Strategy**: Conducted critical research and evaluation on Conxian GitHub ecosystem SLA positioning, separating immutable protocol primitives (No-SLA open-source) from B2B enterprise gateway wrappers.
- **Enterprise SLA Policy Evaluator & Exemption Engine**: Implemented `evaluateSlaPolicyAndExemptions` in `ClientInstallerEngine` (`src/client_onboarding.ts`) to evaluate tier-based SLA coverage, open-source disclaimers, support windows (NBD vs. 2h Ack), and statutory exemptions (force majeure, L1 halts, TEE deprecations).
- **SDK Bridge Integration**: Wired `evaluateSlaPolicyAndExemptions` onto `ConxianMarketSDK` (`src/sdk_bridge.ts`) and re-exported types in `src/index.ts`.
- **Research Expansion Matrix**: Created `docs/research/SESSION_69_RESEARCH_EXPANSION_AND_GAP_MATRIX.md` detailing the SLA positioning strategy, gap register, and weighted candidate scoring matrix.
- **Unit Test Coverage**: Added dedicated unit test suite in `tests/client_onboarding_sla_policy.test.ts` verifying 132 passing tests.

## [0.2.1] - 2026-09-17

### Added
- **Autonomous ERC-8183 Escrow Reconciliation**: Implemented `reconcileJobCardEscrow` in `JobCardEscrowEngine` (`src/job_card_escrow.ts`) to validate CJCS job card states against expected status and on-chain escrow states.
- **Non-Custodial Settlement Proof Verification**: Implemented `verifyNonCustodialSettlementProof` in `SettlementOrchestrator` (`src/settlement.ts`) to verify TEE, ZK, and SPV attestation proofs without central hub private key usage.
- **SDK Bridge Wiring**: Wired `reconcileJobCardEscrow` and `verifyNonCustodialSettlementProof` into `ConxianMarketSDK` (`src/sdk_bridge.ts`) and exported interface types in `src/index.ts`.
- **Research Expansion Matrix**: Created `docs/research/SESSION_65_RESEARCH_EXPANSION_AND_GAP_MATRIX.md` with issue mapping and weighted candidate scoring matrix.
- **Unit Test Suite Expansion**: Added unit tests in `tests/job_card_escrow.test.ts` and `tests/settlement.test.ts` verifying 117 passing tests.

## [0.2.0] - 2026-09-16

### Added
- Master Reconnaissance & Architecture Review in Session 64.
- `verifyDomainRoutingFirewall` in `src/client_onboarding.ts` enforcing domain isolation between `conxian.org` and `conxian-labs.com`.
