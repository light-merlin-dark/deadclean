import { describe, expect, test } from "bun:test";
import { runScan } from "../src/scan";
import type { CommandResult, CommandRunner, ScanOptions } from "../src/types";

class ScanRunner implements CommandRunner {
  async run(command: string, args: string[]): Promise<CommandResult> {
    const full = `${command} ${args.join(" ")}`.trim();

    if (
      full === "ruff --version" ||
      full === "vulture --version" ||
      full === "biome --version" ||
      full === "knip --version"
    ) {
      return this.make(full, 0, "1.0.0");
    }

    if (full === "which ruff") {
      return this.make(full, 0, "/usr/local/bin/ruff");
    }

    if (full === "which vulture") {
      return this.make(full, 0, "/usr/local/bin/vulture");
    }

    if (full === "which biome") {
      return this.make(full, 0, "/usr/local/bin/biome");
    }

    if (full === "which knip") {
      return this.make(full, 0, "/usr/local/bin/knip");
    }

    if (full.startsWith("git ")) {
      return this.make(full, 0, "");
    }

    if (full.includes("ruff check") && full.includes("--fix")) {
      return this.make(full, 0, "[]");
    }

    if (full.includes("ruff check") && !full.includes("--fix")) {
      return this.make(full, 0, "[]");
    }

    if (full.startsWith("vulture ")) {
      return this.make(full, 1, "sample.py:4: unused function 'old_code' (100% confidence)");
    }

    if (full.includes("biome lint") && full.includes("--write")) {
      return this.make(full, 0, "Applied 2 fixes.");
    }

    if (full.includes("biome lint") && !full.includes("--write")) {
      return this.make(full, 0, "Checked 3 files in 4ms. No fixes applied.");
    }

    if (full.startsWith("knip ")) {
      return this.make(
        full,
        1,
        JSON.stringify({
          issues: [
            {
              file: "src/a.ts",
              exports: [{ name: "unusedExport" }]
            },
            {
              file: "src/b.ts",
              files: [{ name: "src/b.ts" }]
            }
          ]
        })
      );
    }

    return this.make(full, 1, "unexpected command");
  }

  private make(command: string, exitCode: number, stdout: string): CommandResult {
    return {
      command,
      args: [],
      exitCode,
      stdout,
      stderr: "",
      durationMs: 1,
      notFound: false
    };
  }
}

const baseOptions: Omit<ScanOptions, "language"> = {
  path: ".",
  fix: true,
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
};

describe("scan", () => {
  test("fails fast on nonexistent path", async () => {
    await expect(
      runScan(new ScanRunner(), {
        ...baseOptions,
        path: "/tmp/deadclean-missing-path",
        language: "python"
      })
    ).rejects.toThrow("Scan path does not exist");
  });

  test("runs python scan and parses findings", async () => {
    const report = await runScan(new ScanRunner(), {
      ...baseOptions,
      language: "python"
    });

    expect(report.language).toBe("python");
    expect(report.lintIssueCount).toBe(0);
    expect(report.deadCodeFindingCount).toBe(1);
    expect(report.deadCodeFindings[0]).toContain("sample.py");
    expect(report.executionErrors).toHaveLength(0);
    expect(report.toolErrors).toHaveLength(0);
    expect(report.deadCodeFindingsStructured.length).toBeGreaterThanOrEqual(1);
    expect(report.timestamp).toBeTruthy();
    expect(report.status).toBe("findings");
    expect(report.exitCode).toBe(0);
  });

  test("runs typescript scan and parses findings with symbol names", async () => {
    const report = await runScan(new ScanRunner(), {
      ...baseOptions,
      language: "typescript"
    });

    expect(report.language).toBe("typescript");
    expect(report.lintIssueCount).toBe(0);
    expect(report.deadCodeFindingCount).toBe(2);
    expect(report.deadCodeFindings).toEqual(["src/a.ts [exports:unusedExport]", "src/b.ts [files:src/b.ts]"]);
    expect(report.deadCodeFindingsStructured.length).toBeGreaterThanOrEqual(2);
    expect(report.executionErrors).toHaveLength(0);
    expect(report.toolErrors).toHaveLength(0);
  });

  test("caps reported findings with max-findings", async () => {
    const report = await runScan(new ScanRunner(), {
      ...baseOptions,
      language: "typescript",
      maxFindings: 1
    });

    expect(report.deadCodeFindingCount).toBe(2);
    expect(report.displayedDeadCodeFindingCount).toBe(1);
    expect(report.findingsTruncated).toBe(true);
    expect(report.deadCodeFindings).toHaveLength(1);
  });

  test("polyglot scan runs both languages", async () => {
    const report = await runScan(new ScanRunner(), {
      ...baseOptions,
      language: "all",
      fix: false
    });

    expect(report.language).toEqual(["python", "typescript"]);
    expect(report.deadCodeFindingCount).toBeGreaterThanOrEqual(3);
    expect(report.lintTool).toContain("+");
  });

  test("strict mode sets exit code to 1 on findings", async () => {
    const report = await runScan(new ScanRunner(), {
      ...baseOptions,
      language: "python",
      strict: true,
      fix: false
    });

    expect(report.exitCode).toBe(1);
    expect(report.status).toBe("findings");
  });

  test("tool versions are included", async () => {
    const report = await runScan(new ScanRunner(), {
      ...baseOptions,
      language: "python",
      fix: false
    });

    expect(report.toolVersions).toBeDefined();
    expect(report.toolVersions.ruff).toBeTruthy();
  });
});
