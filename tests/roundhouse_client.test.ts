import { describe, it, expect, vi } from 'vitest';
import { RoundhouseClient, RoundhouseUnsupportedError, type RoundhouseEndpoint } from '../src/roundhouse_client.js';
import { TrustTier } from '../src/core_types.js';

const endpoint = (): RoundhouseEndpoint => ({
  id: 'endpoint-1', url: 'https://agent.example.invalid/predict', name: 'Agent', method: 'POST',
  x402_supported: true, price_sats: 250, attestation_verified: true, trust_tier: TrustTier.Strict,
  settlement_rails: ['sbtc', 'lightning'], last_probed_at: new Date().toISOString(),
});

describe('Roundhouse evidence boundaries', () => {
  it('exposes local registrations without granting observed capability or trust', async () => {
    const client = new RoundhouseClient();
    client.registerLocalEndpoint(endpoint());
    const [result] = await client.fetchEndpoints({ rail: 'sbtc' });
    expect(result).toMatchObject({ source: 'local-registration', verification: 'not-evidenced',
      attestation_verified: false, x402_supported: false, trust_tier: TrustTier.ObserverOnly, last_probed_at: null });
    expect(client.getCapabilities()).toMatchObject({ remoteDiscovery: false, attestationCertification: false,
      settlementPublication: false, productionQualified: false });
  });
  it('cannot satisfy attestation or strict-tier discovery from caller declarations', async () => {
    const client = new RoundhouseClient(); client.registerLocalEndpoint(endpoint());
    expect(await client.fetchEndpoints({ attestationOnly: true })).toEqual([]);
    expect(await client.fetchEndpoints({ trustTier: TrustTier.Strict })).toEqual([]);
    expect(await client.fetchEndpoints({ rail: 'evm_usdc' })).toEqual([]);
  });
  it('does not let callers mutate cached declarations after registration or lookup', async () => {
    const client = new RoundhouseClient(); const input = endpoint(); client.registerLocalEndpoint(input);
    input.settlement_rails.push('evm_usdc');
    const [result] = await client.fetchEndpoints(); result.settlement_rails.push('bitcoin_l1'); result.attestation_verified = true;
    const [again] = await client.fetchEndpoints();
    expect(again.settlement_rails).toEqual(['sbtc', 'lightning']); expect(again.attestation_verified).toBe(false);
  });
  it('does not replace a requested remote lookup with cached success', async () => {
    const transport = vi.fn(); const client = new RoundhouseClient({ baseUrl: 'https://directory.example.invalid', fetchFn: transport });
    client.registerLocalEndpoint(endpoint());
    await expect(client.fetchEndpoints()).rejects.toMatchObject({ operation: 'remote-discovery' });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['AWS_NITRO', 'ANDROID_STRONGBOX', 'SIMULATED'] as const)('cannot mint a certificate from a %s label', (provider) => {
    const client = new RoundhouseClient();
    expect(() => client.generateAttestationCertificate(endpoint().url, 'arbitrary-proof', provider)).toThrow(RoundhouseUnsupportedError);
  });
  it('rejects settlement publication without returning a fabricated receipt or calling transport', async () => {
    const transport = vi.fn(); const client = new RoundhouseClient({ fetchFn: transport, apiKey: 'test-only' });
    await expect(client.publishSettlementEvent({ endpoint_url: endpoint().url, transaction_hash: 'invented', rail: 'sbtc',
      amount_sats: 500, proof_artifact_hash: 'invented' })).rejects.toMatchObject({ operation: 'settlement-publication' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects unsafe destination configuration and invalid timeouts', () => {
    for (const baseUrl of ['http://example.invalid', 'https://name:password@example.invalid',
      'https://example.invalid/?token=test', 'https://example.invalid/#fragment', 'not-url']) {
      expect(() => new RoundhouseClient({ baseUrl })).toThrow();
    }
    for (const timeoutMs of [0, -1, 30_001, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => new RoundhouseClient({ timeoutMs })).toThrow();
    }
  });
  it('rejects malformed or unbounded local metadata', () => {
    const client = new RoundhouseClient();
    for (const input of [{ ...endpoint(), price_sats: -1 }, { ...endpoint(), price_sats: 1.5 },
      { ...endpoint(), id: '' }, { ...endpoint(), name: 'x'.repeat(257) },
      { ...endpoint(), settlement_rails: Array(33).fill('sbtc') }, { ...endpoint(), url: 'javascript:alert(1)' }]) {
      expect(() => client.registerLocalEndpoint(input)).toThrow();
    }
  });
  it('bounds the local registry without creating duplicate aliases', async () => {
    const client = new RoundhouseClient();
    for (let i = 0; i < 256; i++) client.registerLocalEndpoint({ ...endpoint(), id: `endpoint-${i}` });
    expect(() => client.registerLocalEndpoint({ ...endpoint(), id: 'overflow' })).toThrow();
    client.registerLocalEndpoint({ ...endpoint(), id: 'endpoint-1' });
    expect(await client.fetchEndpoints()).toHaveLength(256);
  });
});
