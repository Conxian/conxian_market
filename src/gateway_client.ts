/**
 * Conxian Gateway Client — REST API Client for conxian-gateway.
 *
 * Exposes 50+ gateway endpoints covering settlement, attestation,
 * identity, job cards, M2M, ALEX swap, DLC bonds, and governance.
 */

import type {
  AttestationCertificate,
  AttestationResult,
  BuilderIdentity,
  ChainId,
  DlcBond,
  JobCard,
  M2MSettlement,
  MrrReport,
  Musig2KeyAggregation,
  ProtocolFeeReport,
  SettlementRail,
  SettlementResult,
  UsageMetrics,
} from "./core_types";

export interface GatewayConfig {
  baseUrl: string;
  apiToken?: string;
  timeoutMs?: number;
}

export class GatewayClient {
  private readonly baseUrl: string;
  private readonly apiToken?: string;
  private readonly timeoutMs: number;

  constructor(config: GatewayConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiToken = config.apiToken;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  private serializeBody(value: unknown): string {
    return JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
    );
  }

  // ── Helper ──

  private async fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gateway HTTP ${res.status}: ${text}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Attestation & Verification ──

  async verifyAttestation(cert: {
    teeProof?: string;
    zkProof?: string;
    enclaveAttestation?: string;
    lightProof?: string;
  }): Promise<AttestationResult> {
    return this.fetchJson<AttestationResult>("/v1/attestation/verify", {
      method: "POST",
      body: JSON.stringify(cert),
    });
  }

  async verifyCbtcAttestation(proof: Record<string, unknown>): Promise<{ valid: boolean }> {
    return this.fetchJson<{ valid: boolean }>("/v1/attestation/cbtc", {
      method: "POST",
      body: JSON.stringify(proof),
    });
  }

  // ── Settlement & Job Cards ──

  async settleJobCard(card: JobCard): Promise<SettlementResult> {
    return this.fetchJson<SettlementResult>("/v1/settlement/job-card", {
      method: "POST",
      body: this.serializeBody(card),
    });
  }

  async settleM2M(settlement: M2MSettlement): Promise<{ txId: string }> {
    return this.fetchJson<{ txId: string }>("/v1/settlement/m2m", {
      method: "POST",
      body: this.serializeBody(settlement),
    });
  }

  async getExternalSettlements(params?: {
    rail?: SettlementRail;
    from?: number;
    to?: number;
  }): Promise<SettlementResult[]> {
    const q = new URLSearchParams();
    if (params?.rail) q.set("rail", params.rail);
    if (params?.from) q.set("from", String(params.from));
    if (params?.to) q.set("to", String(params.to));
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return this.fetchJson<SettlementResult[]>(`/v1/settlement/history${queryStr}`);
  }

  // ── ALEX / Stacks ──

  async getAlexQuote(params: { from: string; to: string; amount: string }): Promise<{
    quoteId: string;
    expectedOutput: string;
    minOutput: string;
    feeSat: bigint;
  }> {
    return this.fetchJson("/v1/swap/alex/quote", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async prepareAlexSwap(quote: unknown): Promise<Record<string, unknown>> {
    return this.fetchJson("/v1/swap/alex/prepare", {
      method: "POST",
      body: JSON.stringify(quote),
    });
  }

  async executeAlexSwap(prepared: Record<string, unknown>): Promise<{ txId: string }> {
    return this.fetchJson<{ txId: string }>("/v1/swap/alex/execute", {
      method: "POST",
      body: JSON.stringify(prepared),
    });
  }

  // ── DLC Bonds ──

  async createDlcBond(params: {
    oracle: string;
    outcome: string;
    amountSat: bigint;
    maturity: number;
  }): Promise<DlcBond> {
    return this.fetchJson<DlcBond>("/v1/dlc/bond", {
      method: "POST",
      body: JSON.stringify({ ...params, amountSat: params.amountSat.toString() }),
    });
  }

  // ── MuSig2 ──

  async aggregateMusig2Keys(publicKeys: string[]): Promise<Musig2KeyAggregation> {
    return this.fetchJson<Musig2KeyAggregation>("/v1/musig2/aggregate", {
      method: "POST",
      body: JSON.stringify({ publicKeys }),
    });
  }

  // ── Identity & Reputation ──

  async resolveIdentity(did: string): Promise<BuilderIdentity> {
    return this.fetchJson<BuilderIdentity>(`/v1/identity/${encodeURIComponent(did)}`);
  }

  async exchangeIdentity(did: string): Promise<BuilderIdentity> {
    return this.fetchJson<BuilderIdentity>("/v1/identity/exchange", {
      method: "POST",
      body: JSON.stringify({ did }),
    });
  }

  async resolveMachineIdentity(machineId: string): Promise<Record<string, unknown>> {
    return this.fetchJson(`/v1/identity/machine/${encodeURIComponent(machineId)}`);
  }

  // ── Multi-Chain ──

  async listSupportedChains(): Promise<ChainId[]> {
    return this.fetchJson<ChainId[]>("/v1/chains");
  }

  async verifyStateProof(chain: ChainId, proof: Record<string, unknown>): Promise<{ valid: boolean }> {
    return this.fetchJson<{ valid: boolean }>(`/v1/chains/${chain}/verify-proof`, {
      method: "POST",
      body: JSON.stringify(proof),
    });
  }

  async prepareChainTx(chain: ChainId, tx: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.fetchJson(`/v1/chains/${chain}/prepare-tx`, {
      method: "POST",
      body: JSON.stringify(tx),
    });
  }

  // ── CCIP Intent Routing ──

  async routeCcipMessage(message: Record<string, unknown>): Promise<{ messageId: string }> {
    return this.fetchJson<{ messageId: string }>("/v1/intent/ccip/route", {
      method: "POST",
      body: JSON.stringify(message),
    });
  }

  // ── CJCS & Bounties ──

  async toggleBountyPayouts(enabled: boolean): Promise<{ enabled: boolean }> {
    return this.fetchJson<{ enabled: boolean }>("/v1/cjcs/bounties/toggle", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
  }

  // ── Billing & Fee Submissions ──

  async generateMrrReport(usage: UsageMetrics): Promise<MrrReport> {
    return this.fetchJson<MrrReport>("/v1/billing/mrr", {
      method: "POST",
      body: JSON.stringify(usage),
    });
  }

  async submitFeeReport(report: ProtocolFeeReport): Promise<{ received: boolean }> {
    return this.fetchJson<{ received: boolean }>("/v1/billing/fee-report", {
      method: "POST",
      body: JSON.stringify(report),
    });
  }

  // ── Governance, Releases & Handoff ──

  async requestReleaseApproval(version: string, notes: string): Promise<{ requestId: string }> {
    return this.fetchJson<{ requestId: string }>("/v1/release/approval", {
      method: "POST",
      body: JSON.stringify({ version, notes }),
    });
  }

  async submitGovernanceDecision(decision: Record<string, unknown>): Promise<{ decisionId: string }> {
    return this.fetchJson<{ decisionId: string }>("/v1/governance/decision", {
      method: "POST",
      body: JSON.stringify(decision),
    });
  }

  async getHandoffStatus(): Promise<Record<string, unknown>> {
    return this.fetchJson("/v1/handoff/status");
  }

  async updateHandoffState(state: Record<string, unknown>): Promise<{ updated: boolean }> {
    return this.fetchJson<{ updated: boolean }>("/v1/handoff/state", {
      method: "PUT",
      body: JSON.stringify(state),
    });
  }

  // ── ISO 20022 & RWA ──

  async generateIsoPayment(params: Record<string, unknown>): Promise<{ xml: string }> {
    return this.fetchJson<{ xml: string }>("/v1/iso20022/payment", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async verifyMachineRwaRevenue(machineId: string): Promise<{ revenueSat: bigint; verified: boolean }> {
    return this.fetchJson<{ revenueSat: bigint; verified: boolean }>(
      `/v1/rwa/machine/${encodeURIComponent(machineId)}/revenue`,
    );
  }

  // ── System Health & Metrics ──

  async getState(): Promise<Record<string, unknown>> {
    return this.fetchJson("/v1/system/state");
  }

  async getMetrics(): Promise<Record<string, unknown>> {
    return this.fetchJson("/v1/system/metrics");
  }
}
