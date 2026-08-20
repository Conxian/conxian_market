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
    expect(sdk.bosYieldSplitter).toBeDefined();
  });

  it("includes trustTierMiddleware and bosYieldSplitter in capability summary", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);
    const summary = sdk.getCapabilitySummary();

    expect(summary.totalCapabilities).toBe(30);
    expect(summary.trustTierMiddlewareEnabled).toBe(true);
    expect(summary.bosYieldSplitterEnabled).toBe(true);
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

  it("exposes BOS yield splitting, fee decay, vesting, and inference verification directly", async () => {
    const sdk = await ConxianMarketSDK.connect(dummyConfig);

    const split = sdk.calculateYieldSplit(100_000n);
    expect(split.builderSat).toBe(80_000n);

    const feeDist = sdk.distributeProtocolFee(1_000_000n, 18); // 18m = Growth Phase (150 bps)
    expect(feeDist.feeSat).toBe(15_000n);

    const policy = sdk.verifyInferencePolicy({
      isCentralizedInference: false,
      handlesPrivateKeys: false,
      usesMcpHandoff: true,
      usesEnclaveSdk: false,
    });
    expect(policy.compliant).toBe(true);
  });
});
