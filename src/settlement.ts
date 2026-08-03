/**
 * Conxian Settlement Orchestration.
 *
 * Multi-rail settlement execution across all 8 settlement rails.
 * Integrates with conxian-gateway for settlement execution and
 * conxian-nexus for proof verification.
 *
 * Settlement rails: Statechain, sBTC, RGB, Babylon, Fedimint,
 *                   Lightning, ALEX/Stacks, EVM/ERC-8183
 */

import type {
  FeatureFlags,
  JobCard,
  JobCardStatus,
  M2MSettlement,
  ProtocolFeeReport,
  SettlementIntent,
  SettlementRail,
  SettlementRequest,
  SettlementResult,
  TrustTier,
  VtxoTransfer,
  YieldOpportunity,
} from "./core_types.ts";
import { SettlementRail as Rail, TrustTier as Tier } from "./core_types.ts";
import { DEFAULT_FEATURE_FLAGS } from "./core_types.ts";
import type { GatewayClient } from "./gateway_client.ts";
import type { Verifier } from "./verification.ts";

// ── Settlement Orchestrator ──

export class SettlementOrchestrator {
  constructor(
    private readonly gateway: GatewayClient,
    private readonly verifier: Verifier,
    private readonly flags: FeatureFlags = DEFAULT_FEATURE_FLAGS,
  ) {}

  /** Execute a full settlement: attest → fee → route → settle */
  async execute(request: SettlementRequest): Promise<SettlementResult> {
    // 1. Verify attestation (or degrade tier for P0 gaps)
    let tier = request.tier;
    if (request.attestation) {
      tier = await this.verifier.detectTier(request.attestation);
    }

    // 2. Validate rail availability at tier
    if (!this.isRailAvailable(tier, request.rail)) {
      return {
        success: false,
        settlementId: request.id,
        fee: this.emptyFee(request),
        rail: request.rail,
        error: `Rail ${request.rail} not available at tier ${tier}`,
      };
    }

    // 3. Submit to gateway
    try {
      const card: JobCard = {
        id: request.id,
        title: `Settlement ${request.id}`,
        description: "",
        bountySat: request.amountSat,
        rail: request.rail,
        tier,
        status: "COMPLETED" as JobCardStatus,
        builderId: request.builderId,
        createdAt: Math.floor(Date.now() / 1000),
      };

      const result = await this.gateway.settleJobCard(card);
      return result;
    } catch (err) {
      return {
        success: false,
        settlementId: request.id,
        fee: this.emptyFee(request),
        rail: request.rail,
        error: String(err),
      };
    }
  }

  /** Execute M2M (machine-to-machine) settlement */
  async settleM2M(settlement: M2MSettlement): Promise<{ txId: string }> {
    return this.gateway.settleM2M(settlement);
  }

  /** Execute ALEX swap for cross-rail settlement */
  async alexSwap(params: { from: string; to: string; amount: string }): Promise<{ txId: string }> {
    const quote = await this.gateway.getAlexQuote(params);
    const prepared = await this.gateway.prepareAlexSwap(quote);
    return this.gateway.executeAlexSwap(prepared);
  }

  /** Execute DLC bond for prediction-market settlement */
  async createDlcBond(params: {
    oracle: string;
    outcome: string;
    amountSat: bigint;
    maturity: number;
  }) {
    if (!this.flags.dlcCetAvailable) {
      throw new Error("DLC CET execution path not available (gateway stub)");
    }
    return this.gateway.createDlcBond(params);
  }

  /** Aggregate MuSig2 keys for threshold signing */
  async aggregateKeys(publicKeys: string[]) {
    return this.gateway.aggregateMusig2Keys(publicKeys);
  }

  /** Get all external settlements in a time range */
  async getSettlements(params?: { rail?: SettlementRail; from?: number; to?: number }) {
    return this.gateway.getExternalSettlements(params);
  }

  // ── Rail Availability ──

  private readonly RAILS_BY_TIER: Record<TrustTier, SettlementRail[]> = {
    [Tier.ObserverOnly]: [],
    [Tier.Expedient]: [Rail.Lightning, Rail.Fedimint, Rail.AlexStacks, Rail.EvmErc8183],
    [Tier.Managed]: Object.values(Rail),
    [Tier.Strict]: Object.values(Rail),
  };

  isRailAvailable(tier: TrustTier, rail: SettlementRail): boolean {
    return this.RAILS_BY_TIER[tier].includes(rail);
  }

  availableRails(tier: TrustTier): SettlementRail[] {
    const rails = this.RAILS_BY_TIER[tier];
    // Filter out P0-gated rails
    return rails.filter((r) => {
      if (r === Rail.Statechain && !this.flags.statechainAvailable) return false;
      return true;
    });
  }

  private emptyFee(req: SettlementRequest): {
    settlementId: string; rail: SettlementRail; tier: TrustTier;
    amountSat: bigint; feeSat: bigint; feeBps: number;
    timestamp: number; builderId: string;
  } {
    return {
      settlementId: req.id,
      rail: req.rail,
      tier: req.tier,
      amountSat: req.amountSat,
      feeSat: 0n,
      feeBps: 0,
      timestamp: Math.floor(Date.now() / 1000),
      builderId: req.builderId,
    };
  }
}

// ── Settlement Rail Capabilities (per SETTLEMENT_RAILS.md) ──

export interface RailCapability {
  rail: SettlementRail;
  name: string;
  description: string;
  ready: boolean;         // Is the adapter production-ready?
  hasFeeStructure: boolean;
  requiresAttestation: boolean;
}

export const RAIL_CAPABILITIES: RailCapability[] = [
  {
    rail: Rail.Statechain,
    name: "Statechain (Spark)",
    description: "Off-chain BTC settlement with 1-of-n trust — VTXO transfers for AI labor",
    ready: false,  // ProtocolUnsupported gate
    hasFeeStructure: true,
    requiresAttestation: true,
  },
  {
    rail: Rail.Sbtc,
    name: "sBTC Bridge",
    description: "sBTC peg lifecycle monitoring for settlement liquidity",
    ready: true,   // Gateway production
    hasFeeStructure: true,
    requiresAttestation: false,
  },
  {
    rail: Rail.Rgb,
    name: "RGB Asset Protocol",
    description: "Contract-backed asset settlement, RGB-20/21 token registry",
    ready: false,  // rgb_stash.rs not wired (#228)
    hasFeeStructure: true,
    requiresAttestation: true,
  },
  {
    rail: Rail.Babylon,
    name: "Babylon Staking",
    description: "BTC staking yield → market treasury diversification",
    ready: true,   // Gateway production
    hasFeeStructure: true,
    requiresAttestation: false,
  },
  {
    rail: Rail.Fedimint,
    name: "Fedimint Federation",
    description: "Federation-based community settlement pools",
    ready: true,   // Gateway production
    hasFeeStructure: true,
    requiresAttestation: false,
  },
  {
    rail: Rail.Lightning,
    name: "Lightning (SRL-1)",
    description: "SRL-1 Lightning resilience for micro-settlement",
    ready: true,   // Nexus production
    hasFeeStructure: true,
    requiresAttestation: false,
  },
  {
    rail: Rail.AlexStacks,
    name: "ALEX / Stacks",
    description: "sBTC/USDC pools for AI labor settlement, ALEX Launchpad",
    ready: true,   // Gateway production
    hasFeeStructure: true,
    requiresAttestation: false,
  },
  {
    rail: Rail.EvmErc8183,
    name: "EVM / ERC-8183",
    description: "Cross-chain ERC-8183 programmable escrow on EVM chains",
    ready: true,   // Gateway production
    hasFeeStructure: true,
    requiresAttestation: false,
  },
];
