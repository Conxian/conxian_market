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
  DlcCetRequest,
  DlcCetResult,
  JobCard,
  M2MSettlement,
  MrrReport,
  Musig2KeyAggregation,
  ProtocolFeeRecord,
  ProtocolFeeReport,
  SettlementRail,
  SettlementResult,
  UsageMetrics,
} from "./core_types.js";
import { TrustTier } from "./core_types.js";
import { z } from "zod";
import { calculateRailFee, toWireHeaders } from "./fee_calculator.js";
import { M2MSettlementResponseSchema, SettlementResultSchema } from "./wire_contract.js";

export interface GatewayConfig {
  baseUrl: string;
  apiToken?: string;
  timeoutMs?: number;
  /**
   * #359: when enabled, the settlement path submits the priced fee to
   * `/v1/billing/fee-report` after each settlement. Opt-in and fail-closed: a
   * failed report rejects the settlement rather than letting it settle untracked.
   * Defaults to disabled (protocolFeeActive is still false).
   */
  feeReporting?: { enabled: boolean };
}

export class GatewayClient {
  private readonly baseUrl: string;
  private readonly apiToken?: string;
  private readonly timeoutMs: number;
  private readonly feeReportingEnabled: boolean;

  constructor(config: GatewayConfig) {
    // Strip trailing slashes without a quantifier regex (avoids polynomial ReDoS on hostile URLs).
    let baseUrl = config.baseUrl;
    while (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    this.baseUrl = baseUrl;
    this.apiToken = config.apiToken;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.feeReportingEnabled = config.feeReporting?.enabled ?? false;
  }

  private serializeBody(value: unknown): string {
    return JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
    );
  }

  // ── Helper ──

  /** Correlation/idempotency token source (UUID v4 with a non-secure fallback). */
  private newToken(): string {
    const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private async fetchJson<T>(
    path: string,
    options: RequestInit = {},
    meta: { idempotencyKey?: string; correlationId?: string } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-Id": meta.correlationId ?? this.newToken(),
      ...(meta.idempotencyKey ? { "Idempotency-Key": meta.idempotencyKey } : {}),
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

  /** Fetches and runtime-validates the response against a wire-contract schema. */
  private async fetchJsonValidated<T>(
    schema: z.ZodType<T, unknown>,
    path: string,
    options: RequestInit = {},
    meta: { idempotencyKey?: string; correlationId?: string } = {},
  ): Promise<T> {
    const raw = await this.fetchJson<unknown>(path, options, meta);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Gateway response failed validation for ${path}: ${parsed.error.message}`);
    }
    return parsed.data as T;
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

  /**
   * #359: submit the priced fee for a single settlement to the billing meter.
   * Opt-in (constructor `feeReporting.enabled`) and fail-closed: a rejection
   * propagates so the caller does not treat an untracked settlement as settled.
   */
  private async reportSettlementFee(record: ProtocolFeeRecord): Promise<void> {
    if (!this.feeReportingEnabled) return;
    const report: ProtocolFeeReport = {
      periodStart: record.timestamp,
      periodEnd: record.timestamp,
      totalSettledSat: record.amountSat,
      totalFeesSat: record.feeSat,
      effectiveFeeBps: record.feeBps,
      byRail: [
        {
          rail: record.rail,
          count: 1,
          totalAmountSat: record.amountSat,
          totalFeeSat: record.feeSat,
          avgFeeBps: record.feeBps,
        },
      ],
      byTier: [{ tier: record.tier, count: 1, totalFeeSat: record.feeSat }],
      eventCount: 1,
    };
    await this.submitFeeReport(report);
  }

  async settleJobCard(
    card: JobCard,
    opts: { idempotencyKey?: string; correlationId?: string } = {},
  ): Promise<SettlementResult> {
    // #361: emit the fee the market priced for this settlement so the gateway
    // meter agrees with the client. Fail-closed: an ObserverOnly tier throws
    // rather than silently omitting the headers.
    const fee = calculateRailFee(card.bountySat, card.tier, card.rail);
    const result = await this.fetchJsonValidated<SettlementResult>(
      SettlementResultSchema,
      "/v1/settlement/job-card",
      { method: "POST", body: this.serializeBody(card), headers: toWireHeaders(fee) },
      { idempotencyKey: opts.idempotencyKey ?? this.newToken(), correlationId: opts.correlationId },
    );
    await this.reportSettlementFee(result.fee);
    return result;
  }

  async settleM2M(
    settlement: M2MSettlement,
    opts: { idempotencyKey?: string; correlationId?: string } = {},
  ): Promise<{ txId: string }> {
    // #361: a raw M2M settlement is a rail call — emit the dynamic fee headers.
    const fee = calculateRailFee(settlement.amountSat, TrustTier.Expedient, settlement.rail);
    const result = await this.fetchJsonValidated<{ txId: string }>(
      M2MSettlementResponseSchema,
      "/v1/settlement/m2m",
      { method: "POST", body: this.serializeBody(settlement), headers: toWireHeaders(fee) },
      { idempotencyKey: opts.idempotencyKey ?? this.newToken(), correlationId: opts.correlationId },
    );
    await this.reportSettlementFee({
      settlementId: settlement.id,
      rail: settlement.rail,
      tier: TrustTier.Expedient,
      amountSat: settlement.amountSat,
      feeSat: fee.feeSat,
      feeBps: fee.feeBps,
      timestamp: settlement.timestamp,
      builderId: settlement.fromAgent,
    });
    return result;
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

  /**
   * Build an adaptor-signature CET for a DLC outcome (real path).
   * Returns `broadcastReady: false` until the oracle attestation scalar is
   * supplied and the completed signature verifies.
   */
  async createDlcCet(request: DlcCetRequest): Promise<DlcCetResult> {
    return this.fetchJson<DlcCetResult>("/v1/dlc/cet", {
      method: "POST",
      body: JSON.stringify({
        contract_id: request.contractId,
        outcome: request.outcome,
        oracle_nonce: request.oracleNonce,
        signer_secret: request.signerSecret,
        signer_nonce: request.signerNonce,
        oracle_attestation_scalar: request.oracleAttestationScalar,
        spec: {
          party_a_pubkey: request.spec.partyAPubkey,
          party_b_pubkey: request.spec.partyBPubkey,
          party_a_payout_address: request.spec.partyAPayoutAddress,
          party_b_payout_address: request.spec.partyBPayoutAddress,
          total_collateral_sats: request.spec.totalCollateralSats,
          oracle_pubkey: request.spec.oraclePubkey,
          event_id: request.spec.eventId,
          refund_locktime: request.spec.refundLocktime,
          feerate_sats_per_vbyte: request.spec.feerateSatsPerVbyte,
          funding_inputs: request.spec.fundingInputs.map((i) => ({
            txid: i.txid,
            vout: i.vout,
            amount_sats: i.amountSats,
            party: i.party,
          })),
          outcomes: request.spec.outcomes.map((o) => ({
            outcome: o.outcome,
            party_a_payout_sats: o.partyAPayoutSats,
            party_b_payout_sats: o.partyBPayoutSats,
          })),
        },
      }),
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
      body: this.serializeBody(report),
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
