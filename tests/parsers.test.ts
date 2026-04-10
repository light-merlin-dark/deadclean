import { describe, expect, test } from "bun:test";
import {
  parseBiomeFixedCount,
  parseBiomeIssueCount,
  parseKnipResult,
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

  test("parses Knip JSON findings", () => {
    const payload = JSON.stringify({
      issues: [
        {
          file: "src/a.ts",
          files: [{ name: "src/a.ts" }],
          exports: [{ name: "unusedFn" }]
        },
        {
          file: "package.json",
          binaries: [{ name: "tsc" }]
        }
      ]
    });

    const parsed = parseKnipResult(result(payload, "", 1));
    expect(parsed.parsingErrors).toEqual([]);
    expect(parsed.findings).toEqual(["src/a.ts [files:1, exports:1]", "package.json [binaries:1]"]);
  });

  test("parses Knip JSON with prelude warning", () => {
    const output = [
      "Some plugin warning",
      JSON.stringify({
        issues: [
          {
            file: "src/a.ts",
            files: [{ name: "src/a.ts" }]
          }
        ]
      })
    ].join("\n");

    const parsed = parseKnipResult(result(output, "", 1));
    expect(parsed.parsingErrors).toEqual([]);
    expect(parsed.preludeWarnings).toEqual(["Some plugin warning"]);
    expect(parsed.findings).toEqual(["src/a.ts [files:1]"]);
  });

  test("reports Knip parsing error when payload is not json", () => {
    const parsed = parseKnipResult(result("not-json-output", "", 1));
    expect(parsed.findings).toEqual([]);
    expect(parsed.parsingErrors).toEqual(["Unable to parse Knip JSON output"]);
  });
});
