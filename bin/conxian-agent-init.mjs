#!/usr/bin/env node
/**
 * conxian-agent-init — automated client onboarding CLI.
 *
 * Single-command provisioning for indie AI agent developers (ElizaOS, LangGraph,
 * AutoGen, CrewAI). Generates a local identity and an installation plan. Runtime connectivity,
 * purchased entitlement and provider custody remain unverified until integrated.
 *
 * Usage:
 *   node bin/conxian-agent-init.mjs [--gateway <url>] [--nexus <url>] [--rail <rail>] [--tier <tier>]
 */
import { generateKeyPairSync, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ConxianMarketSDK, SettlementRail, TrustTier } from "../dist/index.js";

const DEFAULT_GATEWAY = "https://api.conxian-labs.com/v1/agent";
const DEFAULT_NEXUS = "https://nexus.conxian.org";
const DEFAULT_RAIL = "EVM_ERC8183";
const DEFAULT_TIER = "MANAGED";

function parseArgs(argv) {
  const args = { gateway: DEFAULT_GATEWAY, nexus: DEFAULT_NEXUS, rail: DEFAULT_RAIL, tier: DEFAULT_TIER };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === "--gateway" && next) args.gateway = next;
    else if (flag === "--nexus" && next) args.nexus = next;
    else if (flag === "--rail" && next) args.rail = next;
    else if (flag === "--tier" && next) args.tier = next;
    else if (flag === "--help" || flag === "-h") {
      console.log(
        [
          "conxian-agent-init — Conxian Managed SaaS Gateway onboarding",
          "",
          "Usage: node bin/conxian-agent-init.mjs [options]",
          "  --gateway <url>   Managed subscriber endpoint (default: https://api.conxian-labs.com/v1/agent)",
          "  --nexus <url>     Nexus Glass Node endpoint (default: https://nexus.conxian.org)",
          "  --rail <rail>     Settlement rail (default: EVM_ERC8183)",
          "  --tier <tier>     TrustTier (default: MANAGED)",
          "  -h, --help        Show this help",
        ].join("\n")
      );
      process.exit(0);
    }
  }
  return args;
}

function resolveRail(rail) {
  const key = Object.keys(SettlementRail).find(
    (k) => k.toUpperCase() === rail.toUpperCase()
  );
  return key ? SettlementRail[key] : SettlementRail.EvmErc8183;
}

function resolveTier(tier) {
  const key = Object.keys(TrustTier).find(
    (k) => k.toUpperCase() === tier.toUpperCase()
  );
  return key ? TrustTier[key] : TrustTier.Managed;
}

/** Generate a zero-custody Ed25519 identity + derived client DID. */
function generateClientKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubPem = publicKey.export({ type: "spki", format: "pem" });
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const pubDigest = createHash("sha256").update(pubPem).digest("hex").slice(0, 32);
  const clientDid = `did:conxian:agent:${pubDigest}`;
  return { clientDid, pubPem, privPem };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rail = resolveRail(args.rail);
  const tier = resolveTier(args.tier);

  console.log("=== Conxian Agent Onboarding (conxian-agent-init) ===");

  const keys = generateClientKeys();
  console.log(`  Client DID  : ${keys.clientDid}`);

  const config = {
    clientDid: keys.clientDid,
    gatewayUrl: args.gateway,
    nexusUrl: args.nexus,
    defaultSettlementRail: rail,
    targetTrustTier: tier,
  };

  const sdk = await ConxianMarketSDK.connect({ baseUrl: args.gateway });

  const t0 = Date.now();
  const result = sdk.runUnifiedInstallerCli(config);
  const elapsedMs = Date.now() - t0;

  console.log("\n  Provisioning:");
  console.log(`    Entitlement : ${result.entitlement.licenseId} (${result.entitlement.tier})`);
  console.log(`    Manifest    : ${result.manifest?.manifestId ?? "n/a"}`);
  console.log(`    Connectivity: ${result.connectivity.allAssetsOperational ? "OPERATIONAL" : "DEGRADED"}`);
  for (const detail of result.connectivity.details) {
    console.log(`      - ${detail}`);
  }
  console.log(`    Zero-custody: ${result.zeroCustody.passed ? "PASSED" : "FAILED"}`);
  console.log(`    Provisioned : ${result.provisioning.provisioned ? "YES" : "NO"}`);
  console.log(`    Elapsed     : ${elapsedMs}ms`);

  // Persist zero-custody keys locally (never transmitted to the gateway).
  const envFile = join(process.cwd(), ".conxian-agent.env");
  writeFileSync(
    envFile,
    [
      `CONXIAN_CLIENT_DID=${keys.clientDid}`,
      `CONXIAN_GATEWAY_URL=${args.gateway}`,
      `CONXIAN_NEXUS_URL=${args.nexus}`,
      `CONXIAN_PUBLIC_KEY=${Buffer.from(keys.pubPem).toString("base64")}`,
      `CONXIAN_PRIVATE_KEY=${Buffer.from(keys.privPem).toString("base64")}`,
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" }
  );
  console.log(`\n  Wrote local identity → ${envFile} (mode 0600)`);

  if (!result.provisioning.provisioned) {
    console.error("\nOnboarding incomplete — entitlement, runtime, custody and provisioning evidence remain unverified.");
    process.exit(1);
  }

  console.log("\nOnboarding evidence checks completed.");
}

main().catch((err) => {
  console.error("Onboarding failed:", err);
  process.exit(1);
});
