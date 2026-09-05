/**
 * Conxian Market SDK Index Entrypoint
 *
 * Core exports for non-custodial value routing, SLA enforcement, TrustTier pricing,
 * telemetry monitoring, BOS yield splitting, ERC-8183 escrow management, attestation proof verification,
 * and x402 gateway integration.
 */

export * from "./core_types";
export { GatewayClient } from "./gateway_client";
export { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification";
export type { AttestationCapabilities } from "./verification";
export { SettlementOrchestrator } from "./settlement";
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
export { JobCardEscrowEngine, EscrowState } from "./job_card_escrow";
export type {
  EscrowCreationParams,
  JobOutputSubmission,
  EscrowReleaseResult,
  EscrowRefundResult,
  EscrowRecord,
} from "./job_card_escrow";
export {
  X402_SCHEME,
  X402_CURRENCY,
  jobCardToDemand,
  jobCardToMultiRailDemands,
  verifyPaymentReceipt,
  toEscrowParams,
  X402EscrowGateway,
} from "./x402_facade";
export type { X402PaymentDemand, X402PaymentReceipt } from "./x402_facade";
export { ConxianMarketSDK } from "./sdk_bridge";
