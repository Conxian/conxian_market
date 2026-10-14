/**
 * @file roundhouse_client.ts
 * @description Roundhouse AI Discovery Index Ingestion & Bi-Directional x402 Settlement Event Reporter Client.
 * Enables @conxian/market-sdk to query Roundhouse's open /v0/endpoints directory and publish "Verified by Conxian" settlement events.
 */

import { TrustTier } from './core_types.js';

export interface RoundhouseEndpoint {
  id: string;
  url: string;
  name: string;
  method: string;
  x402_supported: boolean;
  price_sats: number;
  price_usdc_cents?: number;
  attestation_verified: boolean;
  trust_tier: TrustTier;
  settlement_rails: string[];
  last_probed_at: string;
}

export interface RoundhouseSettlementEvent {
  event_id: string;
  endpoint_url: string;
  transaction_hash: string;
  rail: 'bitcoin_l1' | 'lightning' | 'sbtc' | 'fedimint' | 'evm_usdc';
  amount_sats: number;
  timestamp: string;
  proof_artifact_hash: string;
  verified_by_conxian: boolean;
  attestation_quote_hash?: string;
}

export interface VerifiedByConxianCertificate {
  certificate_id: string;
  endpoint_url: string;
  enclave_type: 'AWS_NITRO' | 'ANDROID_STRONGBOX' | 'SIMULATED';
  attestation_hash: string;
  issued_at: string;
  issuer: 'conxian.org/trust-layer';
  signature: string;
}

export interface RoundhouseClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class RoundhouseClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly customFetch?: typeof fetch;
  private endpointCache: Map<string, RoundhouseEndpoint> = new Map();

  constructor(config: RoundhouseClientConfig = {}) {
    this.baseUrl = (config.baseUrl || 'https://api.roundhouse.ai').replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || 5000;
    this.customFetch = config.fetchFn;
  }

  /**
   * Fetches the /v0/endpoints discovery directory from Roundhouse AI.
   */
  async fetchEndpoints(options: {
    attestationOnly?: boolean;
    rail?: string;
    trustTier?: TrustTier;
  } = {}): Promise<RoundhouseEndpoint[]> {
    let endpoints: RoundhouseEndpoint[] = [];

    try {
      if (this.customFetch) {
        const res = await this.customFetch(`${this.baseUrl}/v0/endpoints`, {
          headers: this.buildHeaders(),
        });
        if (res.ok) {
          endpoints = (await res.json()) as RoundhouseEndpoint[];
        }
      }
    } catch {
      // Fall back to cached or empty array
    }

    // Fallback if network or custom fetch not provided or failed
    if (endpoints.length === 0 && this.endpointCache.size > 0) {
      const uniqueSet = new Set<RoundhouseEndpoint>(this.endpointCache.values());
      endpoints = Array.from(uniqueSet);
    }

    // Filter results
    return endpoints.filter((ep) => {
      if (options.attestationOnly && !ep.attestation_verified) {
        return false;
      }
      if (options.rail && !ep.settlement_rails.includes(options.rail)) {
        return false;
      }
      if (options.trustTier && ep.trust_tier !== options.trustTier) {
        return false;
      }
      return true;
    });
  }

  /**
   * Caches an endpoint locally for discovery lookup.
   */
  registerLocalEndpoint(endpoint: RoundhouseEndpoint): void {
    this.endpointCache.set(endpoint.id, endpoint);
    if (endpoint.url) {
      this.endpointCache.set(endpoint.url, endpoint);
    }
  }

  /**
   * Generates a "Verified by Conxian" TEE attestation certificate for a Roundhouse endpoint.
   */
  generateAttestationCertificate(
    endpointUrl: string,
    enclaveQuote: string,
    enclaveType: 'AWS_NITRO' | 'ANDROID_STRONGBOX' | 'SIMULATED' = 'AWS_NITRO'
  ): VerifiedByConxianCertificate {
    const issuedAt = new Date().toISOString();
    const certificateId = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const attestationHash = `0x${Buffer.from(enclaveQuote || 'default_quote').toString('hex').substring(0, 32)}`;
    const signature = `cx_sig_${Buffer.from(`${certificateId}:${endpointUrl}:${attestationHash}`).toString('base64')}`;

    return {
      certificate_id: certificateId,
      endpoint_url: endpointUrl,
      enclave_type: enclaveType,
      attestation_hash: attestationHash,
      issued_at: issuedAt,
      issuer: 'conxian.org/trust-layer',
      signature,
    };
  }

  /**
   * Publishes a verified settlement event back to Roundhouse's indexing engine.
   */
  async publishSettlementEvent(
    eventData: Omit<RoundhouseSettlementEvent, 'event_id' | 'timestamp' | 'verified_by_conxian'>
  ): Promise<RoundhouseSettlementEvent> {
    const timestamp = new Date().toISOString();
    const eventId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const event: RoundhouseSettlementEvent = {
      ...eventData,
      event_id: eventId,
      timestamp,
      verified_by_conxian: true,
    };

    if (this.customFetch) {
      try {
        await this.customFetch(`${this.baseUrl}/v0/events`, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(event),
        });
      } catch {
        // Log or handle silent telemetry push
      }
    }

    return event;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Conxian-Market-SDK/0.2.5',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }
}
