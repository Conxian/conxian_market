// Generate the Clarinet simnet account files at test time.
//
// The mnemonics are derived deterministically from public labels, so no key
// material is committed (docs/AGENTS.md "Zero Secret Egress"). These accounts
// exist only inside the local Clarity simnet and hold no value. `settings/` is
// gitignored.
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { entropyToMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

const LABELS = ["deployer", "wallet_1", "wallet_2", "wallet_3", "wallet_4"] as const;

function mnemonicFor(label: string): string {
  const digest = createHash("sha256").update(`conxian-simnet-${label}`).digest();
  return entropyToMnemonic(new Uint8Array(digest.subarray(0, 16)), wordlist);
}

function render(networkName: string): string {
  const accounts = LABELS.map(
    (label) =>
      `[accounts.${label}]\nmnemonic = "${mnemonicFor(label)}"\n` +
      `balance = 100_000_000_000_000\nsbtc_balance = 1_000_000_000\n`,
  ).join("\n");
  return `# Generated at test time by tests/contracts/clarinet.setup.ts.\n[network]\nname = "${networkName}"\ndeployment_fee_rate = 10\n\n${accounts}`;
}

mkdirSync("settings", { recursive: true });
writeFileSync("settings/Simnet.toml", render("simnet"));
writeFileSync("settings/Devnet.toml", render("devnet"));

// Minimal Clarinet session options for the vitest simnet harness.
(globalThis as unknown as { options: unknown }).options = {
  clarinet: { manifestPath: "./Clarinet.toml" },
};
