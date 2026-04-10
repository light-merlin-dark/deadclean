import { describe, expect, test } from "bun:test";
import { formatScanText, formatScanJson, formatScanSarif, formatJson, formatDoctorText } from "../src/format";
import type { CommandResult, DoctorReport, ScanReport, StructuredFinding, ToolBinaries } from "../src/types";

function makeCommandResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    command: "test",
    args: [],
    exitCode: 0,
    stdout: "",
    stderr: "",
    durationMs: 10,
    notFound: false,
    ...overrides
  };
}

function makeScanReport(overrides: Partial<ScanReport> = {}): ScanReport {
  const lintResult = makeCommandResult();
  const deadCodeResult = makeCommandResult();

  return {
    path: "/tmp/test",
    language: "python",
    lintTool: "ruff",
    deadCodeTool: "vulture",
    options: {
      path: ".",
      language: "python",
      fix: false,
      minConfidence: 80,
      maxFindings: 200,
      ensureTools: false,
      installMethod: "auto",
      output: "text",
      strict: false,
      strictLint: false,
      verbose: false,
      quiet: false,
      summary: false,
      knipConfig: null,
      workspaces: [],
      directory: null,
      knipArgs: [],
      biomeArgs: [],
      ruffArgs: [],
      vultureArgs: [],
      outputFile: null,
      fixRounds: 1,
      diffBase: null,
      staged: false,
      exclude: [],
      ruffBinary: "ruff",
      vultureBinary: "vulture",
      biomeBinary: "biome",
      knipBinary: "knip"
    },
    install: null,
    fixResult: null,
    lintResult,
    deadCodeResult,
    lintIssueCount: 0,
    fixedCount: 0,
    deadCodeFindingCount: 0,
    displayedDeadCodeFindingCount: 0,
    findingsTruncated: false,
    deadCodeFindings: [],
    deadCodeFindingsStructured: [],
    toolErrors: [],
    executionErrors: [],
    elapsedMs: 100,
    timestamp: "2026-04-10T12:00:00.000Z",
    toolVersions: { ruff: "1.0.0", vulture: "2.0", biome: null, knip: null },
    filesScanned: null,
    filesWithIssues: 0,
    exitCode: 0,
    status: "clean",
    ...overrides
  };
}

describe("format", () => {
  test("formatScanText produces clean report", () => {
    const report = makeScanReport({
      deadCodeFindingCount: 1,
      deadCodeFindings: ["app.py:10 unused function"],
      deadCodeFindingsStructured: [{ file: "app.py", line: 10, message: "unused function", tool: "vulture", category: "unused_code", name: null, confidence: 80, severity: "high" }],
      filesWithIssues: 1,
      status: "findings"
    });

    const text = formatScanText(report);
    expect(text).toContain("deadclean scan");
    expect(text).toContain("language: python");
    expect(text).toContain("dead_code_findings: 1");
    expect(text).toContain("status: findings");
    expect(text).toContain("timestamp: 2026-04-10T12:00:00.000Z");
  });

  test("formatScanText with quiet suppresses next section", () => {
    const report = makeScanReport();
    const text = formatScanText(report, true);
    expect(text).not.toContain("next:");
  });

  test("formatScanText summary mode", () => {
    const report = makeScanReport({
      lintIssueCount: 2,
      deadCodeFindingCount: 5,
      fixedCount: 2,
      elapsedMs: 612
    });

    const text = formatScanText(report, false, true);
    expect(text).toContain("2 lint");
    expect(text).toContain("5 dead-code");
    expect(text).toContain("2 fixed");
    expect(text).toContain("612ms");
  });

  test("formatScanJson includes structured fields", () => {
    const report = makeScanReport({
      deadCodeFindingsStructured: [
        { file: "a.ts", line: 5, message: "unused export", tool: "knip", category: "exports", name: "foo", confidence: null, severity: "high" }
      ],
      filesWithIssues: 1
    });

    const json = formatScanJson(report, false);
    const parsed = JSON.parse(json);

    expect(parsed.deadCodeFindingsStructured).toHaveLength(1);
    expect(parsed.deadCodeFindingsStructured[0].name).toBe("foo");
    expect(parsed.timestamp).toBe("2026-04-10T12:00:00.000Z");
    expect(parsed.status).toBe("clean");
    expect(parsed.exitCode).toBe(0);
    expect(parsed.toolVersions.ruff).toBe("1.0.0");
    expect(parsed.deadCodeFindingsByFile).toBeDefined();
  });

  test("formatScanSarif produces valid SARIF", () => {
    const report = makeScanReport({
      deadCodeFindingsStructured: [
        { file: "a.ts", line: 5, message: "unused export", tool: "knip", category: "exports", name: "foo", confidence: null, severity: "high" }
      ],
      filesWithIssues: 1
    });

    const sarif = formatScanSarif(report);
    const parsed = JSON.parse(sarif);

    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].tool.driver.name).toBe("deadclean");
    expect(parsed.runs[0].results).toHaveLength(1);
    expect(parsed.runs[0].results[0].level).toBe("error");
  });

  test("formatJson serializes cleanly", () => {
    const result = formatJson({ hello: "world" });
    expect(JSON.parse(result).hello).toBe("world");
  });

  test("formatDoctorText includes readiness", () => {
    const report: DoctorReport = {
      platform: "darwin",
      nodeVersion: "v22.0.0",
      bunVersion: "1.2.0",
      cwd: "/tmp",
      tools: [
        { name: "ruff", installed: true, version: "1.0.0", path: "/usr/bin/ruff" },
        { name: "vulture", installed: false, version: null, path: null }
      ],
      ready: false,
      readyFor: { python: false, typescript: true },
      missingTools: ["vulture"]
    };

    const text = formatDoctorText(report);
    expect(text).toContain("ready: false");
    expect(text).toContain("missing_tools: vulture");
  });
});
