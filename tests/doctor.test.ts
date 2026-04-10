import { describe, expect, test } from "bun:test";
import { buildDoctorReport } from "../src/doctor";
import type { CommandResult, CommandRunner, ToolBinaries } from "../src/types";

class DoctorRunner implements CommandRunner {
  async run(command: string, args: string[]): Promise<CommandResult> {
    const full = `${command} ${args.join(" ")}`.trim();

    if (full === "ruff --version") return this.ok("ruff 1.0.0");
    if (full === "vulture --version") return this.ok("vulture 2.0");
    if (full === "biome --version") return this.fail("biome not found");
    if (full === "knip --version") return this.fail("knip not found");
    if (full === "bun --version") return this.ok("bun 1.2.0");

    if (full === "which ruff") return this.ok("/usr/bin/ruff");
    if (full === "which vulture") return this.ok("/usr/bin/vulture");
    if (full === "which biome") return this.fail("");
    if (full === "which knip") return this.fail("");

    return this.fail("unexpected");
  }

  private ok(stdout: string): CommandResult {
    return { command: "test", args: [], exitCode: 0, stdout, stderr: "", durationMs: 1, notFound: false };
  }

  private fail(stderr: string): CommandResult {
    return { command: "test", args: [], exitCode: 1, stdout: "", stderr, durationMs: 1, notFound: true };
  }
}

const binaries: ToolBinaries = {
  ruffBinary: "ruff",
  vultureBinary: "vulture",
  biomeBinary: "biome",
  knipBinary: "knip"
};

describe("doctor", () => {
  test("reports readiness correctly", async () => {
    const runner = new DoctorRunner();
    const report = await buildDoctorReport(runner, binaries);

    expect(report.ready).toBe(false);
    expect(report.readyFor.python).toBe(true);
    expect(report.readyFor.typescript).toBe(false);
    expect(report.missingTools).toContain("biome");
    expect(report.missingTools).toContain("knip");
    expect(report.tools).toHaveLength(4);
    expect(report.bunVersion).toBe("bun 1.2.0");
  });
});
