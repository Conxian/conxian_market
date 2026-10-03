/**
 * Conxian Market SDK Index Entrypoint
 *
 * Core exports for non-custodial value routing, SLA enforcement, TrustTier pricing,
 * telemetry monitoring, BOS yield splitting, ERC-8183 escrow management, attestation proof verification,
 * x402 gateway integration with attestation proof artifacts, and autonomous SLA gap card auto-resolution.
 */

export * from "./core_types.js";
export { GatewayClient } from "./gateway_client.js";
export { SettlementResultSchema, ProtocolFeeRecordSchema, M2MSettlementResponseSchema } from "./wire_contract.js";
export type { ValidatedSettlementResult } from "./wire_contract.js";
export { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification.js";
export type { AttestationCapabilities } from "./verification.js";
export { SettlementOrchestrator } from "./settlement.js";
export type { SettlementProofVerificationResult } from "./settlement.js";
export { SlaEngine, DEFAULT_SLA_RULESET, URGENCY_PRICING_TABLE } from "./sla_engine.js";
export type {
  GapCard,
  SlaEvaluationResult,
  BuilderReputationRecord,
  UrgencyTier,
  SlaRule,
  GapCardAutoResolutionInput,
  GapCardAutoResolutionResult,
} from "./sla_engine.js";
export { MonitoringWatcher, DEFAULT_TARGET_ALLOCATION } from "./monitoring_watcher.js";
export {
  generateMonthlyTreasuryReport,
  renderTreasuryDashboard,
  RUNWAY_THRESHOLDS,
  DAILY_VOLUME_THRESHOLDS,
  MONTHLY_REVENUE_THRESHOLDS,
  STABLECOIN_PCT_THRESHOLDS,
  FEE_DISTRIBUTION_TARGETS,
} from "./treasury_report.js";
export type {
  TreasuryReport,
  TreasuryReportInput,
  HealthIndicator,
  AllocationStatus,
  FeeDistributionSummary,
  ThresholdBand,
} from "./treasury_report.js";
export type {
  HealthStatus,
  SbtcHealthInput,
  SbtcHealthResult,
  FedimintMintInput,
  FedimintHealthResult,
  BabylonStakingInput,
  BabylonHealthResult,
  AssetAllocation,
  TreasuryRunwayInput,
  TreasuryRunwayResult,
  SlaGapKind,
  SlaGapRuleViolation,
  JobCardSlaAuditInput,
  SlaHealthInput,
  SlaHealthResult,
  UnifiedHealthSnapshot,
} from "./monitoring_watcher.js";
export { TrustTierMiddleware, TrustTierLifecycleEngine, SLA_TEMPLATES, RAIL_ROUTING_MATRIX } from "./trust_tier_middleware.js";
export type {
  TrustTierHeaders,
  TrustTierPipelineRequest,
  TrustTierPipelineResult,
  SlaTemplate,
  PipelineWireHeaders,
  TierUpgradeRequest,
  TierUpgradeResult,
  TierDowngradeRequest,
  TierDowngradeResult,
  TierTransitionStatus,
} from "./trust_tier_middleware.js";
export { BosYieldSplitter, FEE_DECAY_TIMELINE } from "./bos_yield_splitter.js";
export type {
  YieldSplit,
  FeeDecayTier,
  ProtocolFeeDistribution,
  FounderVestingInput,
  FounderVestingResult,
  InferencePolicyInput,
  InferencePolicyResult,
} from "./bos_yield_splitter.js";
export { MarketAgnosticRouter } from "./market_agnostic_router.js";
export type {
  NonCustodialSettlementRequest,
  ZeroCustodyValidationResult,
  DefiProtocolAdapter,
  M2mRouteResult,
  DeprecationAdvisory,
  DeprecationNotice,
  DirectContractCallRequest,
  DirectContractRouteResult,
  RouterOptions,
} from "./market_agnostic_router.js";
export { JobCardEscrowEngine, EscrowState } from "./job_card_escrow.js";
export type {
  EscrowCreationParams,
  JobOutputSubmission,
  EscrowReleaseResult,
  EscrowRefundResult,
  EscrowReconciliationResult,
  EscrowRecord,
} from "./job_card_escrow.js";
export {
  X402_SCHEME,
  X402_CURRENCY,
  jobCardToDemand,
  jobCardToMultiRailDemands,
  verifyPaymentReceipt,
  verifyPaymentReceiptWithAttestation,
  createTrustProofArtifact,
  toEscrowParams,
  X402EscrowGateway,
} from "./x402_facade.js";
export type {
  X402PaymentDemand,
  X402PaymentReceipt,
  X402TrustProofArtifact,
  X402AttestationVerificationResult,
} from "./x402_facade.js";
export { AgentRegistry, agentCardDigest } from "./agent_registry.js";
export type {
  AgentCard,
  AgentCapability,
  AgentIdentityAnchor,
  AgentReputationRecord,
  AgentRegistryEntry,
} from "./agent_registry.js";
export { Mcp402Facade } from "./mcp_402.js";
export type { McpToolCall, Mcp402PaymentGateResult } from "./mcp_402.js";
export { ConxianMarketSDK } from "./sdk_bridge.js";

export { ClientInstallerEngine } from "./client_onboarding.js";
export type {
  ClientOnboardingConfig,
  ClientProvisioningResult,
  SystemConnectivityReport,
  ZeroCustodySanityCheck,
  ConnectivityDiagnosticItem,
  ClientEntitlementLicense,
  ClientDeploymentManifest,
  AssetConnectivityProbeResult,
  UnifiedCliInstallerRunResult,
} from "./core_types.js";

// Session 69: Export SLA Policy and Statutory Exemption Types
export type {
  SlaExemptionReason,
  EnterpriseSlaPolicyConfig,
  SlaPolicyEvaluationResult,
} from "./core_types.js";

// Session 72/73: Export ADR-004 Dynamic Fee Floor Report & Mempool Load Oracle Types & Functions
export {
  generateDynamicFeeReport,
  resolveSystemLoadFromMempool,
  loadFactorFromMempoolPercentile,
  getRailDefaultFlatFloor,
  calculateVolumeDecayedBps,
  selectVolumeDecayTier,
  calibrateRailFloorFromMeasuredCost,
  VOLUME_TIER_THRESHOLDS_SAT,
  TIER_HYSTERESIS_BPS,
  calculateDynamicFee,
} from "./fee_calculator.js";
export type {
  DynamicSettlementEvent,
  DynamicFeeBreakdownByRail,
  DynamicFeeReport,
  MempoolFeeSample,
  LoadOracleAdapterConfig,
} from "./core_types.js";
