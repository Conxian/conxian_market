/**
 * Conxian Market SDK Main Index.
 *
 * Export all modules, interfaces, and types for market SDK consumers.
 */

export { ConxianMarketSDK } from "./sdk_bridge";
export type { CapabilitySummary } from "./sdk_bridge";

export { GatewayClient } from "./gateway_client";
export type { GatewayConfig } from "./gateway_client";

export { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification";

export { SettlementOrchestrator, RAIL_CAPABILITIES } from "./settlement";
export type { RailCapability } from "./settlement";

export { SlaEngine, DEFAULT_SLA_RULESET, URGENCY_PRICING_TABLE } from "./sla_engine";
export type { GapCard, SlaEvaluationResult, BuilderReputationRecord, UrgencyTier, SlaRule } from "./sla_engine";

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

export { TrustTierMiddleware, SLA_TEMPLATES, RAIL_ROUTING_MATRIX } from "./trust_tier_middleware";
export type {
  TrustTierHeaders,
  TrustTierPipelineRequest,
  TrustTierPipelineResult,
  SlaTemplate,
  PipelineWireHeaders,
} from "./trust_tier_middleware";

export { BosYieldSplitter, FEE_DECAY_TIMELINE } from "./bos_yield_splitter";
export type {
  YieldSplit,
  FeeDecayTier,
  ProtocolFeeDistribution,
  FounderVestingInput,
  FounderVestingResult,
  InferencePolicyInput,
  InferencePolicyResult,
} from "./bos_yield_splitter";

export { MarketAgnosticRouter } from "./market_agnostic_router";
export type {
  NonCustodialSettlementRequest,
  ZeroCustodyValidationResult,
  DefiProtocolAdapter,
  M2mRouteResult,
  DeprecationAdvisory,
} from "./market_agnostic_router";

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
