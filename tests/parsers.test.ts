import { describe, expect, test } from "bun:test";
import {
  parseBiomeFixedCount,
  parseBiomeIssueCount,
  parseKnipFindings,
  parseRuffFixedCount,
  parseRuffIssueCount,
  parseVultureFindings
} from "../src/parsers";
import type { CommandResult } from "../src/types";

function result(stdout: string, stderr = "", exitCode = 0): CommandResult {
  return {
    command: "test",
    args: [],
    exitCode,
    stdout,
    stderr,
    durationMs: 1,
    notFound: false
  };
}

describe("parsers", () => {
  test("parses Ruff issue and fix counts", () => {
    const fixOutput = "Found 3 errors (2 fixed, 1 remaining).";
    const checkOutput = "Found 1 error.";

    expect(parseRuffFixedCount(result(fixOutput))).toBe(2);
    expect(parseRuffIssueCount(result(checkOutput))).toBe(1);
  });

  test("parses Vulture findings", () => {
    const output = [
      "app.py:10: unused function 'debug_helper' (100% confidence)",
      "pkg/utils.py:22: unused variable 'tmp' (100% confidence)"
    ].join("\n");

    const findings = parseVultureFindings(result(output));

    expect(findings).toHaveLength(2);
    expect(findings[0]).toEqual({
      file: "app.py",
      line: 10,
      message: "unused function 'debug_helper' (100% confidence)"
    });
  });

  test("parses Biome issues and fixes", () => {
    expect(parseBiomeIssueCount(result("Found 4 diagnostics."))).toBe(4);
    expect(parseBiomeIssueCount(result("Checked 3 files in 4ms. No fixes applied."))).toBe(0);
    expect(parseBiomeFixedCount(result("Applied 3 fixes."))).toBe(3);
  });

  test("parses Knip findings", () => {
    const findings = parseKnipFindings(result("Unused files (1)\nsrc/a.ts\nsrc/b.ts: unused export"));
    expect(findings).toEqual(["src/a.ts", "src/b.ts: unused export"]);
  });
});
