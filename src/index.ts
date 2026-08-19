/**
 * Conxian Market SDK — Main Export.
 *
 * Value & Orchestration Layer for the Conxian Marketplace.
 *
 * Usage:
 * ```typescript
 * import { ConxianMarketSDK } from "@conxian/market-sdk";
 *
 * const sdk = await ConxianMarketSDK.connect({
 *   baseUrl: "https://gateway.conxian.dev",
 *   apiToken: "api-key",
 * });
 *
 * // Detect tier from request headers
 * const tier = await sdk.detectTrustTier(req.headers);
 *
 * // Execute multi-rail settlement
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
 *
 * // Generate Telemetry & Treasury Health Snapshot
 * const health = sdk.getHealthSnapshot({ sbtc, fedimints, babylon, treasury });
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

export { MonitoringWatcher, DEFAULT_TARGET_ALLOCATION } from "./monitoring_watcher";
export type {
  HealthStatus,
  SbtcHealthInput,
  SbtcHealthResult,
  FedimintMintInput,
  FedimintHealthResult,
  BabylonStakingInput,
  BabylonHealthResult,
  AssetAllocation,
  TargetAllocationPct,
  TreasuryRunwayInput,
  TreasuryRunwayResult,
  UnifiedHealthSnapshot,
} from "./monitoring_watcher";

export {
  detectTrustTier,
  calculateRailFee,
  selectRail,
  projectRevenue,
} from "./fee_calculator";
export { TrustTier, SettlementRail, ChainId } from "./core_types";
export type {
  JobCard,
  ProtocolFeeRecord,
  ProtocolFeeReport,
  SettlementRequest,
  SettlementResult,
  FeatureFlags,
} from "./core_types";
