import { describe, expect, test } from "bun:test";
import {
  parseBiomeFixedCount,
  parseBiomeIssueCount,
  parseBiomeStructured,
  parseKnipResult,
  parseRuffFixedCount,
  parseRuffIssueCount,
  parseRuffStructured,
  parseVultureFindings,
  parseVultureStructured
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

  test("parses Ruff JSON output", () => {
    const jsonOutput = JSON.stringify([
      { filename: "a.py", location: { row: 10 }, message: "unused import", code: { code: "F401" } },
      { filename: "b.py", location: { row: 5 }, message: "undefined name", code: { code: "F821" } }
    ]);
    expect(parseRuffIssueCount(result(jsonOutput))).toBe(2);

    const structured = parseRuffStructured(result(jsonOutput));
    expect(structured).toHaveLength(2);
    expect(structured[0].file).toBe("a.py");
    expect(structured[0].line).toBe(10);
    expect(structured[0].category).toBe("F401");
  });

  test("parses Vulture findings with confidence", () => {
    const output = [
      "app.py:10: unused function 'debug_helper' (60% confidence)",
      "pkg/utils.py:22: unused variable 'tmp' (100% confidence)"
    ].join("\n");

    const findings = parseVultureFindings(result(output));

    expect(findings).toHaveLength(2);
    expect(findings[0]).toEqual({
      file: "app.py",
      line: 10,
      message: "unused function 'debug_helper' (60% confidence)",
      confidence: 60
    });
    expect(findings[1].confidence).toBe(100);
  });

  test("parses Vulture structured findings", () => {
    const output = "app.py:10: unused function 'debug_helper' (80% confidence)";
    const structured = parseVultureStructured(result(output));

    expect(structured).toHaveLength(1);
    expect(structured[0].tool).toBe("vulture");
    expect(structured[0].category).toBe("unused_code");
    expect(structured[0].confidence).toBe(80);
    expect(structured[0].severity).toBe("high");
  });

  test("parses Biome issues and fixes", () => {
    expect(parseBiomeIssueCount(result("Found 4 diagnostics."))).toBe(4);
    expect(parseBiomeIssueCount(result("Checked 3 files in 4ms. No fixes applied."))).toBe(0);
    expect(parseBiomeFixedCount(result("Applied 3 fixes."))).toBe(3);
  });

  test("parses Biome JSON output", () => {
    const jsonOutput = JSON.stringify({
      diagnostics: [
        { location: { file: "a.ts", line: 5 }, message: "unused var", category: "lint" },
        { location: { file: "b.ts", line: 10 }, message: "missing semicolon", category: "style" }
      ]
    });
    expect(parseBiomeIssueCount(result(jsonOutput))).toBe(2);

    const structured = parseBiomeStructured(result(jsonOutput));
    expect(structured).toHaveLength(2);
    expect(structured[0].file).toBe("a.ts");
    expect(structured[0].category).toBe("lint");
  });

  test("parses Knip JSON findings with symbol names", () => {
    const payload = JSON.stringify({
      issues: [
        {
          file: "src/a.ts",
          files: [{ name: "src/a.ts" }],
          exports: [{ name: "unusedFn" }, { name: "oldExport" }]
        },
        {
          file: "package.json",
          binaries: [{ name: "tsc" }]
        }
      ]
    });

    const parsed = parseKnipResult(result(payload, "", 1));
    expect(parsed.parsingErrors).toEqual([]);
    expect(parsed.findings).toEqual(["src/a.ts [files:src/a.ts, exports:unusedFn, oldExport]", "package.json [binaries:tsc]"]);
    expect(parsed.findingsStructured).toHaveLength(4);
    expect(parsed.findingsStructured[0].name).toBe("src/a.ts");
    expect(parsed.findingsStructured[1].name).toBe("unusedFn");
    expect(parsed.findingsStructured[2].name).toBe("oldExport");
    expect(parsed.findingsStructured[3].name).toBe("tsc");
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
    expect(parsed.findings).toEqual(["src/a.ts [files:src/a.ts]"]);
  });

  test("reports Knip parsing error when payload is not json", () => {
    const parsed = parseKnipResult(result("not-json-output", "", 1));
    expect(parsed.findings).toEqual([]);
    expect(parsed.findingsStructured).toEqual([]);
    expect(parsed.parsingErrors).toEqual(["Unable to parse Knip JSON output"]);
  });

  test("handles empty output gracefully", () => {
    const parsed = parseKnipResult(result("", "", 0));
    expect(parsed.findings).toEqual([]);
    expect(parsed.findingsStructured).toEqual([]);
    expect(parsed.parsingErrors).toEqual([]);
  });
});
