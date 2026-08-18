/**
 * @conxian/market-sdk — Conxian Market SDK
 *
 * Full integration bridge: fee calculator, gateway client,
 * verification, settlement orchestration, autonomous SLA bounty engine,
 * and SDK capability wiring for all 27 enclave-sdk + lib-conxian-core modules.
 *
 * Quick start:
 * ```typescript
 * import { ConxianMarketSDK } from "@conxian/market-sdk";
 *
 * const sdk = await ConxianMarketSDK.connect({
 *   baseUrl: "https://gateway.conxian.io",
 *   apiToken: process.env.CONXIAN_API_TOKEN!,
 * });
 *
 * // Detect trust tier
 * const tier = await sdk.detectTrustTier({
 *   "x-conxian-light-proof": "...",
 * });
 *
 * // Calculate fee
 * const fee = sdk.calculateFee(100_000n, tier, "LIGHTNING");
 *
 * // Execute settlement
 * const result = await sdk.executeSettlement({
 *   id: "settle-001",
 *   amountSat: 100_000n,
 *   rail: "LIGHTNING",
 *   tier,
 *   builderId: "did:conxian:builder-001",
 * });
 *
 * // Evaluate SLA & generate gap cards
 * const slaResult = sdk.evaluateSla(jobCard, new Date().toISOString());
 * ```
 */

export { ConxianMarketSDK } from "./sdk_bridge";
export type { CapabilitySummary } from "./sdk_bridge";

export { GatewayClient } from "./gateway_client";
export type { GatewayConfig } from "./gateway_client";

export { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification";

export { SettlementOrchestrator, RAIL_CAPABILITIES } from "./settlement";
export type { RailCapability } from "./settlement";

export { SlaEngine, DEFAULT_SLA_RULESET, URGENCY_PRICING_TABLE } from "./sla_engine";
export type {
  GapCard,
  SlaEvaluationResult,
  BuilderReputationRecord,
  UrgencyTier,
  SlaRule,
  SlaRuleId,
  SlaAction,
  SlaCondition,
} from "./sla_engine";

export {
  detectTrustTier,
  calculateRailFee,
  selectRail,
  projectRevenue,
} from "./fee_calculator";

export * from "./core_types";
