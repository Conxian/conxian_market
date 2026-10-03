/**
 * ERC-8004-aligned agent identity registry.
 *
 * ERC-8004 (EIP-8004) defines on-chain AI-agent identity, reputation, and
 * validation (Ethereum Foundation, MetaMask, Google, Coinbase). Conxian aligns
 * to its *semantics* on Bitcoin/Stacks rails (a SIP-010 NFT or Clarity map
 * anchors the identity) rather than deploying an EVM ERC-721. This module is
 * the off-chain SDK surface: a canonical AgentCard identity plus a fail-closed
 * authorization gate bound to a SHA-256 card digest.
 */
import { createHash } from "node:crypto";
import { TrustTier } from "./core_types.js";

export interface AgentCapability {
  name: string;
  description?: string;
  version?: string;
}

export interface AgentIdentityAnchor {
  /** Stacks SIP-010 NFT contract principal. */
  contract: string;
  /** Token id of the NFT anchoring this agent identity. */
  tokenId: string;
}

export interface AgentCard {
  /** Stable agent identifier (DID or Stacks principal). */
  agentId: string;
  name: string;
  description?: string;
  /** DID of the provider/organization owning this agent. */
  providerDid: string;
  capabilities: AgentCapability[];
  /** Canonical endpoints the agent exposes (MCP / x402). */
  endpoints: string[];
  /** Minimum trust tier required to authorise this agent for value-bearing work. */
  minimumTier: TrustTier;
  /** Optional on-chain identity anchor (SIP-010). */
  identityAnchor?: AgentIdentityAnchor;
  issuedAt: number;
}

export interface AgentReputationRecord {
  agentId: string;
  cardDigest: string;
  tasksCompleted: number;
  /** SLA compliance in basis points (10000 = perfect). */
  slaComplianceBps: number;
  disputesLost: number;
  updatedAt: number;
}

export interface AgentRegistryEntry {
  card: AgentCard;
  cardDigest: string;
  reputation?: AgentReputationRecord;
}

const TIER_RANK: Record<TrustTier, number> = {
  [TrustTier.ObserverOnly]: 0,
  [TrustTier.Expedient]: 1,
  [TrustTier.Managed]: 2,
  [TrustTier.Strict]: 3,
};

function tierRank(tier: TrustTier): number {
  return TIER_RANK[tier];
}

function canonicalCard(card: AgentCard): string {
  return JSON.stringify({
    agentId: card.agentId,
    name: card.name,
    providerDid: card.providerDid,
    capabilities: [...card.capabilities]
      .map((c) => ({ name: c.name, version: c.version ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    endpoints: [...card.endpoints].sort(),
    minimumTier: card.minimumTier,
    identityAnchor: card.identityAnchor ?? null,
    issuedAt: card.issuedAt,
  });
}

/** SHA-256 digest binding an AgentCard to its issuer (fail-closed identity). */
export function agentCardDigest(card: AgentCard): string {
  return createHash("sha256").update(canonicalCard(card)).digest("hex");
}

/** In-memory registry of ERC-8004-aligned agent identities. */
export class AgentRegistry {
  private readonly entries = new Map<string, AgentRegistryEntry>();

  register(card: AgentCard): AgentRegistryEntry {
    const cardDigest = agentCardDigest(card);
    const entry: AgentRegistryEntry = { card, cardDigest };
    this.entries.set(card.agentId, entry);
    return entry;
  }

  get(agentId: string): AgentRegistryEntry | undefined {
    return this.entries.get(agentId);
  }

  updateReputation(record: AgentReputationRecord): void {
    const entry = this.entries.get(record.agentId);
    if (!entry) {
      throw new Error(`Unknown agent: ${record.agentId}`);
    }
    if (record.cardDigest !== entry.cardDigest) {
      throw new Error("Reputation cardDigest does not match registered agent");
    }
    entry.reputation = record;
  }

  /** Fail-closed: authorized only when registered and meeting the tier floor. */
  isAuthorized(agentId: string, requiredTier: TrustTier): boolean {
    const entry = this.entries.get(agentId);
    if (!entry) return false;
    return tierRank(entry.card.minimumTier) >= tierRank(requiredTier);
  }

  list(): AgentRegistryEntry[] {
    return [...this.entries.values()];
  }
}
