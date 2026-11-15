// Generate a reference fee grid from the REAL compiled TypeScript.
// Pass 1 self-verification for analysis/parity_check.py.
//
//   npm run build
//   node analysis/gen_ts_grid.mjs > /tmp/ts_fee_grid.json
import { writeFileSync } from "node:fs";
import * as fc from "../dist/fee_calculator.js";

const rails = Object.keys(fc.RAIL_COST_ESTIMATE_SAT);
const tiers = ["TIER_1", "TIER_2", "TIER_3", "TIER_4"];
const amounts = [1000, 5000, 10000, 50000, 100000, 250000, 1000000, 5000000, 100000000];
const loads = [1.0, 1.5, 2.0, 3.0, 5.0];

const rows = [];
for (const rail of rails)
  for (const tier of tiers)
    for (const amountSat of amounts)
      for (const systemLoadFactor of loads) {
        const r = fc.calculateDynamicFee({
          tier: "Expedient", rail, amountSat: BigInt(amountSat), volumeDecayTier: tier, systemLoadFactor,
        });
        rows.push([
          rail, tier, amountSat, systemLoadFactor,
          String(r.percentageFeeSat), String(r.flatFloorSat), String(r.effectiveFeeSat),
          String(r.effectiveBps), String(r.distribution.operationsSat),
          String(r.distribution.foundersSat), String(r.distribution.ecosystemSat),
        ]);
      }

writeFileSync(process.argv[2] ?? "/tmp/ts_fee_grid.json", JSON.stringify(rows));
console.log(`wrote ${rows.length} rows`);
