# Session 48 → Session 49 Implementation Tracker

> **Generated:** 2026-08-01 | **Source:** `CROSS_REPO_GAP_ANALYSIS_SESSION_48.md` | **Auto-run Approved**
> **Updated:** 2026-08-16 | **Current stance:** The market repo is aligned to value-layer work; execution should advance through the gateway/core trust chain and upstream P0 blockers, not by broadening scope into unrelated org expansion.

---

## Active execution chain

The next implementation wave is the market → gateway → core → attestation chain.

1. **Gateway settlement billing**: `gateway` issue [#306](https://github.com/Conxian/conxian-gateway/issues/306) — required before fee capture is production-grade.
2. **Protocol fee activation**: `Conxian` issue [#488](https://github.com/Conxian/Conxian/issues/488) — required to activate the 2% market fee flow.
3. **Attestation chain hardening**: `enclave-sdk` issues [#242](https://github.com/Conxian/conxius-enclave-sdk/issues/242), [#241](https://github.com/Conxian/conxius-enclave-sdk/issues/241), [#240](https://github.com/Conxian/conxius-enclave-sdk/issues/240), [#198](https://github.com/Conxian/conxius-enclave-sdk/issues/198) — required before strict-tier settlement is operationally safe.
4. **CI and governance enforcement**: `platform` issues [#1082](https://github.com/Conxian/conxius-platform/issues/1082) and [#854](https://github.com/Conxian/conxius-platform/issues/854) — required to enforce the repo quality gate across the org.

This repo should remain focused on orchestration, settlement, and fee logic while upstream repos resolve the enabling infrastructure.

---

## Sprint 1: Foundation (Week 1)

| # | Action | Repo | Issue | Owner | Status |
|---|--------|------|-------|-------|:------:|
| S1-1 | Complete Linear→GitHub migration map | business | [#943](https://github.com/Conxian/conxian-business/issues/943) | Ops | ✅ |
| S1-2 | Retire Linear-first references | business | [#944](https://github.com/Conxian/conxian-business/issues/944) | Ops | ✅ |
| S1-3 | Implement CI validation scripts | platform | [#1082](https://github.com/Conxian/conxius-platform/issues/1082) | CI/CD | 🔄 Blocked upstream |
| S1-4 | Enforce org-wide GitHub rulesets | platform | [#854](https://github.com/Conxian/conxius-platform/issues/854) | Security | 🔄 Blocked upstream |
| S1-5 | Resolve Gitleaks false positives | nexus | [#178](https://github.com/Conxian/conxian-nexus/issues/178) | CI/CD | 🔄 Blocked upstream |
| S1-6 | Enforce strict CI/CD baseline | gateway | [#222](https://github.com/Conxian/conxian-gateway/issues/222) | CI/CD | ✅ |
| S1-7 | Enforce CI/CD baseline | wallet | [#356](https://github.com/Conxian/conxius-wallet/issues/356) | CI/CD | 🔄 Blocked upstream |

**Gate:** BOS Gate 1 (Green CI) — all repos passing.

---

## Sprint 2: Attestation Chain (Week 2)

| # | Action | Repo | Issue | Owner | Status |
|---|--------|------|-------|-------|:------:|
| S2-1 | Qualify AWS Nitro attestation | enclave-sdk | [#242](https://github.com/Conxian/conxius-enclave-sdk/issues/242) | Security | 🔒 P0 blocker |
| S2-2 | Qualify Android KeyMint/StrongBox | enclave-sdk | [#241](https://github.com/Conxian/conxius-enclave-sdk/issues/241) | Mobile | 🔒 P0 blocker |
| S2-3 | Operationalize attestation roots | enclave-sdk | [#240](https://github.com/Conxian/conxius-enclave-sdk/issues/240) | Security | 🔒 P0 blocker |
| S2-4 | Make CCTP/AA fail-closed | enclave-sdk | [#198](https://github.com/Conxian/conxius-enclave-sdk/issues/198) | Protocol | 🔒 P0 blocker |
| S2-5 | WASM secret boundary hardening | enclave-sdk | [#200](https://github.com/Conxian/conxius-enclave-sdk/issues/200) | Architecture | 🔒 P0 blocker |

**Gate:** BOS Gate 4 (Hardware attestation) — Managed tier operational.

---

## Sprint 3: Revenue Activation (Week 3-4)

| # | Action | Repo | Issue | Owner | Status |
|---|--------|------|-------|-------|:------:|
| S3-1 | Implement 2% protocol fee collection | Conxian | [#488](https://github.com/Conxian/Conxian/issues/488) | Protocol | 🚀 Priority next |
| S3-2 | Decide partnership fee policy | Conxian | [#527](https://github.com/Conxian/Conxian/issues/527) | Legal | 🚀 Priority next |
| S3-3 | Implement partnership fee contracts | Conxian | [#496](https://github.com/Conxian/Conxian/issues/496) | Protocol | 🚀 Priority next |
| S3-4 | Partnership gateway SDK + indexing | Conxian | [#530](https://github.com/Conxian/Conxian/issues/530) | Gateway | 🚀 Priority next |
| S3-5 | Complete partnership security gate | Conxian | [#532](https://github.com/Conxian/Conxian/issues/532) | Legal | 🚀 Priority next |
| S3-6 | P2: MRR/billing module | gateway | [#306](https://github.com/Conxian/conxian-gateway/issues/306) | Gateway | 🚀 Priority next |

**Gate:** CON-1427 live — market can collect 2% protocol fees on Expedient rails.

---

## Sprint 4: Builder Ecosystem (Week 5)

| # | Action | Repo | Issue | Owner | Status |
|---|--------|------|-------|-------|:------:|
| S4-1 | Developer sandbox TTFV < 15 min | Conxian | [#480](https://github.com/Conxian/Conxian/issues/480) | DX | ✅ |
| S4-2 | Centralized wallet value-operation gate | wallet | [#444](https://github.com/Conxian/conxius-wallet/issues/444) | Mobile | ⬜ |
| S4-3 | Treasury dashboard frontend | market | [#8](https://github.com/Conxian/conxian_market/issues/8) | Market | 🟡 Follow-on |
| S4-4 | Repository governance disposition | market | [#9](https://github.com/Conxian/conxian_market/issues/9) | Governance | ✅ |

**Gate:** BOS Gate 5 (Security acceptance) — independent review complete.

---

## Sprint 5: Protocol Depth (Week 6+)

| # | Action | Repo | Issue | Owner | Status |
|---|--------|------|-------|-------|:------:|
| S5-1 | FROST statechain operations audit | enclave-sdk | [#260](https://github.com/Conxian/conxius-enclave-sdk/issues/260) | Crypto | ✅ |
| S5-2 | RGB stash resolver integration | gateway | [#228](https://github.com/Conxian/conxian-gateway/issues/228) | Gateway | 🟡 Follow-on |
| S5-3 | DLC CET construction path | gateway | [#220](https://github.com/Conxian/conxian-gateway/issues/220) | Gateway | 🟡 Follow-on |
| S5-4 | sBTC vault implementation | Conxian | [#507](https://github.com/Conxian/Conxian/issues/507) | Protocol | 🟡 Follow-on |
| S5-5 | Production oracle/DEX wiring | Conxian | [#500](https://github.com/Conxian/Conxian/issues/500) | Protocol | 🟡 Follow-on |
| S5-6 | Chain transport isolation | lib-conxian-core | [#233](https://github.com/Conxian/lib-conxian-core/issues/233) | Architecture | 🟡 Follow-on |
| S5-7 | Enforce main branch merge gates | Conxian | [#515](https://github.com/Conxian/Conxian/issues/515) | Governance | 🟡 Follow-on |
| S5-8 | Security review + release evidence | enclave-sdk | [#202](https://github.com/Conxian/conxius-enclave-sdk/issues/202) | Security | 🟡 Follow-on |

**Gate:** BOS Gate 6 (Mainnet handoff) — all systems operational.

---

## Dependency Heatmap

```
                   S1 (Foundation)
                  /        \
          S2 (Attestation)  S3 (Revenue)
                  \        /
              S4 (Builders)  ←  Both S2 + S3 must complete
                    |
              S5 (Protocol Depth)  ←  S2 gates remain
```

---

## Progress Summary

| Sprint | Items | Complete | Remaining |
|:------:|:-----:|:--------:|:---------:|
| S1 — Foundation | 7 | 3 | 4 |
| S2 — Attestation | 5 | 0 | 5 |
| S3 — Revenue | 6 | 0 | 6 |
| S4 — Builders | 4 | 2 | 2 |
| S5 — Protocol | 8 | 1 | 7 |
| **Total** | **30** | **6** | **24** |

> **Updated:** 2026-08-05 (Session 56+ — cross-repo verification sweep). Tracked from `CROSS_REPO_GAP_ANALYSIS_SESSION_48.md`.
