#!/usr/bin/env node
/** Local identity and onboarding-plan CLI. Plans do not authorize execution. */
import { generateKeyPairSync, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const OPTIONS = {
  gateway: { type: "string", default: "https://api.conxian-labs.com/v1/agent" },
  nexus: { type: "string", default: "https://nexus.conxian.org" },
  rail: { type: "string", default: "EVM_ERC8183" },
  tier: { type: "string", default: "MANAGED" },
  output: { type: "string", default: ".conxian-agent.env" },
  "dry-run": { type: "boolean", default: false },
  json: { type: "boolean", default: false },
  schema: { type: "boolean", default: false },
  graph: { type: "boolean", default: false },
  version: { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
};

class CliError extends Error {
  constructor(code, message, exitCode = 2) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}

function envelope(command, status, data) {
  return { schema_version: 1, command, status, ...data };
}

function schema() {
  return envelope("schema", "ok", {
    name: "conxian-agent-init",
    version: VERSION,
    interactive: false,
    options: Object.fromEntries(Object.entries(OPTIONS).map(([name, option]) => [name, {
      type: option.type,
      default: option.default,
    }])),
    output_schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      required: ["schema_version", "command", "status"],
      properties: {
        schema_version: { const: 1 },
        command: { type: "string" },
        status: { enum: ["ok", "planned", "incomplete", "error"] },
      },
    },
    effects: { graph: "none", schema: "none", help: "none", preview: "none", onboarding: "exclusive local identity file creation" },
    exit_codes: { "0": "requested local operation completed", "1": "onboarding incomplete or local operation failed", "2": "invalid arguments or configuration" },
    authority: { runtime_verified: false, custody_verified: false, production_qualified: false },
  });
}

function readArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, strict: true, allowPositionals: false, tokens: true });
  } catch {
    throw new CliError("invalid_arguments", "Invalid CLI arguments; use --help or --schema.");
  }
  const seen = new Set();
  for (const token of parsed.tokens) {
    if (token.kind !== "option") continue;
    if (seen.has(token.name)) throw new CliError("duplicate_option", "Supply each option once.");
    seen.add(token.name);
  }
  return parsed.values;
}

function endpoint(value, name) {
  try {
    // Reject control bytes before URL parsing can normalize them away.
    if (/[\u0000-\u0020\u007f]/u.test(value)) throw new Error();
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname ||
        url.username || url.password || url.hash || url.search) throw new Error();
    return url.href;
  } catch {
    throw new CliError("invalid_endpoint", `${name} must be an HTTP(S) URL without credentials, queries or fragments.`);
  }
}

function enumValue(value, values, name) {
  const normalize = (text) => text.replace(/[_-]/gu, "").toUpperCase();
  const match = Object.entries(values).find(([key, item]) =>
    normalize(key) === normalize(value) || normalize(item) === normalize(value));
  if (!match) throw new CliError("invalid_selection", `Unknown ${name}; use an SDK enum name or value.`);
  return match[1];
}

function generateClientKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubPem = publicKey.export({ type: "spki", format: "pem" });
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const digest = createHash("sha256").update(pubPem).digest("hex").slice(0, 32);
  return { clientDid: `did:conxian:agent:${digest}`, pubPem, privPem };
}

function emit(result, json) {
  if (json) {
    console.log(JSON.stringify(result));
    return;
  }
  console.log(`Conxian Agent Onboarding ${VERSION}: ${result.status}`);
  if (result.clientDid) console.log(`Client DID: ${result.clientDid}`);
  if (result.identity_file) console.log(`Local identity: ${result.identity_file}`);
  console.log(`Runtime verified: ${result.runtime_verified === true}`);
  console.log(`Custody verified: ${result.custody_verified === true}`);
  console.log(`Provisioned: ${result.provisioned === true}`);
  if (result.status === "planned") console.log("Preview only; no identity, files or network requests created.");
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  if (args.schema || (args.help && args.json)) {
    console.log(JSON.stringify(schema()));
    return;
  }
  if (args.graph) {
    console.log(JSON.stringify(JSON.parse(readFileSync(new URL("./system-graph.json", import.meta.url), "utf8"))));
    return;
  }
  if (args.version) {
    console.log(args.json ? JSON.stringify(envelope("version", "ok", { version: VERSION })) : VERSION);
    return;
  }
  if (args.help) {
    console.log([
      "conxian-agent-init — local identity and onboarding plan", "",
      "Usage: conxian-agent-init [options]",
      "  --gateway <url>   Managed Gateway endpoint",
      "  --nexus <url>     Nexus observation endpoint",
      "  --rail <rail>     SDK rail name/value (default: EVM_ERC8183)",
      "  --tier <tier>     SDK tier name/value (default: MANAGED)",
      "  --output <path>  New local identity file (default: .conxian-agent.env)",
      "  --dry-run        Preview without creating keys, files or network requests",
      "  --json           Versioned JSON on stdout; structured errors on stderr",
      "  --schema         Machine-readable options, output shape, effects and exits",
      "  --graph          Offline architecture reference; no live service claims",
      "  --version        Package version",
      "  -h, --help       Show help; --help --json returns the command schema",
      "", "A local plan does not prove purchased entitlement, runtime health or hardware custody.",
    ].join("\n"));
    return;
  }
  const gatewayUrl = endpoint(args.gateway, "Gateway");
  const nexusUrl = endpoint(args.nexus, "Nexus");
  if (!args.output.trim() || /[\u0000\r\n]/u.test(args.output)) {
    throw new CliError("invalid_output", "Supply a valid local identity output path.");
  }

  let sdk;
  try { sdk = await import("../dist/index.js"); }
  catch { throw new CliError("sdk_unavailable", "Build the SDK distribution before onboarding or previewing.", 1); }
  const rail = enumValue(args.rail, sdk.SettlementRail, "rail");
  const tier = enumValue(args.tier, sdk.TrustTier, "tier");
  const config = {
    clientDid: "did:conxian:preview",
    gatewayUrl, nexusUrl,
    defaultSettlementRail: rail,
    targetTrustTier: tier,
  };
  const client = await sdk.ConxianMarketSDK.connect({ baseUrl: gatewayUrl });
  const validation = client.validateClientConfig(config);
  if (!validation.valid) {
    throw new CliError("invalid_configuration", "Configuration violates the SDK onboarding boundary; review endpoint and selection settings.");
  }
  const common = {
    runtime_verified: false, custody_verified: false, provisioned: false,
    network_probes_performed: false, production_qualified: false,
    configuration: { gatewayUrl, nexusUrl, rail, tier },
  };
  if (args["dry-run"]) {
    emit(envelope("onboard", "planned", { ...common, identity_created: false, files_written: [] }), args.json);
    return;
  }

  const keys = generateClientKeys();
  config.clientDid = keys.clientDid;
  const result = client.runUnifiedInstallerCli(config);
  const envFile = resolve(args.output);
  try {
    writeFileSync(envFile, [
      `CONXIAN_CLIENT_DID=${keys.clientDid}`,
      `CONXIAN_GATEWAY_URL=${gatewayUrl}`,
      `CONXIAN_NEXUS_URL=${nexusUrl}`,
      `CONXIAN_PUBLIC_KEY=${Buffer.from(keys.pubPem).toString("base64")}`,
      `CONXIAN_PRIVATE_KEY=${Buffer.from(keys.privPem).toString("base64")}`, "",
    ].join("\n"), { mode: 0o600, flag: "wx" });
  } catch (error) {
    throw new CliError(error.code === "EEXIST" ? "identity_exists" : "identity_write_failed",
      "Could not create a new local identity file; existing files are preserved.", 1);
  }
  // The current engine returns a local plan with no independent provisioning evidence.
  emit(envelope("onboard", "incomplete", {
    ...common, clientDid: keys.clientDid, identity_created: true, identity_file: envFile,
    manifest_id: result.manifest?.manifestId ?? null,
    execution_enabled: false,
  }), args.json);
  const message = "Onboarding remains incomplete until entitlement, runtime, custody and provisioning evidence are independently verified.";
  console.error(args.json
    ? JSON.stringify(envelope("onboard", "error", { code: "evidence_unavailable", message }))
    : message);
  process.exitCode = 1;
}

main().catch((error) => {
  const known = error instanceof CliError;
  const result = envelope("onboard", "error", {
    code: known ? error.code : "local_operation_failed",
    message: known ? error.message : "The local operation failed; no successful onboarding is established.",
  });
  if (process.argv.includes("--json")) console.error(JSON.stringify(result));
  else console.error(`${result.code}: ${result.message}`);
  process.exitCode = known ? error.exitCode : 1;
});
