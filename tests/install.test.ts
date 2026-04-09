import { describe, expect, test } from "bun:test";
import { ensureToolsInstalled, installCandidates } from "../src/install";
import type { CommandResult, CommandRunner } from "../src/types";

class InstallRunner implements CommandRunner {
  private installed = false;

  async run(command: string, args: string[]): Promise<CommandResult> {
    const full = `${command} ${args.join(" ")}`.trim();

    if (full === "ruff --version" || full === "vulture --version") {
      return this.command(full, this.installed ? 0 : 1, this.installed ? "ok" : "missing");
    }

    if (full === "which ruff") {
      return this.command(full, this.installed ? 0 : 1, this.installed ? "/usr/local/bin/ruff" : "");
    }

    if (full === "which vulture") {
      return this.command(full, this.installed ? 0 : 1, this.installed ? "/usr/local/bin/vulture" : "");
    }

    if (full === "uv --version" || full === "pipx --version") {
      return this.command(full, 1, "missing");
    }

    if (full === "python3 --version") {
      return this.command(full, 0, "Python 3.12");
    }

    if (full.startsWith("python3 -m pip install --user --upgrade ruff vulture")) {
      this.installed = true;
      return this.command(full, 0, "installed");
    }

    return this.command(full, 1, "unexpected command");
  }

  private command(command: string, exitCode: number, stdout: string): CommandResult {
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

describe("install", () => {
  test("auto install candidate order", () => {
    expect(installCandidates("auto")).toEqual(["uv", "pipx", "pip"]);
    expect(installCandidates("pipx")).toEqual(["pipx"]);
  });

  test("auto installation falls back to pip", async () => {
    const runner = new InstallRunner();
    const report = await ensureToolsInstalled(runner, "auto", "ruff", "vulture");

    expect(report.success).toBe(true);
    expect(report.methodUsed).toBe("pip");
  });
});
