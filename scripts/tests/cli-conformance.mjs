import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const binary = fileURLToPath(new URL("../../bin/conxian-agent-init.mjs", import.meta.url));
function context(fn) {
  const dir = mkdtempSync(join(tmpdir(), "conxian-cli-test-"));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function run(dir, args, extra = [], env = {}) {
  return spawnSync(process.execPath, [...extra, binary, ...args], {
    cwd: dir, encoding: "utf8", input: "", timeout: 10000,
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
}
for (const args of [["--help"], ["-h"], ["--schema"], ["--version"], ["--help", "--json"]]) {
  test(`${args.join(" ")} is offline discovery without writes`, () => context((dir) => {
    const result = run(dir, args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(readdirSync(dir), []);
    if (args.includes("--schema") || args.includes("--json")) {
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.schema_version, 1);
      assert.equal(parsed.interactive, false);
      assert.equal(parsed.authority.production_qualified, false);
    }
  }));
}
for (const args of [
  ["--unknown"], ["--gateway"], ["--tier", "STRICT", "--tier", "MANAGED"],
  ["unexpected"], ["--rail", "not-a-rail"], ["--tier", "not-a-tier"],
  ["--gateway", "https://user:password@example.invalid"],
  ["--gateway", "file:///tmp/server"], ["--nexus", "https://example.invalid/#fragment"],
  ["--gateway", "https://example.invalid/?token=never-echo-me"],
  ["--gateway", "https://example.invalid/\nINJECTED=bad"],
]) {
  test(`invalid option case ${JSON.stringify(args)} fails without writing`, () => context((dir) => {
    const result = run(dir, [...args, "--json"]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(JSON.parse(result.stderr).status, "error");
    assert.ok(!result.stderr.includes("never-echo-me"));
    assert.ok(!result.stderr.includes("password"));
    assert.deepEqual(readdirSync(dir), []);
  }));
}
const commands = [["--help"], ["--schema"], ["--graph"], ["--version"], ["--dry-run"], ["--diagnose", "gateway"]];
for (let left = 0; left < commands.length; left++) {
  for (let right = left + 1; right < commands.length; right++) {
    for (const args of [[...commands[left], ...commands[right]], [...commands[right], ...commands[left]]]) {
      test(`mixed commands fail before effects: ${args.join(" ")}`, () => context((dir) => {
        const result = run(dir, [...args, "--json"]);
        assert.equal(result.status, 2, result.stderr);
        assert.equal(result.stdout, "");
        assert.equal(JSON.parse(result.stderr).code, "conflicting_commands");
        assert.deepEqual(readdirSync(dir), []);
      }));
    }
  }
}
for (const args of [
  ["--help", "--output", "unused.env"],
  ["--schema", "--output", "unused.env"], ["--graph", "--gateway", "https://example.invalid"],
  ["--version", "--tier", "MANAGED"], ["--schema", "--nexus", "https://example.invalid"],
  ["--graph", "--rail", "EVM_ERC8183"],
  ["--diagnose", "gateway", "--output", "unused.env"],
  ["--diagnose", "gateway", "--gateway", "https://example.invalid"],
  ["--diagnose", "nexus", "--nexus", "https://example.invalid"],
  ["--diagnose", "gateway", "--tier", "MANAGED"],
  ["--diagnose", "gateway", "--rail", "EVM_ERC8183"],
]) {
  test(`unused onboarding options are rejected: ${args.join(" ")}`, () => context((dir) => {
    const result = run(dir, [...args, "--json"]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(JSON.parse(result.stderr).code, "invalid_arguments");
    assert.deepEqual(readdirSync(dir), []);
  }));
}
test("preview creates no keys, files or network connections", () => context((dir) => {
  const blocker = join(dir, "block-network.mjs");
  writeFileSync(blocker, 'import net from "node:net";\nglobalThis.fetch = () => { throw new Error("network blocked"); };\nnet.Socket.prototype.connect = () => { throw new Error("network blocked"); };\n');
  const result = run(dir, ["--dry-run", "--json", "--rail", "EvmErc8183", "--tier", "ObserverOnly"], ["--import", blocker]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const data = JSON.parse(result.stdout);
  assert.equal(data.status, "planned");
  assert.equal(data.identity_created, false);
  assert.equal(data.network_probes_performed, false);
  assert.equal(data.configuration.rail, "EVM_ERC8183");
  assert.equal(data.configuration.tier, "OBSERVER_ONLY");
  assert.deepEqual(data.files_written, []);
  assert.deepEqual(readdirSync(dir), ["block-network.mjs"]);
}));
test("onboarding preserves incomplete evidence and a private local identity", () => context((dir) => {
  const result = run(dir, ["--json"]);
  assert.equal(result.status, 1, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.status, "incomplete");
  assert.equal(data.execution_enabled, false);
  assert.equal(data.provisioned, false);
  assert.equal(data.runtime_verified, false);
  assert.equal(data.custody_verified, false);
  assert.equal(JSON.parse(result.stderr).code, "evidence_unavailable");
  const content = readFileSync(join(dir, ".conxian-agent.env"), "utf8");
  const privateKey = content.match(/^CONXIAN_PRIVATE_KEY=(.+)$/mu)[1];
  assert.ok(!result.stdout.includes(privateKey));
  assert.ok(!result.stderr.includes(privateKey));
  if (process.platform !== "win32") assert.equal(statSync(data.identity_file).mode & 0o777, 0o600);
}));
test("existing identity remains byte-for-byte intact", () => context((dir) => {
  const file = join(dir, ".conxian-agent.env");
  writeFileSync(file, "existing-user-owned-identity\n", { mode: 0o600 });
  const result = run(dir, ["--json"]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(JSON.parse(result.stderr).code, "identity_exists");
  assert.equal(readFileSync(file, "utf8"), "existing-user-owned-identity\n");
}));
test("explicit output path does not claim provisioning", () => context((dir) => {
  const result = run(dir, ["--json", "--output", "local-identity.env"]);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stdout).identity_file, resolve(dir, "local-identity.env"));
  assert.deepEqual(readdirSync(dir), ["local-identity.env"]);
}));

test("graph is internally consistent source metadata, not runtime evidence", () => context((dir) => {
  const result = run(dir, ["--graph"]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  assert.equal(graph.schema_version, 1);
  assert.equal(graph.runtime_discovery_performed, false);
  assert.equal(graph.production_qualified, false);
  const ids = new Set(graph.nodes.map((node) => node.id));
  assert.equal(ids.size, graph.nodes.length);
  for (const edge of graph.edges) {
    assert.ok(ids.has(edge.from)); assert.ok(ids.has(edge.to));
    assert.ok(edge.evidence);
  }
  assert.deepEqual(readdirSync(dir), []);
}));

for (const args of [
  ["--diagnose", "other"], ["--diagnose", "gateway"], ["--endpoint", "https://example.invalid"],
  ["--diagnose", "gateway", "--dry-run"], ["--diagnose", "nexus", "--graph"],
  ["--diagnose", "gateway", "--endpoint", "https://example.invalid", "--timeout-ms", "10001"],
  ["--diagnose", "gateway", "--endpoint", "https://example.invalid", "--token-env", "unsafe=value"],
]) {
  test(`invalid diagnostic arguments remain offline: ${JSON.stringify(args)}`, () => context((dir) => {
    const result = run(dir, [...args, "--json"]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(JSON.parse(result.stderr).status, "error");
    assert.deepEqual(readdirSync(dir), []);
  }));
}

test("diagnostic credential is required without exposing endpoint credentials", () => context((dir) => {
  const result = run(dir, ["--diagnose", "gateway", "--endpoint", "https://example.invalid", "--json"], [], { CONXIAN_DIAGNOSTIC_TOKEN: "" });
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stderr).code, "credential_unavailable");
  assert.deepEqual(readdirSync(dir), []);
}));

test("diagnostic process makes only the authenticated read and never writes an identity", () => context((dir) => {
  const stub = join(dir, "provider.mjs");
  writeFileSync(stub, `import assert from "node:assert/strict";
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), "https://example.invalid/api/v1/capabilities");
  assert.equal(init.method, "GET"); assert.equal(init.redirect, "error");
  assert.equal(init.headers.Authorization, "Bearer test-only-secret");
  return new Response(JSON.stringify({schema_version:1, manifest_kind:"adapter_registration",
    repository:"Conxian/conxian-gateway", version:"0.1.5", source:"runtime-adapter-map", trust_root:"bitcoin-l1",
    scope:"universal-chain", native_conxian_token:false, adapters:[]}), {headers:{"content-type":"application/json"}});
};`);
  const result = run(dir, ["--diagnose", "gateway", "--endpoint", "https://example.invalid", "--json"], ["--import", stub], { CONXIAN_DIAGNOSTIC_TOKEN: "test-only-secret" });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.command, "diagnose");
  assert.equal(data.status, "ok");
  assert.equal(data.execution_enabled, false);
  assert.equal(data.diagnostic.qualifiedOperationCount, 0);
  assert.equal(data.diagnostic.productionQualified, false);
  assert.equal(result.stderr, "");
  assert.ok(!result.stdout.includes("test-only-secret"));
  assert.deepEqual(readdirSync(dir), ["provider.mjs"]);
}));

test("diagnostic rejection has stable exit and redacts provider text", () => context((dir) => {
  const stub = join(dir, "provider.mjs");
  writeFileSync(stub, 'globalThis.fetch = async () => new Response("test-only-secret", {status: 401});');
  const result = run(dir, ["--diagnose", "nexus", "--endpoint", "https://example.invalid", "--json"], ["--import", stub], { CONXIAN_DIAGNOSTIC_TOKEN: "test-only-secret" });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).diagnostic.code, "http_rejected");
  assert.ok(!`${result.stdout}${result.stderr}`.includes("test-only-secret"));
  assert.deepEqual(readdirSync(dir), ["provider.mjs"]);
}));
