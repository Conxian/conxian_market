/**
 * @conxian/market-sdk — Conxian Market SDK
 *
 * Full integration bridge: fee calculator, gateway client,
 * verification, settlement orchestration, and SDK capability
 * wiring for all 27 enclave-sdk + lib-conxian-core modules.
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
 * ```
 */

export { ConxianMarketSDK } from "./sdk_bridge";
export type { CapabilitySummary } from "./sdk_bridge";

export { GatewayClient } from "./gateway_client";
export type { GatewayConfig } from "./gateway_client";

export { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification";

export { SettlementOrchestrator, RAIL_CAPABILITIES } from "./settlement";
export type { RailCapability } from "./settlement";

export {
  detectTrustTier,
  calculateRailFee,
  selectRail,
  generateFeeReport,
  projectRevenue,
  toWireHeaders,
  TrustTier,
  SettlementRail,
} from "./fee_calculator";
export type {
  AttestationHeaders,
  FeeResult,
  FeeReport,
  RailPreference,
  SettlementEvent,
} from "./fee_calculator";

export {
  TrustTier as TrustTierEnum,
  DEFAULT_FEATURE_FLAGS,
  ChainId,
  JobCardStatus,
  DlcBondStatus,
} from "./core_types";
export type {
  FeatureFlags,
  AttestationCertificate,
  AttestationResult,
  ProtocolFeeRecord,
  ProtocolFeeReport,
  RailFeeBreakdown,
  TierFeeBreakdown,
  SettlementRequest,
  SettlementResult,
  JobCard,
  SlaTemplate,
  DlcBond,
  Musig2KeyAggregation,
  VtxoTransfer,
  M2MSettlement,
  BuilderIdentity,
  SettlementIntent,
  AgentCreditScore,
  YieldOpportunity,
  UsageMetrics,
  MrrReport,
  RevenueScenario,
  RevenueProjection,
} from "./core_types";
