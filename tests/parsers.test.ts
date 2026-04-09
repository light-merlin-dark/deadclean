import { describe, expect, test } from "bun:test";
import { parseRuffFixedCount, parseRuffIssueCount, parseVultureFindings } from "../src/parsers";
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
});
