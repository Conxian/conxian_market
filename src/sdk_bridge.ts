/**
 * Conxian Market SDK Bridge — Unified Client Interface for Marketplace Services.
 *
 * Integrates:
 *   - Gateway Client (relay, RWA verification, blocks, NTT)
 *   - Gateway Verifier (attestation cert verification, trust tier detection)
 *   - Settlement Orchestrator (cross-chain settlement routing across 8 rails)
 *   - SLA Engine (autonomous SLA evaluation & gap card bounties)
 *   - Monitoring Watcher (sBTC, Fedimint, Babylon, and Treasury health monitoring)
 *   - TrustTier Middleware (HTTP/MCP request verification & routing pipeline)
 *   - BOS Yield Splitter (80/10/10 yield matrix, fee decay, founder vesting, inference policy)
 *   - Market-Agnostic Router (Zero-custody validation, BYO DeFi protocol adapter resolution, M2M route execution, Conxian/Conxian deprecation advisory)
 *   - Job Card Escrow Engine (ERC-8183 programmable escrow creation, output submission, SLA-integrated release, dispute/refund handling)
 *   - Fee Calculator (2% protocol fee with tier/rail breakdown)
 */

import { GatewayClient, type GatewayConfig } from "./gateway_client";
import { GatewayVerifier, degradeTierForP0Gaps } from "./verification";
import { SettlementOrchestrator } from "./settlement";
import {
  SlaEngine,
  type BuilderReputationRecord,
  type SlaEvaluationResult,
} from "./sla_engine";
import {
  detectTrustTier as detectTier,
  calculateRailFee,
  projectRevenue,
} from "./fee_calculator";
import {
  TrustTier,
  SettlementRail,
  TrustTier as Tier,
  DEFAULT_FEATURE_FLAGS,
  type AttestationCertificate,
  type FeatureFlags,
  type JobCard,
  type ProtocolFeeRecord as FeeResult,
  type RevenueProjection,
  type RevenueScenario,
  type SettlementRequest,
  type SettlementResult,
} from "./core_types";
import {
  MonitoringWatcher,
  type BabylonStakingInput,
  type FedimintMintInput,
  type SbtcHealthInput,
  type TreasuryRunwayInput,
  type UnifiedHealthSnapshot,
} from "./monitoring_watcher";
import {
  TrustTierMiddleware,
  type TrustTierPipelineRequest,
  type TrustTierPipelineResult,
} from "./trust_tier_middleware";
import {
  BosYieldSplitter,
  type FounderVestingInput,
  type FounderVestingResult,
  type InferencePolicyInput,
  type InferencePolicyResult,
  type ProtocolFeeDistribution,
  type YieldSplit,
} from "./bos_yield_splitter";
import {
  MarketAgnosticRouter,
  type DefiProtocolAdapter,
  type DeprecationAdvisory,
  type M2mRouteResult,
  type NonCustodialSettlementRequest,
  type ZeroCustodyValidationResult,
} from "./market_agnostic_router";
import {
  JobCardEscrowEngine,
  type EscrowCreationParams,
  type EscrowRecord,
  type EscrowRefundResult,
  type EscrowReleaseResult,
  type JobOutputSubmission,
} from "./job_card_escrow";

export interface CapabilitySummary {
  coreCapabilities: number; // 12
  enclaveCapabilities: number; // 16
  totalCapabilities: number; // 32
  activeRails: SettlementRail[];
  activeTiers: TrustTier[];
  p0GapsDetected: string[];
  coreModules: Record<string, boolean>;
  enclaveModules: Record<string, boolean>;
  monitoringWatcherEnabled: boolean;
  trustTierMiddlewareEnabled: boolean;
  bosYieldSplitterEnabled: boolean;
  marketAgnosticRouterEnabled: boolean;
  jobCardEscrowEngineEnabled: boolean;
}

export class ConxianMarketSDK {
  readonly gateway: GatewayClient;
  readonly verifier: GatewayVerifier;
  readonly settlement: SettlementOrchestrator;
  readonly slaEngine: SlaEngine;
  readonly monitoringWatcher: MonitoringWatcher;
  readonly trustTierMiddleware: TrustTierMiddleware;
  readonly bosYieldSplitter: typeof BosYieldSplitter;
  readonly marketAgnosticRouter: typeof MarketAgnosticRouter;
  readonly jobCardEscrowEngine: JobCardEscrowEngine;
  readonly flags: FeatureFlags;

  private constructor(
    config: GatewayConfig,
    flags: FeatureFlags = DEFAULT_FEATURE_FLAGS
  ) {
    this.flags = flags;
    this.gateway = new GatewayClient(config);
    this.verifier = new GatewayVerifier(this.gateway, flags);
    this.settlement = new SettlementOrchestrator(this.gateway, this.verifier, flags);
    this.slaEngine = new SlaEngine();
    this.monitoringWatcher = new MonitoringWatcher();
    this.trustTierMiddleware = new TrustTierMiddleware(flags);
    this.bosYieldSplitter = BosYieldSplitter;
    this.marketAgnosticRouter = MarketAgnosticRouter;
    this.jobCardEscrowEngine = new JobCardEscrowEngine(this.slaEngine);
  }

  /** Connect to gateway and instantiate full Market SDK Bridge */
  static async connect(
    config: GatewayConfig,
    flags: FeatureFlags = DEFAULT_FEATURE_FLAGS
  ): Promise<ConxianMarketSDK> {
    return new ConxianMarketSDK(config, flags);
  }

  // ── Capability 1: Control Model (TrustTier Detection & P0 Degradation) ──

  async detectTrustTier(headers: {
    "x-conxian-tee-proof"?: string;
    "x-conxian-zk-proof"?: string;
    "x-conxian-enclave-attestation"?: string;
    "x-conxian-light-proof"?: string;
  }): Promise<TrustTier> {
    const detected = detectTier(headers);
    return degradeTierForP0Gaps(detected, this.flags);
  }

  // ── Capability 2: CJCS Job Cards & Escrow ──

  async settleJobCard(card: JobCard): Promise<SettlementResult> {
    return this.gateway.settleJobCard(card);
  }

  // ── Capability 3: Verification (Attestation via Gateway/Nexus) ──

  async verifyAttestation(cert: AttestationCertificate): Promise<boolean> {
    const tier = await this.verifier.detectTier(cert);
    return tier !== Tier.ObserverOnly;
  }

  // ── Capability 4: Fee Calculator & Revenue Model ──

  calculateFee(
    amountSat: bigint,
    tier: TrustTier,
    rail: SettlementRail
  ): FeeResult {
    const feeInfo = calculateRailFee(amountSat, tier, rail);
    return {
      settlementId: `fee-${Date.now()}`,
      rail,
      tier,
      amountSat,
      feeSat: feeInfo.feeSat,
      feeBps: feeInfo.feeBps,
      timestamp: Date.now(),
      builderId: "system",
    };
  }

  projectRevenue(scenario: RevenueScenario): RevenueProjection {
    return projectRevenue(scenario);
  }

  // ── Capability 5: Settlement Orchestration ──

  async executeSettlement(request: SettlementRequest): Promise<SettlementResult> {
    return this.settlement.execute(request);
  }

  // ── Capability 6: Autonomous SLA Enforcement & CJCS Gap Cards ──

  evaluateSla(
    jobCard: JobCard,
    currentTimeIso: string,
    options?: {
      lastActivityTimeIso?: string;
      actualTrustTier?: TrustTier;
      collectedFeeBps?: number;
      disputeCount?: number;
    }
  ): SlaEvaluationResult {
    return this.slaEngine.evaluateJobCard(jobCard, currentTimeIso, options);
  }

  updateBuilderReputation(
    current: BuilderReputationRecord,
    event: "sla_breach" | "abandonment" | "gap_resolved" | "quality_dispute" | "job_completed"
  ): BuilderReputationRecord {
    return SlaEngine.updateBuilderReputation(current, event);
  }

  // ── Capability 7: Telemetry & Treasury Health Watcher ──

  getHealthSnapshot(params: {
    sbtc: SbtcHealthInput;
    fedimints: FedimintMintInput[];
    babylon: BabylonStakingInput;
    treasury: TreasuryRunwayInput;
  }): UnifiedHealthSnapshot {
    return this.monitoringWatcher.createSnapshot(params);
  }

  // ── Capability 8: TrustTier Pricing & Routing Middleware Pipeline ──

  runTrustTierPipeline(request: TrustTierPipelineRequest): TrustTierPipelineResult {
    return this.trustTierMiddleware.executePipeline(request);
  }

  // ── Capability 9: BOS Commercial Yield Matrix & Thin Orchestrator Guard ──

  calculateYieldSplit(grossAmountSat: bigint): YieldSplit {
    return BosYieldSplitter.calculateYieldSplit(grossAmountSat);
  }

  distributeProtocolFee(grossAmountSat: bigint, monthsElapsed: number): ProtocolFeeDistribution {
    return BosYieldSplitter.distributeProtocolFee(grossAmountSat, monthsElapsed);
  }

  evaluateFounderVesting(input: FounderVestingInput): FounderVestingResult {
    return BosYieldSplitter.evaluateFounderVesting(input);
  }

  verifyInferencePolicy(input: InferencePolicyInput): InferencePolicyResult {
    return BosYieldSplitter.verifyInferencePolicy(input);
  }

  // ── Capability 10: Market-Agnostic Non-Custodial Router & BYO DeFi ──

  validateZeroCustody(request: NonCustodialSettlementRequest): ZeroCustodyValidationResult {
    return MarketAgnosticRouter.validateZeroCustody(request);
  }

  resolveDefiAdapter(rail: SettlementRail, preferredProtocol?: string): DefiProtocolAdapter {
    return MarketAgnosticRouter.resolveDefiAdapter(rail, preferredProtocol);
  }

  routeM2mSettlement(
    fromAgentDid: string,
    toAgentDid: string,
    amountSat: bigint,
    rail: SettlementRail,
    preferredProtocol?: string
  ): M2mRouteResult {
    return MarketAgnosticRouter.routeM2mSettlement(
      fromAgentDid,
      toAgentDid,
      amountSat,
      rail,
      preferredProtocol
    );
  }

  getDeprecationAdvisory(): DeprecationAdvisory {
    return MarketAgnosticRouter.getDeprecationAdvisory();
  }

  // ── Capability 11: ERC-8183 Job Card Escrow Engine ──

  createJobCardEscrow(params: EscrowCreationParams): EscrowRecord {
    return this.jobCardEscrowEngine.createEscrow(params);
  }

  submitJobCardOutput(submission: JobOutputSubmission): EscrowRecord {
    return this.jobCardEscrowEngine.submitJobOutput(submission);
  }

  evaluateAndReleaseJobCardEscrow(
    jobId: string,
    currentTimeIso: string,
    options?: { actualTrustTier?: TrustTier }
  ): EscrowReleaseResult {
    return this.jobCardEscrowEngine.evaluateAndRelease(jobId, currentTimeIso, options);
  }

  disputeAndRefundJobCardEscrow(
    jobId: string,
    reason: string,
    currentTimeIso: string
  ): EscrowRefundResult {
    return this.jobCardEscrowEngine.disputeAndRefund(jobId, reason, currentTimeIso);
  }

  // ── Capability Summary (All Modules Wired) ──

  getCapabilitySummary(): CapabilitySummary {
    const p0Gaps: string[] = [];
    if (!this.flags.attestationAvailable) {
      p0Gaps.push("enclave-sdk#242 (AWS Nitro)", "enclave-sdk#241 (Android KeyMint)", "enclave-sdk#240 (Attestation Roots)");
    }

    return {
      coreCapabilities: 12,
      enclaveCapabilities: 16,
      totalCapabilities: 32,
      activeRails: this.settlement.availableRails(Tier.Strict),
      activeTiers: this.flags.attestationAvailable
        ? [Tier.ObserverOnly, Tier.Expedient, Tier.Managed, Tier.Strict]
        : [Tier.ObserverOnly, Tier.Expedient],
      p0GapsDetected: p0Gaps,
      coreModules: {
        controlModel: true,
        cjcs: true,
        verifier: true,
        stacks: true,
        rgb: true,
        babylon: true,
        fedimint: true,
        enclave: true,
        deployment: true,
        lightning: true,
        bitcoin: true,
      },
      enclaveModules: {
        statechain: this.flags.statechainAvailable,
        frost: this.flags.frostAvailable,
        dlc: this.flags.dlcCetAvailable,
        ark: true,
        swapRouter: true,
        settlementService: true,
        stablecoinOrchestrator: true,
        solver: true,
        economy: true,
        jobCard: true,
        identity: true,
        zkml: true,
        opportunity: true,
        credit: true,
        intent: true,
        sidl: true,
      },
      monitoringWatcherEnabled: true,
      trustTierMiddlewareEnabled: true,
      bosYieldSplitterEnabled: true,
      marketAgnosticRouterEnabled: true,
      jobCardEscrowEngineEnabled: true,
    };
  }

  /** Get available rails for a tier (with P0 gap filtering) */
  getAvailableRails(tier: TrustTier): SettlementRail[] {
    return this.settlement.availableRails(tier);
  }
}

// Re-export core types and sub-modules for consumers
export * from "./core_types";
export { GatewayClient } from "./gateway_client";
export { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification";
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
