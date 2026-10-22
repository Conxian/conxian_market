/** Local discovery diagnostics. External Roundhouse contracts remain unverified. */
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
  last_probed_at: string | null;
  source?: 'local-registration';
  verification?: 'not-evidenced';
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

/** Compatibility vocabulary; no implementation in this client can issue it. */
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

export class RoundhouseUnsupportedError extends Error {
  readonly code = 'ROUNDHOUSE_CAPABILITY_UNAVAILABLE';
  constructor(readonly operation: 'remote-discovery' | 'attestation-certificate' | 'settlement-publication') {
    super(`Roundhouse ${operation} requires a verified implementation and acceptance contract`);
    this.name = 'RoundhouseUnsupportedError';
  }
}

const MAX_LOCAL_ENDPOINTS = 256;
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max &&
    !Array.from(value).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
}

function publicUrl(value: unknown): string {
  if (!text(value, 2048)) throw new Error('Invalid endpoint URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) {
    throw new Error('Endpoint URL must be HTTPS without credentials, query or fragment');
  }
  return url.href;
}

function price(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function copy(endpoint: RoundhouseEndpoint): RoundhouseEndpoint {
  return { ...endpoint, settlement_rails: [...endpoint.settlement_rails] };
}

export class RoundhouseClient {
  private readonly remoteRequested: boolean;
  private readonly endpointCache = new Map<string, RoundhouseEndpoint>();

  constructor(config: RoundhouseClientConfig = {}) {
    if (config.baseUrl !== undefined) publicUrl(config.baseUrl);
    if (config.timeoutMs !== undefined &&
        (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 30_000)) {
      throw new Error('Invalid discovery timeout');
    }
    this.remoteRequested = config.baseUrl !== undefined || config.fetchFn !== undefined;
    // No default destination, retained credential, fetch or publication side effect.
  }

  getCapabilities() {
    return { localRegistration: true, remoteDiscovery: false, attestationCertification: false,
      settlementPublication: false, productionQualified: false } as const;
  }

  /** Local registrations are discovery metadata, never proof or operational health. */
  registerLocalEndpoint(endpoint: RoundhouseEndpoint): void {
    if (!endpoint || typeof endpoint !== 'object' ||
        !text(endpoint.id, 128) || !text(endpoint.name, 256) ||
        !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(endpoint.method) ||
        !price(endpoint.price_sats) ||
        (endpoint.price_usdc_cents !== undefined && !price(endpoint.price_usdc_cents)) ||
        typeof endpoint.x402_supported !== 'boolean' || typeof endpoint.attestation_verified !== 'boolean' ||
        !Object.values(TrustTier).includes(endpoint.trust_tier) ||
        !Array.isArray(endpoint.settlement_rails) || endpoint.settlement_rails.length > 32 ||
        endpoint.settlement_rails.some((rail) => !text(rail, 64))) {
      throw new Error('Invalid local endpoint metadata');
    }
    const url = publicUrl(endpoint.url);
    if (!this.endpointCache.has(endpoint.id) && this.endpointCache.size >= MAX_LOCAL_ENDPOINTS) {
      throw new Error('Local endpoint inventory is full');
    }
    this.endpointCache.set(endpoint.id, {
      id: endpoint.id, url, name: endpoint.name, method: endpoint.method,
      price_sats: endpoint.price_sats, price_usdc_cents: endpoint.price_usdc_cents,
      settlement_rails: [...endpoint.settlement_rails],
      x402_supported: false, attestation_verified: false, trust_tier: TrustTier.ObserverOnly,
      last_probed_at: null, source: 'local-registration', verification: 'not-evidenced',
    });
  }

  /** Never silently substitutes local data for an unavailable remote lookup. */
  async fetchEndpoints(options: { attestationOnly?: boolean; rail?: string; trustTier?: TrustTier } = {}): Promise<RoundhouseEndpoint[]> {
    if (this.remoteRequested) throw new RoundhouseUnsupportedError('remote-discovery');
    return Array.from(this.endpointCache.values()).filter((endpoint) =>
      !options.attestationOnly && (!options.rail || endpoint.settlement_rails.includes(options.rail)) &&
      (!options.trustTier || endpoint.trust_tier === options.trustTier)).map(copy);
  }

  /** Base64 text, a quote string and provider names cannot issue a certificate. */
  generateAttestationCertificate(_endpointUrl: string, _enclaveQuote: string,
    _enclaveType: 'AWS_NITRO' | 'ANDROID_STRONGBOX' | 'SIMULATED' = 'AWS_NITRO'): VerifiedByConxianCertificate {
    throw new RoundhouseUnsupportedError('attestation-certificate');
  }

  /** A supplied transaction/proof hash cannot establish verification or publication. */
  async publishSettlementEvent(
    _event: Omit<RoundhouseSettlementEvent, 'event_id' | 'timestamp' | 'verified_by_conxian'>,
  ): Promise<RoundhouseSettlementEvent> {
    throw new RoundhouseUnsupportedError('settlement-publication');
  }
}
