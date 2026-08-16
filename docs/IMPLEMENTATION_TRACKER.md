# Session 48 → Session 49 Implementation Tracker

> **Generated:** 2026-08-01 | **Source:** `CROSS_REPO_GAP_ANALYSIS_SESSION_48.md` | **Auto-run Approved**
> **Updated:** 2026-08-16 | **Current issue reality:** GitHub issue states were reviewed directly for the active org repos. The execution path is now aligned to the live backlog, not stale session notes.

---

## Current org issue reality

The live issue set shows this direct implementation path is active and relevant:

1. **Conxian/Conxian** — active priority work: [#488](https://github.com/Conxian/Conxian/issues/488), [#527](https://github.com/Conxian/Conxian/issues/527), [#530](https://github.com/Conxian/Conxian/issues/530), [#532](https://github.com/Conxian/Conxian/issues/532), [#507](https://github.com/Conxian/Conxian/issues/507), [#500](https://github.com/Conxian/Conxian/issues/500), [#515](https://github.com/Conxian/Conxian/issues/515)
2. **conxian-gateway** — previously completed follow-on work includes [#306](https://github.com/Conxian/conxian-gateway/issues/306), [#228](https://github.com/Conxian/conxian-gateway/issues/228), and [#220](https://github.com/Conxian/conxian-gateway/issues/220); no active blocker remains in this repo for the market layer from that list.
3. **conxius-platform** — active org hardening work: [#1082](https://github.com/Conxian/conxius-platform/issues/1082), [#854](https://github.com/Conxian/conxius-platform/issues/854), [#1223](https://github.com/Conxian/conxius-platform/issues/1223), [#1212](https://github.com/Conxian/conxius-platform/issues/1212)
4. **conxius-enclave-sdk** — active P0 blockers: [#242](https://github.com/Conxian/conxius-enclave-sdk/issues/242), [#241](https://github.com/Conxian/conxius-enclave-sdk/issues/241), [#240](https://github.com/Conxian/conxius-enclave-sdk/issues/240), [#202](https://github.com/Conxian/conxius-enclave-sdk/issues/202), [#200](https://github.com/Conxian/conxius-enclave-sdk/issues/200), [#267](https://github.com/Conxian/conxius-enclave-sdk/issues/267), [#271](https://github.com/Conxian/conxius-enclave-sdk/issues/271)
5. **conxius-wallet** — active wallet safety work: [#444](https://github.com/Conxian/conxius-wallet/issues/444), [#357](https://github.com/Conxian/conxius-wallet/issues/357), [#356](https://github.com/Conxian/conxius-wallet/issues/356)
6. **conxian-business** — the earlier migration issues are closed; the remaining active strategic work is [#989](https://github.com/Conxian/conxian-business/issues/989)
7. **conxian_market** — the market repo is effectively stabilized; the only active issue in this repo is [#8](https://github.com/Conxian/conxian_market/issues/8)

This repo should remain focused on the value layer while upstream repos resolve the enabling infrastructure.

---

## Priority execution chain

The current live execution chain is:

1. **Revenue activation**: [#488](https://github.com/Conxian/Conxian/issues/488), [#527](https://github.com/Conxian/Conxian/issues/527), [#530](https://github.com/Conxian/Conxian/issues/530), [#532](https://github.com/Conxian/Conxian/issues/532)
2. **Org enforcement**: [#1082](https://github.com/Conxian/conxius-platform/issues/1082), [#854](https://github.com/Conxian/conxius-platform/issues/854), [#1223](https://github.com/Conxian/conxius-platform/issues/1223)
3. **Trust chain hardening**: [#242](https://github.com/Conxian/conxius-enclave-sdk/issues/242), [#241](https://github.com/Conxian/conxius-enclave-sdk/issues/241), [#240](https://github.com/Conxian/conxius-enclave-sdk/issues/240), [#202](https://github.com/Conxian/conxius-enclave-sdk/issues/202)
4. **Wallet gate enforcement**: [#444](https://github.com/Conxian/conxius-wallet/issues/444), [#356](https://github.com/Conxian/conxius-wallet/issues/356)
5. **Market follow-on**: [#8](https://github.com/Conxian/conxian_market/issues/8)

---

## Relevant active work list

| Repo | Issue | Status | Notes |
|:-----|:------|:------:|:------|
| Conxian | [#488](https://github.com/Conxian/Conxian/issues/488) | OPEN | 2% protocol fee collection is the main revenue activation item. |
| Conxian | [#527](https://github.com/Conxian/Conxian/issues/527) | OPEN | Partnership fee policy and legal model remain open. |
| Conxian | [#530](https://github.com/Conxian/Conxian/issues/530) | OPEN | Gateway SDK + event indexing still needs completion. |
| Conxian | [#532](https://github.com/Conxian/Conxian/issues/532) | OPEN | Security / commercialization launch gate is still open. |
| Conxian | [#507](https://github.com/Conxian/Conxian/issues/507) | OPEN | sBTC vault work remains downstream of the fee activation chain. |
| Conxian | [#500](https://github.com/Conxian/Conxian/issues/500) | OPEN | Oracle/DEX deployment wiring is still pending. |
| Conxian | [#515](https://github.com/Conxian/Conxian/issues/515) | OPEN | Merge gate enforcement remains a governance issue. |
| conxius-platform | [#1082](https://github.com/Conxian/conxius-platform/issues/1082) | OPEN | CI validation scripts still need to be enforced in the unified workflow. |
| conxius-platform | [#854](https://github.com/Conxian/conxius-platform/issues/854) | OPEN | Org-wide rulesets and push protection remain active. |
| conxius-platform | [#1223](https://github.com/Conxian/conxius-platform/issues/1223) | OPEN | Rulesets still evaluate-only; this is still active. |
| conxius-enclave-sdk | [#242](https://github.com/Conxian/conxius-enclave-sdk/issues/242) | OPEN | AWS Nitro attestation remains a P0 blocker. |
| conxius-enclave-sdk | [#241](https://github.com/Conxian/conxius-enclave-sdk/issues/241) | OPEN | Android KeyMint/StrongBox verification remains a P0 blocker. |
| conxius-enclave-sdk | [#240](https://github.com/Conxian/conxius-enclave-sdk/issues/240) | OPEN | Attestation roots and revocation path remain unresolved. |
| conxius-enclave-sdk | [#202](https://github.com/Conxian/conxius-enclave-sdk/issues/202) | OPEN | Independent security review and release evidence remain pending. |
| conxius-enclave-sdk | [#200](https://github.com/Conxian/conxius-enclave-sdk/issues/200) | OPEN | WASM secret boundary risk remains open. |
| conxius-wallet | [#444](https://github.com/Conxian/conxius-wallet/issues/444) | OPEN | Centralized value-operation gate remains a P0 requirement. |
| conxius-wallet | [#356](https://github.com/Conxian/conxius-wallet/issues/356) | OPEN | CI/mobile verification baseline remains unmet. |
| conxian_market | [#8](https://github.com/Conxian/conxian_market/issues/8) | OPEN | Treasury dashboard follows the revenue activation path. |
| conxian-business | [#989](https://github.com/Conxian/conxian-business/issues/989) | OPEN | Strategy research remains active, but it is outside the market runtime path. |

---

## Completed items to keep closed

These items are already resolved and should not be treated as active blockers:

- conxian-business: [#943](https://github.com/Conxian/conxian-business/issues/943), [#944](https://github.com/Conxian/conxian-business/issues/944)
- conxian-gateway: [#306](https://github.com/Conxian/conxian-gateway/issues/306), [#228](https://github.com/Conxian/conxian-gateway/issues/228), [#220](https://github.com/Conxian/conxian-gateway/issues/220), [#222](https://github.com/Conxian/conxian-gateway/issues/222)
- conxian_market: [#9](https://github.com/Conxian/conxian_market/issues/9), [#18](https://github.com/Conxian/conxian_market/issues/18), [#17](https://github.com/Conxian/conxian_market/issues/17), [#16](https://github.com/Conxian/conxian_market/issues/16), [#15](https://github.com/Conxian/conxian_market/issues/15), [#14](https://github.com/Conxian/conxian_market/issues/14), [#13](https://github.com/Conxian/conxian_market/issues/13), [#12](https://github.com/Conxian/conxian_market/issues/12), [#6](https://github.com/Conxian/conxian_market/issues/6)
- conxius-enclave-sdk: [#260](https://github.com/Conxian/conxius-enclave-sdk/issues/260), [#198](https://github.com/Conxian/conxius-enclave-sdk/issues/198)
- lib-conxian-core: all tracked items in the reviewed set are closed.

---

## Working recommendation

The market repo should continue to focus on the value layer and avoid broad expansion while the upstream blockers remain active. The active path should be:

- Gate revenue activation with Conxian partnership and fee issues
- Ensure platform enforcement and CI continuity on [#1082](https://github.com/Conxian/conxius-platform/issues/1082) and [#854](https://github.com/Conxian/conxius-platform/issues/854)
- Wait on attestation and trust-chain enforcement from the enclave repo before moving strict-tier settlement to production-grade status
- Keep the market follow-on work on [#8](https://github.com/Conxian/conxian_market/issues/8) as a post-activation project

### Org decision rule for all repo work

- The market repo is the orchestration and value layer, not the consumer wallet, custody, or DeFi engine.
- Universal chain support is an abstraction layer for routing, finality checks, and settlement compatibility.
- Any chain-native component is valid only when it is the minimum required enforcement boundary for a chosen rail.
- We do not compete with our consumers by owning their custody, data plane, or native chain execution logic.
- Stacks or any other chain is only integrated when it supports the market’s settlement and verification flow, not when it expands into a competing consumer product.

This is the highest-confidence implementation order based on the current GitHub issue reality.
