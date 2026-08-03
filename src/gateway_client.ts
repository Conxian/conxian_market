/**
 * Conxian Gateway REST API Client.
 *
 * Typed HTTP client for the conxian-gateway REST API (v0.1.5+, axum 0.8).
 * Maps all 50+ gateway endpoints to TypeScript functions.
 *
 * Endpoint reference: conxian-gateway internal/api/src/routes.rs
 */

import type {
  AttestationResult,
  BuilderIdentity,
  ChainId,
  DlcBond,
  JobCard,
  M2MSettlement,
  MrrReport,
  Musig2KeyAggregation,
  ProtocolFeeReport,
  SettlementIntent,
  SettlementRail,
  SettlementRequest,
  SettlementResult,
  TrustTier,
  UsageMetrics,
  YieldOpportunity,
} from "./core_types.ts";

// ── Client Config ──

export interface GatewayConfig {
  baseUrl: string;
  apiToken: string;
  timeoutMs?: number;
}

export class GatewayClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly timeoutMs: number;

  constructor(config: GatewayConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.authHeader = `Bearer ${config.apiToken}`;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  // ── HTTP helpers ──

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Authorization": this.authHeader,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gateway ${method} ${path} → ${res.status}: ${text}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Health & Version ──

  async health(): Promise<{ status: string; version: string }> {
    return this.get("/api/v1/health");
  }

  async version(): Promise<string> {
    return this.get("/api/v1/version");
  }

  // ── State & Metrics ──

  async getState(): Promise<Record<string, unknown>> {
    return this.get("/api/v1/state");
  }

  async getMetrics(): Promise<Record<string, unknown>> {
    return this.get("/api/v1/metrics");
  }

  // ── Attestation (P0-gated via feature flags) ──

  async verifyAttestation(proof: {
    teeProof?: string;
    zkProof?: string;
    enclaveAttestation?: string;
    lightProof?: string;
  }): Promise<AttestationResult> {
    return this.post("/api/v1/verify", {
      tee_proof: proof.teeProof,
      zk_proof: proof.zkProof,
      enclave_attestation: proof.enclaveAttestation,
      light_proof: proof.lightProof,
    });
  }

  // ── Identity ──

  async exchangeIdentity(did: string): Promise<BuilderIdentity> {
    return this.post("/api/v1/identity/exchange", { did });
  }

  async resolveIdentity(did: string): Promise<BuilderIdentity> {
    return this.post("/api/v1/identity/resolve", { did });
  }

  async resolveMachineIdentity(machineId: string): Promise<{ identity: BuilderIdentity }> {
    return this.post("/api/v1/identity/resolve/machine", { machine_id: machineId });
  }

  // ── Settlement ──

  async settleJobCard(card: JobCard, feeHeaders?: Record<string, string>): Promise<SettlementResult> {
    return this.post("/api/v1/settle", { card, fee_headers: feeHeaders });
  }

  async getExternalSettlements(params?: {
    rail?: SettlementRail;
    from?: number;
    to?: number;
  }): Promise<SettlementResult[]> {
    const qs = new URLSearchParams();
    if (params?.rail) qs.set("rail", params.rail);
    if (params?.from) qs.set("from", String(params.from));
    if (params?.to) qs.set("to", String(params.to));
    return this.get(`/api/v1/settlements/external?${qs}`);
  }

  async toggleBountyPayouts(enabled: boolean): Promise<{ enabled: boolean }> {
    return this.post("/api/v1/bounties/payouts/toggle", { enabled });
  }

  // ── Chains ──

  async listSupportedChains(): Promise<ChainId[]> {
    return this.get("/api/v1/chains/list");
  }

  async getChainHeight(chain: ChainId): Promise<{ chain: ChainId; height: number }> {
    return this.get(`/api/v1/chains/${chain}/height`);
  }

  async prepareChainTx(chain: ChainId, tx: Record<string, unknown>): Promise<{ prepared: string }> {
    return this.post(`/api/v1/chains/${chain}/prepare`, tx);
  }

  async verifyStateProof(chain: ChainId, proof: Record<string, unknown>): Promise<{ valid: boolean }> {
    return this.post(`/api/v1/chains/${chain}/verify`, proof);
  }

  // ── ALEX Swap ──

  async getAlexQuote(params: { from: string; to: string; amount: string }): Promise<{ quote: Record<string, unknown> }> {
    const qs = new URLSearchParams(params);
    return this.get(`/api/v1/alex/quote?${qs}`);
  }

  async prepareAlexSwap(params: Record<string, unknown>): Promise<{ prepared: Record<string, unknown> }> {
    return this.post("/api/v1/alex/prepare", params);
  }

  async executeAlexSwap(params: Record<string, unknown>): Promise<{ txId: string }> {
    return this.post("/api/v1/alex/swap", params);
  }

  // ── DLC ──

  async createDlcBond(params: {
    oracle: string;
    outcome: string;
    amountSat: bigint;
    maturity: number;
  }): Promise<DlcBond> {
    return this.post("/api/v1/dlc/bond", params);
  }

  // ── MuSig2 ──

  async aggregateMusig2Keys(publicKeys: string[]): Promise<Musig2KeyAggregation> {
    return this.post("/api/v1/musig2/aggregate-keys", { public_keys: publicKeys });
  }

  // ── M2M Settlement ──

  async settleM2M(settlement: M2MSettlement): Promise<{ txId: string }> {
    return this.post("/api/v1/m2m/settle", settlement);
  }

  // ── Bitcoin / Mempool ──

  async getMempoolTelemetry(): Promise<Record<string, unknown>> {
    return this.get("/api/v1/bitcoin/mempool/telemetry");
  }

  async getShadowObservation(): Promise<Record<string, unknown>> {
    return this.get("/api/v1/bitcoin/core/shadow-observation");
  }

  // ── ISO 20022 ──

  async generateIsoPayment(params: Record<string, unknown>): Promise<{ payment: string }> {
    return this.post("/api/v1/iso20022/payment", params);
  }

  // ── Canton / RWA ──

  async verifyCbtcAttestation(proof: Record<string, unknown>): Promise<{ valid: boolean }> {
    return this.post("/api/v1/canton/cbtc/verify", proof);
  }

  async verifyMachineRwaRevenue(machineId: string): Promise<{ revenue: number }> {
    return this.post("/api/v1/rwa/machine/verify-revenue", { machine_id: machineId });
  }

  // ── CCIP ──

  async routeCcipMessage(message: Record<string, unknown>): Promise<{ routed: boolean }> {
    return this.post("/api/v1/ccip/route", message);
  }

  // ── Handoff ──

  async getHandoffStatus(): Promise<Record<string, unknown>> {
    return this.get("/api/v1/handoff/status");
  }

  async updateHandoffState(state: Record<string, unknown>): Promise<void> {
    return this.post("/api/v1/handoff/update", state);
  }

  // ── Billing (MRR) ──

  async generateMrrReport(usage: UsageMetrics): Promise<MrrReport> {
    return this.post("/api/v1/erp/sync", usage);
  }

  // ── Protocol Fee Report ──

  async submitFeeReport(report: ProtocolFeeReport): Promise<{ accepted: boolean }> {
    return this.post("/api/v1/settle", { fee_report: report });
  }

  // ── Admin ──

  async requestReleaseApproval(version: string, notes: string): Promise<{ approved: boolean }> {
    return this.post("/admin/v1/releases/request-approval", { version, notes });
  }

  async submitGovernanceDecision(decision: Record<string, unknown>): Promise<void> {
    return this.post("/admin/v1/governance/decision", decision);
  }
}
