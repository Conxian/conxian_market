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
function run(dir, args, extra = []) {
  return spawnSync(process.execPath, [...extra, binary, ...args], {
    cwd: dir, encoding: "utf8", input: "", timeout: 10000,
    env: { ...process.env, NO_COLOR: "1" },
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
