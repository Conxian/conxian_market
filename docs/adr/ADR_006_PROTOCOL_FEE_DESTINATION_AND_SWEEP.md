# ADR-006: Protocol Fee Destination and Treasury Sweep — Re-homed to `conxian_market`

> **Status:** Accepted | **Date:** 2026-11-14 | **Version:** 1.0
> **Supersedes:** the "Phase C in `Conxian/Conxian`" plan in ADR-001 §Implementation Status and `docs/research/CON1427_IMPLEMENTATION_PLAN.md` §2.4
> **Authoritative for:** Where the protocol fee lands, who may move it, and the sweep split

---

## Context

ADR-001 §5 and `docs/AGENTS.md` §3 define three treasury tiers: `TREASURY-VAULT`
(passive intake), `SAB-TREASURY-MS` (3-of-5 operational), `DAO-TREASURY-MS`
(5-of-7 reserves). ADR-001 §Implementation Status and CON-1427 §2.4 place the
Clarity contracts (`fee-manager.clar`, `protocol-fee-collector.clar`,
`fee-orchestrator.clar`) in the repository `Conxian/Conxian`.

Three facts changed the picture:

1. **`Conxian/Conxian` no longer exists.** The GitHub API returns `404`; it is not
   in the org repo list. The contracts have no home to be deployed from.
2. **The fee is computed and reported but never routed.** `src/job_card_escrow.ts`
   computes the 80/10/10 split and then routes only the builder leg
   (`evaluateAndRelease`, ~line 240). The `platformTreasurySat` and
   `ecosystemStakeholdersSat` legs are discarded. `gateway_client.submitFeeReport`
   is never called from `src/`.
3. **"Passive only" left the fee with no exit.** ADR-001 §5 says TREASURY-VAULT
   performs no outbound transfers, and no sweep contract existed anywhere. So even
   a funded vault had no path to the economics.

The user asked, directly: *"if treasury is passive only how does the 80% reach
where it needs to go, the economics?"* The answer is: the builder's 80% never
touches the vault (it is a direct escrow payout), but the treasury's share had no
exit at all. This ADR closes that.

---

## Decision

### 1. The fee destination is re-homed to `conxian_market`

`conxian_market` is the Value Layer: it already computes the fee
(`src/fee_calculator.ts`) and reports it (`src/gateway_client.ts`). The destination
contract lives here:

| Artefact | Path |
|---|---|
| TREASURY-VAULT contract | `contracts/protocol-fee-vault.clar` |
| Clarity manifest | `Clarinet.toml` |
| Contract tests (simnet) | `tests/contracts/protocol_fee_vault.contract.test.ts` |
| Settlement planner (TS) | `src/protocol_fee_settlement.ts` |

### 2. TREASURY-VAULT is passive intake, with one gated exit

`protocol-fee-vault.clar` has exactly one outbound path, `sweep-treasury`, which:

- requires the caller to be the configured `treasury-principal` (SAB-TREASURY-MS);
- fails closed (`ERR_NOT_CONFIGURED`) until the treasury principal and all three
  recipients are set;
- distributes the vault balance 50/30/20 to the Operations, Founders, and
  Ecosystem role principals (ADR-001 §1.2);
- lets the remainder bucket absorb integer-division dust, so no satoshi is lost;
- is blocked by `pause` (SAB_EMERGENCY_PAUSE_MULTISIG, pause only).

Intake (`collect-protocol-fee`) is bookkeeping: value arrives by a plain transfer
to the contract principal; the call anchors the settlement id and rejects replays.

### 3. No addresses are hardcoded

Every recipient is a role principal set by the owner during the SAB handoff
(`set-treasury-principal`, `set-recipient-principals`, `set-split`). This follows
`docs/AGENTS.md` "Principals Over Addresses".

### 4. The off-chain planner mirrors the on-chain split

`src/protocol_fee_settlement.ts` turns a released settlement into the full
recipient set: builder (direct), TREASURY-VAULT (vault-intake), ecosystem
(direct), plus the vault's 50/30/20 sweep plan. It fails closed while any role
principal is unconfigured, and it mirrors the vault's dust rule so the two cannot
drift.

### 5. The fee-model divergence is surfaced, not silently resolved

`job_card_escrow` takes the protocol fee off the gross, then applies 80/10/10 to
the net. On 100,000 sat at 2% that is a **21.6% total protocol take (2160 bps)**,
against ADR-001 §1's stated 2%. The planner reports
`effectiveProtocolTakeBps` so this is visible. **This ADR does not change the fee
rate**; ADR-001 §1 (2% of settlement) and §1.1 (80/10/10 of settlement value)
remain in tension and are a governance decision, not an engineering one.

### 6. The sweep is mapped to the documented treasury purposes

`planTreasuryUtilisation` (in `src/protocol_fee_settlement.ts`) turns a
`VaultSweepPlan` into the "what for" layer: each bucket's documented purposes
(from `FUNDING_AND_ECONOMICS.md` §2.1) and its SAB release target
(Operations/Founders → `SAB-TREASURY-MS`; Ecosystem → `DAO-TREASURY-MS`), plus the
40/30/20/10 target asset mix from `operating_manual.md` §3C. It is descriptive
only and grants no spend authority.

---

## Consequences

### Positive
- The fee has a destination that exists in a live repository.
- The fee has an exit: a gated, testable sweep that reaches Operations, Founders,
  and Ecosystem.
- Both paths are covered by tests on a real Clarity simnet (5 contract tests) and
  in TypeScript (8 planner tests).

### Negative / open
- **Nothing is deployed.** The contract is not on Stacks testnet or mainnet.
  Deployment needs `SAB_DEPLOYER_MULTISIG` and deploy keys (CON-1427 Phase C gate).
- `protocolFeeActive` stays `false`. Enabling it is a separate, deliberate step
  after deployment and a funded, configured vault.
- The 2% vs 80/10/10 fee-basis question (Decision 5) is unresolved.

### Implementation Status

| Component | Status | Location |
|---|---|---|
| TREASURY-VAULT contract | Implemented, not deployed | `contracts/protocol-fee-vault.clar` |
| Contract simnet tests | Passing (5) | `tests/contracts/protocol_fee_vault.contract.test.ts` |
| Settlement planner | Implemented, tested (8) | `src/protocol_fee_settlement.ts` |
| SDK capability | Wired | `ConxianMarketSDK.planProtocolFeeSettlement` |
| Testnet deployment | Not started | needs SAB deploy keys |
| `protocolFeeActive` | Still `false` | `src/core_types.ts` |

---

## References

- `docs/adr/ADR_001_FEE_MODEL.md` — fee basis, custody roles (superseded on Phase C location only)
- `docs/AGENTS.md` §3 — SAB wallet architecture
- `docs/research/CON1427_IMPLEMENTATION_PLAN.md` — original 4-phase plan
- `contracts/protocol-fee-vault.clar` — the destination contract
- `src/protocol_fee_settlement.ts` — the settlement planner
- `src/job_card_escrow.ts` — where the split is computed and previously dropped

---

*This ADR is the authoritative decision for the protocol fee destination and sweep.
References elsewhere that place these contracts in `Conxian/Conxian` are superseded.*
