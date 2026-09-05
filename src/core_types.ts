/**
 * Conxian Core Types — TypeScript mirror of lib-conxian-core + conxius-enclave-sdk.
 *
 * These types align with the Rust definitions in:
 *   - lib-conxian-core: TrustTier, SettlementRail, control_model, verifier
 *   - conxius-enclave-sdk: AttestationCertificate, FROST, DLC, Ark, Statechain
 *   - conxian-gateway: ProtocolFeeRecord, billing types
 *
 * Canonical source of truth: lib-conxian-core/src/ (Rust)
 */

// ── Trust Tier (lib-conxian-core: control_model) ──

export enum TrustTier {
  ObserverOnly = "OBSERVER_ONLY",
  Expedient = "EXPEDIENT",
  Managed = "MANAGED",
  Strict = "STRICT",
}

// ── Settlement Rails (lib-conxian-core: chain adapters) ──

export enum SettlementRail {
  Statechain = "STATECHAIN",
  Sbtc = "SBTC",
  Rgb = "RGB",
  Babylon = "BABYLON",
  Fedimint = "FEDIMINT",
  Lightning = "LIGHTNING",
  AlexStacks = "ALEX_STACKS",
  EvmErc8183 = "EVM_ERC8183",
}

// ── Chain Identifiers (80+ in lib-conxian-core verifier) ──

export enum ChainId {
  Bitcoin = "bitcoin",
  Stacks = "stacks",
  Liquid = "liquid",
  Rootstock = "rootstock",
  Lightning = "lightning",
  Fedimint = "fedimint",
  Citrea = "citrea",
  Arbitrum = "arbitrum",
  Optimism = "optimism",
  Base = "base",
  Polygon = "polygon",
  Avalanche = "avalanche",
  Solana = "solana",
  Canton = "canton",
}

// ── Attestation (conxius-enclave-sdk) ──

export interface AttestationCertificate {
  /** AWS Nitro / Intel SGX attestation document */
  tee_proof?: string;
  /** ZK proof of correct execution */
  zk_proof?: string;
  /** Enclave SDK attestation (without ZK) */
  enclave_attestation?: string;
  /** Light client proof (SPV/MMR) */
  light_proof?: string;
  /** Height of the proof */
  proof_height?: number;
  /** Hash of the proof */
  proof_hash?: string;
}

export interface AttestationResult {
  valid: boolean;
  tier: TrustTier;
  certificate?: AttestationCertificate;
  error?: string;
}

// ── Protocol Fee Types (CON-1427 gateway bridge) ──

export interface ProtocolFeeRecord {
  settlementId: string;
  rail: SettlementRail;
  tier: TrustTier;
  amountSat: bigint;
  feeSat: bigint;
  feeBps: number;
  timestamp: number;
  builderId: string;
  txId?: string;
}

export interface RailFeeBreakdown {
  rail: SettlementRail;
  count: number;
  totalAmountSat: bigint;
  totalFeeSat: bigint;
  avgFeeBps: number;
}

export interface TierFeeBreakdown {
  tier: TrustTier;
  count: number;
  totalFeeSat: bigint;
}

export interface ProtocolFeeReport {
  periodStart: number;
  periodEnd: number;
  totalSettledSat: bigint;
  totalFeesSat: bigint;
  effectiveFeeBps: number;
  byRail: RailFeeBreakdown[];
  byTier: TierFeeBreakdown[];
  eventCount: number;
}

// ── Settlement Types ──

export interface SettlementRequest {
  id: string;
  amountSat: bigint;
  rail: SettlementRail;
  tier: TrustTier;
  builderId: string;
  attestation?: AttestationCertificate;
  metadata?: Record<string, string>;
}

export interface SettlementResult {
  success: boolean;
  settlementId: string;
  fee: ProtocolFeeRecord;
  txId?: string;
  rail: SettlementRail;
  error?: string;
}

// ── Job Card (CJCS — conxius-enclave-sdk: job_card) ──

export interface JobCard {
  id: string;
  title: string;
  description: string;
  bountySat: bigint;
  rail: SettlementRail;
  tier: TrustTier;
  sla_template?: SlaTemplate;
  status: JobCardStatus;
  builderId?: string;
  createdAt: number;
  deadline?: number;
}

export enum JobCardStatus {
  Open = "OPEN",
  Assigned = "ASSIGNED",
  InProgress = "IN_PROGRESS",
  Completed = "COMPLETED",
  Disputed = "DISPUTED",
  Cancelled = "CANCELLED",
}

// ── SLA Templates (conxius-enclave-sdk: job_card SLA) ──

export interface SlaTemplate {
  tier: TrustTier;
  uptime: string;
  latencyP95: string;
  proofRequirement: string;
  disputeResolution: string;
  penalty: string;
  autoBounty: boolean;
  supportResponse: string;
}

// ── DLC Types (conxius-enclave-sdk: dlc) ──

export interface DlcBond {
  id: string;
  oracle: string;
  outcome: string;
  amountSat: bigint;
  maturity: number;
  status: DlcBondStatus;
}

export enum DlcBondStatus {
  Pending = "PENDING",
  Funded = "FUNDED",
  Executed = "EXECUTED",
  Refunded = "REFUNDED",
}

// ── FROST / MuSig2 Types (conxius-enclave-sdk: frost) ──

export interface Musig2KeyAggregation {
  publicKeys: string[];
  aggregatedKey: string;
  threshold: number;
}

// ── Statechain Types (conxius-enclave-sdk: statechain Spark) ──

export interface VtxoTransfer {
  vtxoId: string;
  from: string;
  to: string;
  amountSat: bigint;
  statechainEntity: string;
  timestamp: number;
}

// ── M2M Economy Types (conxius-enclave-sdk: economy) ──

export interface M2MSettlement {
  id: string;
  fromAgent: string;
  toAgent: string;
  amountSat: bigint;
  rail: SettlementRail;
  purpose: string;
  timestamp: number;
}

// ── Identity Types (conxius-enclave-sdk: identity) ──

export interface BuilderIdentity {
  did: string;
  reputation: number; // 0-100
  tier: TrustTier;
  enrolledAt: number;
  verifiedChains: ChainId[];
}

// ── Intent Types (conxius-enclave-sdk: intent) ──

export interface SettlementIntent {
  id: string;
  declarer: string;
  action: "settle" | "route" | "swap" | "stake";
  params: Record<string, string>;
  solver?: string;
  status: "pending" | "solving" | "executed" | "failed";
}

// ── Credit Types (conxius-enclave-sdk: credit) ──

export interface AgentCreditScore {
  agentId: string;
  score: number; // 0-100
  factors: {
    settlementHistory: number;
    disputeRate: number;
    volumeWeighted: number;
    identityAge: number;
  };
}

// ── Yield Types (conxius-enclave-sdk: opportunity) ──

export interface YieldOpportunity {
  id: string;
  rail: SettlementRail;
  apy: number; // e.g., 4.5 = 4.5%
  asset: string;
  minAmountSat: bigint;
  riskLevel: "low" | "medium" | "high";
  lockupDays: number;
}

// ── Gateway Billing Types ──

export interface UsageMetrics {
  relayMessages: number;
  rwaVerifications: number;
  settlementOps: number;
  bitcoinBlocksObserved: number;
  stacksBlocksObserved: number;
  nttVolumeSats: bigint;
}

export interface MrrReport {
  period: { startUnix: number; endUnix: number };
  usage: UsageMetrics;
  totalCostCents: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitCostCents: number;
    subtotalCents: number;
  }>;
  enterpriseDiscountApplied: boolean;
}

// ── Revenue Types ──

export interface RevenueScenario {
  name: string;
  monthlyVolumeUsd: number;
  btcPriceUsd: number;
}

export interface RevenueProjection {
  scenario: string;
  byStream: {
    protocolFee: number;
    premiumSurcharge: number;
    institutional: number;
    communityPools: number;
    stakingYield: number;
  };
  totalMonthlyUsd: number;
  pctOfTarget: number;
}

// ── Feature Flags (P0-gated capabilities) ──

export interface FeatureFlags {
  /** P0-1/P0-2/P0-3: Enclave attestation available */
  attestationAvailable: boolean;
  /** P0-4: CCTP fail-closed enforced */
  cctpFailClosed: boolean;
  /** P0-7/CON-1427: Protocol fee collection active on-chain */
  protocolFeeActive: boolean;
  /** Statechain (Spark) VTXO protocol unlocked */
  statechainAvailable: boolean;
  /** BitVM2 optimistic proof verification available */
  bitvm2Available: boolean;
  /** FROST DKG available */
  frostAvailable: boolean;
  /** Ark vTXO payment pools available */
  arkAvailable: boolean;
  /** DLC CET execution path available */
  dlcCetAvailable: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  attestationAvailable: false,   // P0-1..P0-3
  cctpFailClosed: true,          // P0-4 enforced by gateway
  protocolFeeActive: false,      // P0-7 Phase C pending
  statechainAvailable: false,    // ProtocolUnsupported gate
  bitvm2Available: false,        // ProtocolUnsupported gate
  frostAvailable: false,         // ProtocolUnsupported gate
  arkAvailable: false,           // ProtocolUnsupported gate
  dlcCetAvailable: false,        // CET stub
};

export interface CapabilitySummary {
  coreCapabilities: number;
  enclaveCapabilities: number;
  totalCapabilities: number;
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
  x402EscrowGatewayEnabled?: boolean;
}
