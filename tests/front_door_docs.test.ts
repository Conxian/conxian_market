import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");

// The front door (README, GOVERNANCE) must state the accepted ADR-007 model.
// Historical/dated docs (ROADMAP session logs, knowledge_base) may retain the
// retired 80/10/10 for provenance, but must not present it as current.
const LIVING_DOCS = ["README.md", "docs/GOVERNANCE.md"];

describe("front-door docs carry the ADR-007 fee model", () => {
  for (const rel of LIVING_DOCS) {
    it(`${rel} references ADR-007`, () => {
      expect(read(rel)).toMatch(/ADR-007/);
    });

    it(`${rel} does not present 80/10/10 as the current split`, () => {
      const text = read(rel);
      // Any surviving 80/10/10 mention must be explicitly framed as retired.
      for (const line of text.split("\n")) {
        if (line.includes("80/10/10")) {
          expect(line.toLowerCase()).toMatch(/retired|superseded|historical/);
        }
      }
    });
  }

  it("README states the one 50/30/20 split rule and the 10% matched-job take", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/50\/30\/20/);
    expect(readme).toMatch(/10%\s*take/i);
  });
});
