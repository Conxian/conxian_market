/**
 * Conxian Market SDK Bridge — Comprehensive Capability Wiring.
 *
 * This module provides a single entry point that wires all 30 SDK
 * capabilities (11 core + 16 enclave-sdk + 1 monitoring-watcher + 1 trust-tier-middleware + 1 bos-yield-splitter) into the market layer.
 *
 * Architecture:
 *   Market SDK Bridge
 *   ├── GatewayClient          → conxian-gateway REST API (50+ endpoints)
 *   ├── SettlementOrch          → multi-rail settlement execution
 *   ├── GatewayVerifier         → attestation verification via gateway + nexus
 *   ├── FeeCalculator           → tier detection, fee computation, revenue projection
 *   ├── SlaEngine               → autonomous SLA enforcement & CJCS gap card generation
 *   ├── MonitoringWatcher       → telemetry, peg status, Fedimint, Babylon & treasury health
 *   ├── TrustTierMiddleware     → 4-stage pricing & rail routing pipeline
 *   ├── BosYieldSplitter        → 80/10/10 yield split, fee decay, founder vesting & thin orchestrator guard
 *   └── FeatureFlags            → P0-gated capability degradation
 */

import type {
  AgentCreditScore,
  AttestationCertificate,
  BuilderIdentity,
  ChainId,
  DlcBond,
  FeatureFlags,
  JobCard,
  M2MSettlement,
  MrrReport,
  Musig2KeyAggregation,
  ProtocolFeeRecord,
  ProtocolFeeReport,
  RevenueProjection,
  RevenueScenario,
  SettlementIntent,
  SettlementRail,
  SettlementRequest,
  SettlementResult,
  TrustTier,
  UsageMetrics,
  YieldOpportunity,
} from "./core_types";
import { DEFAULT_FEATURE_FLAGS, TrustTier as Tier } from "./core_types";
import {
  detectTrustTier as detectTier,
  calculateRailFee,
  selectRail,
  projectRevenue,
  FeeResult,
} from "./fee_calculator";
import { GatewayClient } from "./gateway_client";
import type { GatewayConfig } from "./gateway_client";
import { SettlementOrchestrator } from "./settlement";
import { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification";
import { SlaEngine } from "./sla_engine";
import type { GapCard, SlaEvaluationResult, BuilderReputationRecord } from "./sla_engine";
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

export interface CapabilitySummary {
  coreCapabilities: number; // 11
  enclaveCapabilities: number; // 16
  totalCapabilities: number; // 30
  activeRails: SettlementRail[];
  activeTiers: TrustTier[];
  p0GapsDetected: string[];
  coreModules: Record<string, boolean>;
  enclaveModules: Record<string, boolean>;
  monitoringWatcherEnabled: boolean;
  trustTierMiddlewareEnabled: boolean;
  bosYieldSplitterEnabled: boolean;
}

export class ConxianMarketSDK {
  readonly gateway: GatewayClient;
  readonly verifier: GatewayVerifier;
  readonly settlement: SettlementOrchestrator;
  readonly slaEngine: SlaEngine;
  readonly monitoringWatcher: MonitoringWatcher;
  readonly trustTierMiddleware: TrustTierMiddleware;
  readonly bosYieldSplitter: typeof BosYieldSplitter;
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
    return calculateRailFee(amountSat, tier, rail);
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

  // ── Capability Summary (All Modules Wired) ──

  getCapabilitySummary(): CapabilitySummary {
    const p0Gaps: string[] = [];
    if (!this.flags.attestationAvailable) {
      p0Gaps.push("enclave-sdk#242 (AWS Nitro)", "enclave-sdk#241 (Android KeyMint)", "enclave-sdk#240 (Attestation Roots)");
    }

    return {
      coreCapabilities: 11,
      enclaveCapabilities: 16,
      totalCapabilities: 30,
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
