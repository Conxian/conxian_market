// Regression guard: the published dist must be importable as Node ESM.
// A prior release (0.2.3) emitted extensionless relative imports (e.g.
// `./core_types` instead of `./core_types.js`) because tsconfig used
// `moduleResolution: "bundler"` + `"type": "module"`, which broke every
// Node ESM consumer. This script fails fast if that ever regresses.
import {
  calculateDynamicFee,
  SettlementOrchestrator,
  SettlementRail,
  TrustTier,
} from "../dist/index.js";

const r = calculateDynamicFee({
  tier: TrustTier.Expedient,
  rail: SettlementRail.Sbtc,
  amountSat: 1_000_000n,
});

if (typeof calculateDynamicFee !== "function" || typeof SettlementOrchestrator !== "function") {
  console.error("FAIL: dist exports are not functions");
  process.exit(1);
}
if (r.effectiveFeeSat <= 0n) {
  console.error("FAIL: unexpected fee result");
  process.exit(1);
}
console.log("dist ESM OK — effectiveFeeSat =", r.effectiveFeeSat.toString());
