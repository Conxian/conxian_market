import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { ClientInstallerEngine } from "../src/client_onboarding";
import { SettlementRail, TrustTier } from "../src/core_types";
import { verifyPaymentReceiptWithAttestation, createTrustProofArtifact, jobCardToDemand } from "../src/x402_facade";
import { GatewayVerifier } from "../src/verification";
import { GatewayClient } from "../src/gateway_client";

const config = {
  clientDid: "did:example:unconnected",
  gatewayUrl: "https://never-online-gateway.invalid",
  nexusUrl: "https://never-online-nexus.invalid",
  defaultSettlementRail: SettlementRail.Lightning,
  targetTrustTier: TrustTier.Strict,
};
const timestamp = "2026-10-15T00:00:00Z";
const demand = jobCardToDemand({ id: "job-negative", bountySat: 1n, deadline: 1_900_000_000_000 });
const receipt = { demandId: demand.resourceId, transactionId: "unobserved-tx", amountSat: "1", paidAt: 1_700_000_000_000, payerDid: config.clientDid };
const forged = { tee_proof: "arbitrary", zk_proof: "arbitrary", enclave_attestation: "arbitrary", light_proof: "arbitrary" };

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("onboarding evidence boundaries", () => {
  it("reserved endpoints without devices, receipts or network calls cannot install or authorize", () => {
    const network = vi.fn(() => { throw new Error("offline"); });
    vi.stubGlobal("fetch", network);
    const result = ClientInstallerEngine.runUnifiedInstallerCli(config, timestamp);
    expect(result.success).toBe(false);
    expect(result.provisioning.provisioned).toBe(false);
    expect(result.entitlement.agentExecutionEnabled).toBe(false);
    expect(result.entitlement.allowedRails).toEqual([]);
    expect(result.zeroCustody.localKeyIsolationConfirmed).toBe(false);
    expect(result.zeroCustody.byoDeFiDirectRoutingConfirmed).toBe(false);
    expect(result.connectivity.allAssetsOperational).toBe(false);
    const report = ClientInstallerEngine.testSystemConnectivity(config, timestamp);
    expect(report.overallHealth).toBe("UNVERIFIED");
    expect(report.diagnostics.every(d => !d.connected && d.latencyMs === null)).toBe(true);
    expect(network).not.toHaveBeenCalled();
  });

  it.each(Object.values(TrustTier))("a requested %s tier or caller override is not purchased authority", tier => {
    const result = ClientInstallerEngine.verifyClientEntitlements({ ...config, targetTrustTier: tier }, {
      licenseId: "forged", agentExecutionEnabled: true, maxActiveJobCards: 1000,
      allowedRails: [SettlementRail.Lightning], expiresAtIso: "2099-01-01T00:00:00Z",
    });
    expect(result).toMatchObject({ licenseId: "", agentExecutionEnabled: false, maxActiveJobCards: 0, tier: TrustTier.ObserverOnly, verificationStatus: "UNVERIFIED" });
    expect(result.allowedRails).toEqual([]);
    expect(result.expiresAtIso).toBeUndefined();
  });

  it.each(Object.values(SettlementRail))("%s configuration does not certify a connected wallet", rail => {
    const result = ClientInstallerEngine.probeAssetConnectivity({ ...config, defaultSettlementRail: rail }, timestamp);
    expect(result.walletConnected).toBe(false);
    expect(result.allAssetsOperational).toBe(false);
  });

  it("uses independently reproducible SHA-256 and binds changed plan fields", () => {
    const manifest = ClientInstallerEngine.alignClientDeployment(config, timestamp);
    const encoded = JSON.stringify(["CONXIAN-CLIENT-DEPLOYMENT/v1", config.clientDid, config.gatewayUrl, config.nexusUrl, config.defaultSettlementRail, config.targetTrustTier, false, timestamp]);
    expect(manifest.checksum).toBe(`sha256_${createHash("sha256").update(encoded).digest("hex")}`);
    expect(manifest.checksum).toMatch(/^sha256_[0-9a-f]{64}$/);
    expect(ClientInstallerEngine.alignClientDeployment({ ...config, nexusUrl: "https://another.invalid" }, timestamp).checksum).not.toBe(manifest.checksum);
  });

  it("missing measurements cannot establish an SLA at any threshold", () => {
    for (const threshold of [0, 10, 50, Infinity, NaN]) {
      const result = ClientInstallerEngine.runEnterpriseSlaDiagnostics(config, threshold, timestamp);
      expect(result.overallSlaStatus).toBe("UNVERIFIED");
      expect(result.allEndpointsSlaCompliant).toBe(false);
      expect(result.diagnostics.every(d => d.measuredLatencyMs === null && !d.slaCompliant)).toBe(true);
    }
  });

  it("arbitrary proof strings cannot replace an absent verifier", async () => {
    const result = await verifyPaymentReceiptWithAttestation(demand, receipt, forged, "did:example:provider");
    expect(result.valid).toBe(false);
    expect(result.attestationValid).toBe(false);
    expect(result.verifiedTier).toBe(TrustTier.ObserverOnly);
    expect(result.trustProof.paymentVerified).toBe(false);
  });

  it("rejected, unavailable and malformed verifiers cannot fall back to strings", async () => {
    const verifier = new GatewayVerifier(new GatewayClient({ baseUrl: "https://gateway.invalid" }));
    const mock = vi.spyOn(verifier, "verifyAttestation");
    for (const value of [{ valid: false, tier: TrustTier.Strict }, { valid: true, tier: "UNKNOWN" }, { valid: "true", tier: TrustTier.Strict }]) {
      mock.mockResolvedValueOnce(value as never);
      expect((await verifyPaymentReceiptWithAttestation(demand, receipt, forged, "did:example:provider", verifier)).valid).toBe(false);
    }
    mock.mockRejectedValueOnce(new Error("offline"));
    expect((await verifyPaymentReceiptWithAttestation(demand, receipt, forged, "did:example:provider", verifier)).valid).toBe(false);
  });

  it("a truthy non-boolean Gateway response is not proof validation", async () => {
    const gateway = new GatewayClient({ baseUrl: "https://gateway.invalid" });
    vi.spyOn(gateway, "verifyAttestation").mockResolvedValue({ valid: "false", tier: TrustTier.Expedient } as never);
    const verifier = new GatewayVerifier(gateway);
    expect(await verifier.verifyLight("untrusted")).toBe(false);
  });

  it("correlation checksum binds payment fields but remains unsigned non-payment evidence", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const original = createTrustProofArtifact(demand, receipt, "did:example:p", TrustTier.ObserverOnly, false, "unverified");
    const changed = createTrustProofArtifact(demand, { ...receipt, amountSat: "2" }, "did:example:p", TrustTier.ObserverOnly, false, "unverified");
    expect(original.proofHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(original.proofHash).not.toBe(changed.proofHash);
    expect(original.artifactKind).toBe("local-correlation-record/v1");
    expect(original.paymentVerified).toBe(false);
  });
});
