# Conxian Governance: The Sovereign Standard

## 1. The Multi-Dimensional Mandate
Every module and agent in the Conxian Marketplace must adhere to the **Multi-Dimensional Scaling** rule:
- **DeFi Neutrality:** Conxian does not build or mandate proprietary DeFi primitives. Governance will prioritize integrations with established, audited external rails.
- **Cost Independence:** The operational cost of an agent must be borne by the *User* (Local Inference) or the *Agent Provider*. The Conxian Hub acts strictly as a **Thin Orchestrator**.

## 2. Sovereign Infrastructure Requirements
To be listed as a "Sovereign" module, the following mandates must be fulfilled:
- **BYOK (Bring Your Own Key):** The module must allow users to provide their own API keys or point to a local inference node.
- **Deployment Optionality:** Codebases must be portable across Cloud, Edge, and **On-Prem Sovereign Servers** to ensure client choice and data privacy.
- **MCP Native:** All agent communication must use the **Model Context Protocol (MCP)** to ensure state portability across diverse orchestration environments.
- **ZK-Compliant:** Transactions must generate ZK-proofs of correctness, allowing for "Auditing without Surveillance."

## 3. The Builder Revenue Matrix
Conxian prices settlements by **product**, not by one flat rate ([ADR-007](adr/ADR_007_TWO_PRODUCT_RATE_MODEL.md)):
- **Product B — matched job:** the platform takes **10%** of gross; the builder keeps **90%**. This is the marketplace product (job card, escrow, trust-tier attestation, SLA, dispute).
- **Product A — rail settlement:** the platform takes the [ADR-005](adr/ADR_005_COMPETITIVE_RATES_WITH_COST_RECOVERY.md) dynamic fee (`0.50% → 0.10%` + per-rail cost floor); the builder keeps the rest. This is the raw pass-through product (x402 / MCP-402 call, M2M packet, direct transfer).
- Routing is **fail-closed** to the matched-job rate when a settlement cannot be classified.

The **80/10/10 of gross** builder matrix (ADR-001 §1.1) is **retired**; it implied a ~20% take that contradicted the rail rate.

### 3.1 Protocol Fee Structure (Revenue Standards)
| Fee Component | Rate | Allocation |
|:--------------|:----:|:-----------|
| **Product B — matched job** | 10% of gross | builder keeps 90%; take splits 50/30/20 |
| **Product A — rail settlement** | ADR-005 dynamic | Volume-decay 0.50%→0.10% + per-rail floor (governance-adjustable) |
| **Platform take split** | 50/30/20 | Operations / Founder Vesting / Ecosystem Growth |

The split is applied to the **platform's take**, whatever the product is — there is exactly one split rule.

### 3.2 Fee Adjustment Governance
- **Rate Changes:** Require 60% DAO approval with 7-day voting period
- **Emergency Pause:** Multisig can pause fees with 48-hour notice
- **Automatic Decay:** Volume-based (ADR-005 `VOLUME_DECAY_BPS`), floor 0.10% + per-rail flat cost

## 4. Treasury Management Governance
### 4.1 Asset Standards
| Asset Class | Target % | Purpose |
|:------------|:--------:|:--------|
| Stablecoins | 40% | Operations runway |
| RWA/T-Bills | 30% | Low-vol yield |
| Liquid Staking | 20% | Yield generation |
| Native Token | 10% | Governance alignment |

### 4.2 Controls
- **Multisig:** 3-of-5 SAFE multisig for treasury operations
- **Timelock:** 48-hour delay for transactions >$50,000
- **Veto Rights:** DAO can pause via 60% vote
- **Transparency:** Monthly treasury reporting required

## 5. Settlement Rail Standards
Governance prioritizes these settlement rails:
1. **ALEX (Stacks/Bitcoin):** Primary launchpad and sBTC settlement
2. **ERC-8183 Escrow:** Programmable settlement for EVM chains
3. **Fedimint/Citrea:** Bitcoin L2 industrial adapters
4. **Uniswap/ALEX:** Liquidity pooling for stable settlement

## 6. Discarding the Stubs & Proprietary Debt
Governance will actively vote to **Discard** any proprietary DeFi development (conxian/conxian) in favor of external rail adapters. We prioritize **Functional Depth** in orchestration and settlement security over architectural breadth.
