import { describe, it, expect, vi } from 'vitest';
import {
  RoundhouseClient,
  RoundhouseEndpoint,
  RoundhouseSettlementEvent,
} from '../src/roundhouse_client.js';
import { TrustTier } from '../src/core_types.js';

describe('RoundhouseClient', () => {
  it('registers local endpoints and retrieves them with filters', async () => {
    const client = new RoundhouseClient();

    const sampleEp: RoundhouseEndpoint = {
      id: 'ep_101',
      url: 'https://agent.example.com/api/v1/predict',
      name: 'Predictor Agent',
      method: 'POST',
      x402_supported: true,
      price_sats: 250,
      attestation_verified: true,
      trust_tier: TrustTier.Strict,
      settlement_rails: ['sbtc', 'lightning'],
      last_probed_at: new Date().toISOString(),
    };

    client.registerLocalEndpoint(sampleEp);

    const all = async () => client.fetchEndpoints();
    const results = await all();
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('ep_101');

    const filtered = await client.fetchEndpoints({ rail: 'sbtc', attestationOnly: true });
    expect(filtered.length).toBe(1);

    const noMatch = await client.fetchEndpoints({ rail: 'evm_usdc' });
    expect(noMatch.length).toBe(0);
  });

  it('generates a "Verified by Conxian" attestation certificate', () => {
    const client = new RoundhouseClient();
    const cert = client.generateAttestationCertificate(
      'https://agent.example.com/api/v1/predict',
      'nitro_quote_data_sample',
      'AWS_NITRO'
    );

    expect(cert.issuer).toBe('conxian.org/trust-layer');
    expect(cert.enclave_type).toBe('AWS_NITRO');
    expect(cert.endpoint_url).toBe('https://agent.example.com/api/v1/predict');
    expect(cert.signature).toContain('cx_sig_');
  });

  it('publishes settlement events with custom fetch mock', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'published' }),
    });

    const client = new RoundhouseClient({
      baseUrl: 'https://api.roundhouse.ai',
      apiKey: 'test_key',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const eventData = {
      endpoint_url: 'https://agent.example.com/api/v1/predict',
      transaction_hash: '0x123abc456def',
      rail: 'sbtc' as const,
      amount_sats: 500,
      proof_artifact_hash: '0xproof999',
    };

    const published = await client.publishSettlementEvent(eventData);

    expect(published.verified_by_conxian).toBe(true);
    expect(published.rail).toBe('sbtc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.roundhouse.ai/v0/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test_key',
        }),
      })
    );
  });
});
