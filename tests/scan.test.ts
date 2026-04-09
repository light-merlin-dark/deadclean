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
      return this.make(full, 0, "ok");
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

    if (full.includes("ruff check") && full.includes("--fix")) {
      return this.make(full, 0, "Found 1 error (1 fixed, 0 remaining).");
    }

    if (full.includes("ruff check") && !full.includes("--fix")) {
      return this.make(full, 0, "All checks passed!");
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

    if (full === "knip") {
      return this.make(full, 1, "src/a.ts: unused export\nsrc/b.ts: unused file");
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
  minConfidence: 100,
  ensureTools: false,
  installMethod: "auto",
  output: "text",
  strict: false,
  strictLint: false,
  verbose: false,
  ruffBinary: "ruff",
  vultureBinary: "vulture",
  biomeBinary: "biome",
  knipBinary: "knip"
};

describe("scan", () => {
  test("runs python scan and parses findings", async () => {
    const report = await runScan(new ScanRunner(), {
      ...baseOptions,
      language: "python"
    });

    expect(report.language).toBe("python");
    expect(report.fixedCount).toBe(1);
    expect(report.lintIssueCount).toBe(0);
    expect(report.deadCodeFindingCount).toBe(1);
    expect(report.deadCodeFindings[0]).toContain("sample.py");
  });

  test("runs typescript scan and parses findings", async () => {
    const report = await runScan(new ScanRunner(), {
      ...baseOptions,
      language: "typescript"
    });

    expect(report.language).toBe("typescript");
    expect(report.fixedCount).toBe(2);
    expect(report.lintIssueCount).toBe(0);
    expect(report.deadCodeFindingCount).toBe(2);
  });
});
