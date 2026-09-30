import { describe, it, expect } from "vitest";
import { TrustTier } from "../src/core_types";
import { AgentRegistry, agentCardDigest, type AgentCard } from "../src/agent_registry";

function card(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    agentId: "did:conxian:agent:1",
    name: "Gap Card Builder",
    providerDid: "did:conxian:org:labs",
    capabilities: [{ name: "build", version: "1.0.0" }],
    endpoints: ["https://agents.conxian.com/1"],
    minimumTier: TrustTier.Managed,
    issuedAt: 1750000000,
    ...overrides,
  };
}

describe("AgentRegistry", () => {
  it("computes a stable digest that binds identity fields", () => {
    expect(agentCardDigest(card())).toBe(agentCardDigest(card()));
    expect(agentCardDigest(card())).not.toBe(agentCardDigest(card({ name: "Other" })));
  });

  it("authorizes only when registered and at or above the required tier", () => {
    const registry = new AgentRegistry();
    registry.register(card());
    expect(registry.isAuthorized("did:conxian:agent:1", TrustTier.Managed)).toBe(true);
    expect(registry.isAuthorized("did:conxian:agent:1", TrustTier.Strict)).toBe(false);
    expect(registry.isAuthorized("did:conxian:agent:missing", TrustTier.ObserverOnly)).toBe(false);
  });

  it("binds reputation to the registered card digest", () => {
    const registry = new AgentRegistry();
    const entry = registry.register(card());
    registry.updateReputation({
      agentId: entry.card.agentId,
      cardDigest: entry.cardDigest,
      tasksCompleted: 10,
      slaComplianceBps: 9950,
      disputesLost: 0,
      updatedAt: 1750000100,
    });
    expect(registry.get("did:conxian:agent:1")?.reputation?.tasksCompleted).toBe(10);
  });

  it("rejects reputation bound to a foreign digest", () => {
    const registry = new AgentRegistry();
    const entry = registry.register(card());
    expect(() =>
      registry.updateReputation({
        agentId: entry.card.agentId,
        cardDigest: "deadbeef".repeat(8),
        tasksCompleted: 1,
        slaComplianceBps: 10000,
        disputesLost: 0,
        updatedAt: 1750000100,
      }),
    ).toThrow(/cardDigest/);
  });
});
