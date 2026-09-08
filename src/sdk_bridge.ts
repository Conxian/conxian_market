import { ClientInstallerEngine } from "./client_onboarding";
/**
 * Conxian Market SDK Bridge — Unified Client Interface for Marketplace Services.
 *
 * Integrates:
 *   - Gateway Client (relay, RWA verification, blocks, NTT)
 *   - Gateway Verifier (attestation cert verification, trust tier detection)
 *   - Settlement Orchestrator (cross-chain settlement routing across 8 rails)
 *   - SLA Engine (autonomous SLA evaluation, gap card bounties & auto-resolution)
 *   - Monitoring Watcher (sBTC, Fedimint, Babylon, and Treasury health monitoring)
 *   - TrustTier Middleware (HTTP/MCP request verification & routing pipeline)
 *   - BOS Yield Splitter (80/10/10 yield matrix, fee decay, founder vesting, inference policy, Treasury Timelock & Founder Escrow)
 *   - Market-Agnostic Router (Zero-custody validation, BYO DeFi protocol adapter resolution, M2M route execution, Conxian/Conxian deprecation advisory)
 *   - Job Card Escrow Engine (ERC-8183 programmable escrow creation, output submission, SLA-integrated release, dispute/refund handling)
 *   - Fee Calculator (2% protocol fee with tier/rail breakdown)
 *   - x402 Escrow Gateway (Multi-rail HTTP 402 payment demands & ERC-8183 budget locking)
 */

import { GatewayClient, type GatewayConfig } from "./gateway_client";
import { GatewayVerifier, degradeTierForP0Gaps } from "./verification";
import { SettlementOrchestrator } from "./settlement";
import {
  SlaEngine,
  type BuilderReputationRecord,
  type SlaEvaluationResult,
  type GapCard,
  type GapCardAutoResolutionInput,
  type GapCardAutoResolutionResult,
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
  type CapabilitySummary,
  type SLAPenaltySettlementRequest,
  type SLAPenaltySettlementResult,
  type SLAPenaltyClawbackRecord,
  type TimelockTransactionRequest,
  type TimelockValidationResult,
  type FounderEscrowSchedule,
  type FounderEscrowPayoutResult,
} from "./core_types";
import { MonitoringWatcher, type UnifiedHealthSnapshot } from "./monitoring_watcher";
import type {
  BabylonStakingInput,
  FedimintMintInput,
  SbtcHealthInput,
  TreasuryRunwayInput,
} from "./monitoring_watcher";
import {
  TrustTierMiddleware,
  TrustTierLifecycleEngine,
  type TrustTierPipelineRequest,
  type TrustTierPipelineResult,
  type TierUpgradeRequest,
  type TierUpgradeResult,
  type TierDowngradeRequest,
  type TierDowngradeResult,
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
  type DeprecationAdvisory,
  type DefiProtocolAdapter,
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
import {
  jobCardToDemand,
  jobCardToMultiRailDemands,
  X402EscrowGateway,
  type X402PaymentDemand,
  type X402PaymentReceipt,
} from "./x402_facade";

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
  readonly x402EscrowGateway: X402EscrowGateway;
  readonly flags: FeatureFlags;

  private constructor(
    config: GatewayConfig,
    flags: FeatureFlags = DEFAULT_FEATURE_FLAGS
  ) {
    this.flags = flags;
    this.gateway = new GatewayClient(config);
    this.verifier = new GatewayVerifier(this.gateway, flags);
    this.settlement = new SettlementOrchestrator(
      this.gateway,
      this.verifier,
      flags
    );
    this.slaEngine = new SlaEngine();
    this.monitoringWatcher = new MonitoringWatcher();
    this.trustTierMiddleware = new TrustTierMiddleware(flags);
    this.bosYieldSplitter = BosYieldSplitter;
    this.marketAgnosticRouter = MarketAgnosticRouter;
    this.jobCardEscrowEngine = new JobCardEscrowEngine(this.slaEngine);
    this.x402EscrowGateway = new X402EscrowGateway(this.jobCardEscrowEngine);
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

  async executeSettlement(
    request: SettlementRequest
  ): Promise<SettlementResult> {
    return this.settlement.execute(request);
  }

  // ── Capability 6: Autonomous SLA Enforcement, CJCS Gap Cards & Auto-Resolution ──

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

  autoResolveGapCard(input: GapCardAutoResolutionInput): GapCardAutoResolutionResult {
    return this.slaEngine.autoResolveGapCard(input);
  }

  settleSLAPenalty(
    request: SLAPenaltySettlementRequest,
    currentReputation?: BuilderReputationRecord,
    timestampIso?: string
  ): SLAPenaltySettlementResult {
    return this.slaEngine.settleSLAPenalty(request, currentReputation, timestampIso);
  }

  processSLAPenaltyClawback(
    jobId: string,
    totalPenaltySats: bigint,
    timestampIso: string
  ): SLAPenaltyClawbackRecord {
    return this.slaEngine.processSLAPenaltyClawback(jobId, totalPenaltySats, timestampIso);
  }

  evaluateReputationRecovery(
    builder: BuilderReputationRecord,
    consecutiveCompletionsToAdd = 1
  ): BuilderReputationRecord {
    return this.slaEngine.evaluateReputationRecovery(builder, consecutiveCompletionsToAdd);
  }

  updateBuilderReputation(
    current: BuilderReputationRecord,
    event:
      | "sla_breach"
      | "abandonment"
      | "gap_resolved"
      | "quality_dispute"
      | "job_completed"
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

  runTrustTierPipeline(
    request: TrustTierPipelineRequest
  ): TrustTierPipelineResult {
    return this.trustTierMiddleware.executePipeline(request);
  }

  evaluateTierUpgrade(req: TierUpgradeRequest): TierUpgradeResult {
    return this.trustTierMiddleware.evaluateTierUpgrade(req);
  }

  evaluateTierDowngrade(req: TierDowngradeRequest): TierDowngradeResult {
    return this.trustTierMiddleware.evaluateTierDowngrade(req);
  }

  // ── Capability 9: BOS Yield Splitter & Treasury Multi-Sig Timelock ──

  calculateYieldSplit(grossAmountSat: bigint): YieldSplit {
    return BosYieldSplitter.calculateYieldSplit(grossAmountSat);
  }

  distributeProtocolFee(
    grossAmountSat: bigint,
    monthsElapsed: number
  ): ProtocolFeeDistribution {
    return BosYieldSplitter.distributeProtocolFee(grossAmountSat, monthsElapsed);
  }

  evaluateFounderVesting(input: FounderVestingInput): FounderVestingResult {
    return BosYieldSplitter.evaluateFounderVesting(input);
  }

  verifyInferencePolicy(input: InferencePolicyInput): InferencePolicyResult {
    return BosYieldSplitter.verifyInferencePolicy(input);
  }

  validateTimelockAndMultisig(
    req: TimelockTransactionRequest,
    options?: {
      highValueThresholdSats?: bigint;
      requiredQuorum?: number;
    }
  ): TimelockValidationResult {
    return BosYieldSplitter.validateTimelockAndMultisig(req, options);
  }

  processFounderEscrowPayout(
    schedule: FounderEscrowSchedule
  ): FounderEscrowPayoutResult {
    return BosYieldSplitter.processFounderEscrowPayout(schedule);
  }

  // ── Capability 10: Market-Agnostic Non-Custodial Router & BYO DeFi ──

  validateZeroCustody(
    request: NonCustodialSettlementRequest
  ): ZeroCustodyValidationResult {
    return MarketAgnosticRouter.validateZeroCustody(request);
  }

  resolveDefiAdapter(
    rail: SettlementRail,
    preferredProtocol?: string
  ): DefiProtocolAdapter {
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
    return this.jobCardEscrowEngine.evaluateAndRelease(
      jobId,
      currentTimeIso,
      options
    );
  }

  disputeAndRefundJobCardEscrow(
    jobId: string,
    reason: string,
    currentTimeIso: string
  ): EscrowRefundResult {
    return this.jobCardEscrowEngine.disputeAndRefund(
      jobId,
      reason,
      currentTimeIso
    );
  }

  // ── Capability 12: x402 Escrow Gateway ──

  createX402Demand(
    job: Pick<JobCard, "id" | "title" | "description" | "bountySat" | "deadline">,
    rail?: SettlementRail
  ): X402PaymentDemand {
    return jobCardToDemand(job, rail);
  }

  createX402MultiRailDemands(
    job: Pick<JobCard, "id" | "title" | "description" | "bountySat" | "deadline">,
    rails: SettlementRail[]
  ): X402PaymentDemand[] {
    return jobCardToMultiRailDemands(job, rails);
  }

  processX402PaymentAndLockEscrow(
    demand: X402PaymentDemand,
    receipt: X402PaymentReceipt,
    agentProviderDid: string,
    rail: SettlementRail,
    tier: TrustTier
  ): EscrowRecord {
    return this.x402EscrowGateway.processPaymentAndLockEscrow(
      demand,
      receipt,
      agentProviderDid,
      rail,
      tier
    );
  }

  // ── Capability 13: Client Onboarding & System Installation Engine ──

  validateClientConfig(config: import("./core_types").ClientOnboardingConfig): {
    valid: boolean;
    errors: string[];
  } {
    return ClientInstallerEngine.validateClientConfig(config);
  }

  testSystemConnectivity(
    config: import("./core_types").ClientOnboardingConfig,
    timestampIso?: string
  ): import("./core_types").SystemConnectivityReport {
    return ClientInstallerEngine.testSystemConnectivity(config, timestampIso);
  }

  auditZeroCustody(
    config: import("./core_types").ClientOnboardingConfig
  ): import("./core_types").ZeroCustodySanityCheck {
    return ClientInstallerEngine.auditZeroCustody(config);
  }

  provisionClientEnvironment(
    config: import("./core_types").ClientOnboardingConfig,
    timestampIso?: string
  ): import("./core_types").ClientProvisioningResult {
    return ClientInstallerEngine.provisionClientEnvironment(config, timestampIso);
  }

  // ── Capability Summary (All Modules Wired) ──

  getCapabilitySummary(): CapabilitySummary {
    const p0Gaps: string[] = [];
    if (!this.flags.attestationAvailable) {
      p0Gaps.push(
        "enclave-sdk#242 (AWS Nitro)",
        "enclave-sdk#241 (Android KeyMint)",
        "enclave-sdk#240 (Attestation Roots)"
      );
    }

    return {
      coreCapabilities: 13,
      enclaveCapabilities: 16,
      totalCapabilities: 33,
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
      x402EscrowGatewayEnabled: true,
      trustTierLifecycleEnabled: true,
      slaPenaltyEngineEnabled: true,
      treasuryGovernanceEnabled: true,
      clientInstallerEnabled: true,
    };
  }

  /** Get available rails for a tier (with P0 gap filtering) */
  getAvailableRails(tier: TrustTier): SettlementRail[] {
    return this.settlement.availableRails(tier);
  }
}
