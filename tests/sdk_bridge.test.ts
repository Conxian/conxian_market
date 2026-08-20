import { describe, expect, it } from "vitest";
import { TrustTier, SettlementRail } from "../src/core_types";
import { ConxianMarketSDK } from "../src/sdk_bridge";

describe("ConxianMarketSDK Bridge - Capability Summary & TrustTier Middleware", () => {
  const dummyConfig = { baseUrl: "https://gateway.conxian.io" };

  it("connects and exposes SDK capabilities", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    expect(sdk.gateway).toBeDefined();
    expect(sdk.verifier).toBeDefined();
    expect(sdk.settlement).toBeDefined();
    expect(sdk.slaEngine).toBeDefined();
    expect(sdk.monitoringWatcher).toBeDefined();
    expect(sdk.trustTierMiddleware).toBeDefined();
  });

  it("includes trustTierMiddleware in capability summary", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const summary = sdk.getCapabilitySummary();

    expect(summary.totalCapabilities).toBe(29);
    expect(summary.trustTierMiddlewareEnabled).toBe(true);
  });

  it("executes trust tier pipeline directly via SDK bridge", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const pipelineResult = sdk.runTrustTierPipeline({
      headers: {
        "x-conxian-light-proof": "spv_proof_data",
      },
      amountSat: 500_000n,
    });

    expect(pipelineResult.effectiveTier).toBe(TrustTier.Expedient);
    expect(pipelineResult.fee.feeSat).toBe(8_750n); // 175 bps for Lightning
    expect(pipelineResult.selectedRail).toBe(SettlementRail.Lightning);
    expect(pipelineResult.wireHeaders["x-conxian-tier"]).toBe("EXPEDIENT");
  });
});
