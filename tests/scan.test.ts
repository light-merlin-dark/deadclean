import { describe, expect, test } from "bun:test";
import { runScan } from "../src/scan";
import type { CommandResult, CommandRunner, ScanOptions } from "../src/types";

class ScanRunner implements CommandRunner {
  async run(command: string, args: string[]): Promise<CommandResult> {
    const full = `${command} ${args.join(" ")}`.trim();

    if (full === "ruff --version" || full === "vulture --version") {
      return this.make(full, 0, "ok");
    }

    if (full === "which ruff") {
      return this.make(full, 0, "/usr/local/bin/ruff");
    }

    if (full === "which vulture") {
      return this.make(full, 0, "/usr/local/bin/vulture");
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

const options: ScanOptions = {
  path: ".",
  fix: true,
  minConfidence: 100,
  ensureTools: false,
  installMethod: "auto",
  output: "text",
  strict: false,
  verbose: false,
  ruffBinary: "ruff",
  vultureBinary: "vulture"
};

describe("scan", () => {
  test("runs scan and parses findings", async () => {
    const report = await runScan(new ScanRunner(), options);

    expect(report.ruffFixedCount).toBe(1);
    expect(report.ruffIssueCount).toBe(0);
    expect(report.vultureFindingCount).toBe(1);
    expect(report.vultureFindings[0]?.file).toBe("sample.py");
  });
});
