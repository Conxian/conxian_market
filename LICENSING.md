# Licensing boundary

`@conxian/market-sdk` ships under a **two-tier licence model**.

| Surface | Licence | Contents |
|---|---|---|
| **Client SDK** | **MIT** | `index.ts`, `core_types.ts`, `wire_contract.ts`, `gateway_client.ts`, `settlement.ts`, `verification.ts`, `sla_engine.ts`, `trust_tier_middleware.ts`, `x402_*`, `entitlement_resolver.ts`, `replay_guard.ts`, `mcp_402.ts`, `provider_discovery.ts`, `client_onboarding.ts`, `market_agnostic_router.ts`, `multi_dimensional_scoring.ts`, `roundhouse_client.ts`, `lightning_payment.ts`, `monitoring_watcher.ts`, `decentralized_systems.ts`, `agent_registry.ts`, `sdk_bridge.ts` |
| **Revenue moat** | **AGPL-3.0-or-later** | `job_card_escrow.ts` (escrow orchestration), `bos_yield_splitter.ts` (protocol-fee split), `treasury_report.ts` (fee distribution) |

The moat files carry an explicit `SPDX-License-Identifier: AGPL-3.0-or-later`
header. The full AGPL text is in `LICENSE-AGPL`; the MIT text is in `LICENSE`.

## Why

These modules hold the **fee enforcement and distribution** logic. The client
SDK stays MIT so it can be adopted freely (and donated to a neutral foundation),
while the server-side value capture stays defensible: anyone running a modified
moat module as a network service must offer the corresponding source (AGPL-3.0
§13) or obtain a commercial licence from Conxian Labs.

## The rule for contributors

> If a competitor could fork the file and run it as a service to take revenue,
> it belongs in the **AGPL moat**. Everything else is **MIT** client SDK.

## Related

`ADR-004` (dynamic fee floor), `ADR-009` (unified pricing), `conxian-business#1790`.
