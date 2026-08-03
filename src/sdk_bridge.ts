/**
 * Conxian Market SDK Bridge — Comprehensive Capability Wiring.
 *
 * This module provides a single entry point that wires all 27 SDK
 * capabilities (11 core + 16 enclave-sdk) into the market layer.
 *
 * Architecture:
 *   Market SDK Bridge
 *   ├── GatewayClient      → conxian-gateway REST API (50+ endpoints)
 *   ├── SettlementOrch      → multi-rail settlement execution
 *   ├── GatewayVerifier     → attestation verification via gateway + nexus
 *   ├── FeeCalculator       → tier detection, fee computation, revenue projection
 *   └── FeatureFlags        → P0-gated capability degradation
 *
 * SDK capabilities wired (Session 48):
 *   Core (11): control_model, cjcs, verifier, stacks, rgb, babylon,
 *              fedimint, enclave, deployment, lightning, bitcoin
 *   Enclave (16): statechain, frost, dlc, ark, swap_router,
 *                 settlement_service, stablecoin_orchestrator, solver,
 *                 economy, job_card, identity, zkml, opportunity,
 *                 credit, intent, sidl
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
} from "./core_types.ts";
import { DEFAULT_FEATURE_FLAGS, TrustTier as Tier } from "./core_types.ts";
import {
  detectTrustTier as detectTier,
  calculateRailFee,
  selectRail,
  generateFeeReport,
  projectRevenue,
  toWireHeaders,
} from "./fee_calculator.ts";
import type {
  AttestationHeaders,
  FeeReport,
  FeeResult,
  RailPreference,
  SettlementEvent,
} from "./fee_calculator.ts";
import { GatewayClient } from "./gateway_client.ts";
import type { GatewayConfig } from "./gateway_client.ts";
import { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification.ts";
import { RAIL_CAPABILITIES, SettlementOrchestrator } from "./settlement.ts";
import type { RailCapability } from "./settlement.ts";

// ── Main SDK Bridge ──

export class ConxianMarketSDK {
  readonly gateway: GatewayClient;
  readonly settlement: SettlementOrchestrator;
  readonly verifier: GatewayVerifier;
  readonly flags: FeatureFlags;

  private constructor(
    gateway: GatewayClient,
    flags: FeatureFlags,
  ) {
    this.gateway = gateway;
    this.flags = flags;
    this.verifier = new GatewayVerifier(gateway, flags);
    this.settlement = new SettlementOrchestrator(gateway, this.verifier, flags);
  }

  /** Create SDK instance connected to a live gateway */
  static async connect(config: GatewayConfig, flags?: FeatureFlags): Promise<ConxianMarketSDK> {
    const client = new GatewayClient(config);
    const ff = flags ?? DEFAULT_FEATURE_FLAGS;

    // Verify connection
    const health = await client.health();
    if (health.status !== "ok") {
      throw new Error(`Gateway unhealthy: ${JSON.stringify(health)}`);
    }

    return new ConxianMarketSDK(client, ff);
  }

  /** Create SDK instance in offline mode (no gateway connection) */
  static offline(flags?: FeatureFlags): ConxianMarketSDK {
    const noopConfig: GatewayConfig = { baseUrl: "http://localhost:0", apiToken: "offline" };
    return new ConxianMarketSDK(new GatewayClient(noopConfig), flags ?? DEFAULT_FEATURE_FLAGS);
  }

  // ── Core Module: control_model (TrustTier) ──

  /** Detect trust tier from attestation headers, with live verification */
  async detectTrustTier(headers: AttestationHeaders): Promise<TrustTier> {
    return detectTier(
      headers,
      (tee, zk) => this.verifier.verifyTeeZk(tee, zk),
      (p) => this.verifier.verifyEnclave(p),
      (p) => this.verifier.verifyLight(p),
    );
  }

  /** Detect trust tier statically (no verification) */
  detectTrustTierStatic(headers: AttestationHeaders): TrustTier {
    return detectTrustTierStatic(headers);
  }

  /** Degrade tier for P0 gaps */
  degradeTier(tier: TrustTier): TrustTier {
    return degradeTierForP0Gaps(tier, this.flags);
  }

  // ── Core Module: Fee Calculator (CON-1427) ──

  /** Calculate protocol fee for a settlement */
  calculateFee(amountSat: bigint, tier: TrustTier, rail: SettlementRail): FeeResult {
    return calculateRailFee(amountSat, tier, rail);
  }

  /** Select best settlement rail by preference */
  selectRail(tier: TrustTier, preference?: RailPreference): SettlementRail | null {
    return selectRail(tier, preference);
  }

  /** Generate protocol fee report */
  generateFeeReport(events: SettlementEvent[], start: number, end: number): FeeReport {
    return generateFeeReport(events, start, end);
  }

  /** Convert fee result to gateway wire headers */
  toWireHeaders(fee: FeeResult): Record<string, string> {
    return toWireHeaders(fee);
  }

  /** Project revenue for a scenario */
  projectRevenue(scenario: RevenueScenario): RevenueProjection {
    return projectRevenue(scenario);
  }

  // ── Core Module: verifier ──

  /** Verify attestation through gateway/nexus */
  async verifyAttestation(cert: AttestationCertificate) {
    return this.verifier.detectTier(cert);
  }

  // ── Core Module: stacks (SBTCBridge) ──

  /** Get chain height for Stacks */
  async getStacksHeight() {
    return this.gateway.getChainHeight("stacks" as ChainId);
  }

  // ── Core Module: bitcoin (taproot, bip322) ──

  /** Get mempool telemetry */
  async getMempoolTelemetry() {
    return this.gateway.getMempoolTelemetry();
  }

  /** Get Bitcoin Core shadow observation */
  async getShadowObservation() {
    return this.gateway.getShadowObservation();
  }

  // ── Core Module: lightning (LightningAdapter) ──

  /** List supported chains (includes Lightning) */
  async listSupportedChains() {
    return this.gateway.listSupportedChains();
  }

  // ── Core Module: deployment (DeploymentPlan) ──

  /** Request release approval */
  async requestReleaseApproval(version: string, notes: string) {
    return this.gateway.requestReleaseApproval(version, notes);
  }

  // ── Core Module: enclave (AttestationCertificate) ──

  /** Verify Cantón cBTC attestation */
  async verifyCbtcAttestation(proof: Record<string, unknown>) {
    return this.gateway.verifyCbtcAttestation(proof);
  }

  // ── Enclave Module: identity (DID-based builder reputation) ──

  /** Resolve builder identity from DID */
  async resolveIdentity(did: string): Promise<BuilderIdentity> {
    return this.gateway.resolveIdentity(did);
  }

  /** Exchange identity */
  async exchangeIdentity(did: string): Promise<BuilderIdentity> {
    return this.gateway.exchangeIdentity(did);
  }

  /** Resolve machine identity */
  async resolveMachineIdentity(machineId: string) {
    return this.gateway.resolveMachineIdentity(machineId);
  }

  // ── Enclave Module: settlement_service (multi-rail settlement) ──

  /** Execute a settlement */
  async executeSettlement(request: SettlementRequest): Promise<SettlementResult> {
    return this.settlement.execute(request);
  }

  /** Get all external settlements */
  async getSettlements(params?: { rail?: SettlementRail; from?: number; to?: number }) {
    return this.settlement.getSettlements(params);
  }

  // ── Enclave Module: swap_router (cross-rail yield optimization) ──

  /** Get ALEX swap quote */
  async getAlexQuote(params: { from: string; to: string; amount: string }) {
    return this.gateway.getAlexQuote(params);
  }

  /** Execute ALEX swap */
  async executeAlexSwap(params: { from: string; to: string; amount: string }) {
    return this.settlement.alexSwap(params);
  }

  // ── Enclave Module: economy (M2M machine economy) ──

  /** Settle M2M payment */
  async settleM2M(settlement: M2MSettlement) {
    return this.settlement.settleM2M(settlement);
  }

  // ── Enclave Module: dlc (Discreet Log Contracts) ──

  /** Create DLC bond for prediction market settlement */
  async createDlcBond(params: {
    oracle: string;
    outcome: string;
    amountSat: bigint;
    maturity: number;
  }): Promise<DlcBond> {
    return this.settlement.createDlcBond(params);
  }

  // ── Enclave Module: frost (threshold signing) ──

  /** Aggregate MuSig2 keys for threshold signing */
  async aggregateKeys(publicKeys: string[]): Promise<Musig2KeyAggregation> {
    return this.settlement.aggregateKeys(publicKeys);
  }

  // ── Enclave Module: stablecoin_orchestrator ──

  /** Get ALEX quote for stablecoin routing */
  async getStablecoinRoute(from: string, to: string, amount: string) {
    return this.gateway.getAlexQuote({ from, to, amount });
  }

  // ── Enclave Module: intent (intent-based settlement) ──

  /** Route CCIP cross-chain message (intent-based settlement) */
  async routeIntent(message: Record<string, unknown>) {
    return this.gateway.routeCcipMessage(message);
  }

  // ── Enclave Module: opportunity (yield opportunity discovery) ──

  /** Get available yield opportunities across rails */
  getYieldOpportunities(): YieldOpportunity[] {
    return [
      {
        id: "babylon-staking",
        rail: "BABYLON" as SettlementRail,
        apy: 4.0,
        asset: "BTC",
        minAmountSat: 100_000n,
        riskLevel: "low",
        lockupDays: 90,
      },
      {
        id: "alex-lp",
        rail: "ALEX_STACKS" as SettlementRail,
        apy: 12.0,
        asset: "sBTC/USDC",
        minAmountSat: 1_000_000n,
        riskLevel: "medium",
        lockupDays: 30,
      },
    ];
  }

  // ── Enclave Module: credit (agent credit scoring) ──

  /** Compute agent credit score from identity + settlement history */
  computeCreditScore(identity: BuilderIdentity, settleCount: number, disputeCount: number): AgentCreditScore {
    const volumeWeighted = Math.min(100, settleCount * 2);
    const disputeRate = settleCount > 0 ? Math.max(0, 100 - (disputeCount / settleCount) * 100) : 50;
    const identityAge = Math.min(100, identity.reputation);

    return {
      agentId: identity.did,
      score: Math.round((volumeWeighted * 0.3 + disputeRate * 0.4 + identityAge * 0.3)),
      factors: { settlementHistory: volumeWeighted, disputeRate, volumeWeighted, identityAge },
    };
  }

  // ── Enclave Module: job_card (CJCS integration) ──

  /** Toggle bounty payouts */
  async toggleBountyPayouts(enabled: boolean) {
    return this.gateway.toggleBountyPayouts(enabled);
  }

  // ── Enclave Module: solver (Fill-or-Kill solver) ──

  /** Find best settlement route for an intent */
  findBestRoute(intent: SettlementIntent, availableRails: SettlementRail[]): SettlementRail | null {
    // Simple solver: prefer Lightning (cheapest), then Fedimint, then ALEX
    const preference: SettlementRail[] = [
      "LIGHTNING" as SettlementRail,
      "FEDIMINT" as SettlementRail,
      "ALEX_STACKS" as SettlementRail,
    ];
    return preference.find((r) => availableRails.includes(r)) ?? availableRails[0] ?? null;
  }

  // ── Enclave Module: zkml (ZK-ML proof verification) ──

  /** Verify state proof on a specific chain */
  async verifyStateProof(chain: ChainId, proof: Record<string, unknown>) {
    return this.gateway.verifyStateProof(chain, proof);
  }

  // ── Enclave Module: sidl (Sovereign IDL) ──

  /** Prepare a cross-chain transaction */
  async prepareCrossChainTx(chain: ChainId, tx: Record<string, unknown>) {
    return this.gateway.prepareChainTx(chain, tx);
  }

  // ── Enclave Module: statechain (Spark VTXO) ──

  /** Check if Statechain (Spark) is available */
  isStatechainAvailable(): boolean {
    return this.flags.statechainAvailable;
  }

  // ── Enclave Module: ark (vTXO payment pools) ──

  /** Check if Ark is available */
  isArkAvailable(): boolean {
    return this.flags.arkAvailable;
  }

  // ── Billing ──

  /** Generate MRR billing report */
  async generateMrrReport(usage: UsageMetrics): Promise<MrrReport> {
    return this.gateway.generateMrrReport(usage);
  }

  /** Submit protocol fee report to gateway */
  async submitFeeReport(report: ProtocolFeeReport) {
    return this.gateway.submitFeeReport(report);
  }

  // ── Governance ──

  /** Submit governance decision */
  async submitGovernanceDecision(decision: Record<string, unknown>) {
    return this.gateway.submitGovernanceDecision(decision);
  }

  // ── Handoff ──

  /** Get SAB handoff status */
  async getHandoffStatus() {
    return this.gateway.getHandoffStatus();
  }

  /** Update SAB handoff state */
  async updateHandoffState(state: Record<string, unknown>) {
    return this.gateway.updateHandoffState(state);
  }

  // ── ISO 20022 ──

  /** Generate ISO 20022 payment message */
  async generateIsoPayment(params: Record<string, unknown>) {
    return this.gateway.generateIsoPayment(params);
  }

  // ── RWA ──

  /** Verify machine RWA revenue */
  async verifyMachineRwaRevenue(machineId: string) {
    return this.gateway.verifyMachineRwaRevenue(machineId);
  }

  // ── State ──

  /** Get full gateway state */
  async getState() {
    return this.gateway.getState();
  }

  /** Get gateway metrics */
  async getMetrics() {
    return this.gateway.getMetrics();
  }

  // ── Rail Capabilities ──

  /** Get all rail capabilities with readiness status */
  getRailCapabilities(): RailCapability[] {
    return RAIL_CAPABILITIES;
  }

  /** Check if a specific rail is ready */
  isRailReady(rail: SettlementRail): boolean {
    return RAIL_CAPABILITIES.find((r) => r.rail === rail)?.ready ?? false;
  }

  /** Get available rails for a tier (with P0 gap filtering) */
  availableRails(tier: TrustTier): SettlementRail[] {
    return this.settlement.availableRails(tier);
  }

  // ── Capability Summary ──

  /** Get summary of all wired capabilities */
  getCapabilitySummary(): CapabilitySummary {
    return {
      coreModules: {
        controlModel: true,
        cjcs: true,
        verifier: this.flags.attestationAvailable,
        stacks: true,
        rgb: false, // Gateway #228 pending
        babylon: true,
        fedimint: true,
        enclave: this.flags.attestationAvailable,
        deployment: true,
        lightning: true,
        bitcoin: true,
      },
      enclaveModules: {
        statechain: this.flags.statechainAvailable,
        frost: this.flags.frostAvailable,
        dlc: this.flags.dlcCetAvailable,
        ark: this.flags.arkAvailable,
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
      revenueStreams: {
        protocolFee: this.flags.protocolFeeActive,
        premiumSurcharge: this.flags.attestationAvailable,
        institutional: false, // TEE+ZK P0s pending
        communityPools: true,
        stakingYield: true,
      },
    };
  }
}

export interface CapabilitySummary {
  coreModules: Record<string, boolean>;
  enclaveModules: Record<string, boolean>;
  revenueStreams: Record<string, boolean>;
}

// ── Re-exports for convenience ──

export { GatewayClient } from "./gateway_client.ts";
export { GatewayVerifier, detectTrustTierStatic, degradeTierForP0Gaps } from "./verification.ts";
export { SettlementOrchestrator, RAIL_CAPABILITIES } from "./settlement.ts";
export {
  detectTrustTier,
  calculateRailFee,
  selectRail,
  generateFeeReport,
  projectRevenue,
  toWireHeaders,
} from "./fee_calculator.ts";
export {
  Tier as TrustTierEnum,
  DEFAULT_FEATURE_FLAGS,
} from "./core_types.ts";
export type {
  AttestationHeaders,
  FeeReport,
  FeeResult,
  RailPreference,
  SettlementEvent,
} from "./fee_calculator.ts";
export type { GatewayConfig } from "./gateway_client.ts";
export type { RailCapability } from "./settlement.ts";
