import { describe, expect, it } from "vitest";
import { ConxianMarketSDK } from "../src/sdk_bridge";
import { SettlementRail, TrustTier } from "../src/core_types";

describe("sdk_bridge", () => {
  it("connects and exposes SDK capabilities", async () => {
    const sdk = await ConxianMarketSDK.connect({
      baseUrl: "https://gateway.conxian.io",
      apiToken: "test-token",
    });

    expect(sdk.gateway).toBeDefined();
    expect(sdk.settlement).toBeDefined();
    expect(sdk.verifier).toBeDefined();

    const fee = sdk.calculateFee(100_000n, TrustTier.Expedient, SettlementRail.Sbtc);
    expect(fee.feeBps).toBe(200);
    expect(fee.feeSat).toBe(2000n);

    const capabilities = sdk.getCapabilitySummary();
    expect(capabilities.coreModules.controlModel).toBe(true);
    expect(capabilities.enclaveModules.swapRouter).toBe(true);
  });
});
