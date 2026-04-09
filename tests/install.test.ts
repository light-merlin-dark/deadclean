import { describe, expect, test } from "bun:test";
import { ensureToolsInstalled, installCandidates } from "../src/install";
import type { CommandResult, CommandRunner, ToolBinaries } from "../src/types";

const binaries: ToolBinaries = {
  ruffBinary: "ruff",
  vultureBinary: "vulture",
  biomeBinary: "biome",
  knipBinary: "knip"
};

class InstallRunner implements CommandRunner {
  private pythonInstalled = false;
  private typescriptInstalled = false;

  async run(command: string, args: string[]): Promise<CommandResult> {
    const full = `${command} ${args.join(" ")}`.trim();

    if (full === "ruff --version" || full === "vulture --version") {
      return this.command(full, this.pythonInstalled ? 0 : 1, this.pythonInstalled ? "ok" : "missing");
    }

    if (full === "biome --version" || full === "knip --version") {
      return this.command(full, this.typescriptInstalled ? 0 : 1, this.typescriptInstalled ? "ok" : "missing");
    }

    if (full === "which ruff") {
      return this.command(full, this.pythonInstalled ? 0 : 1, this.pythonInstalled ? "/usr/local/bin/ruff" : "");
    }

    if (full === "which vulture") {
      return this.command(full, this.pythonInstalled ? 0 : 1, this.pythonInstalled ? "/usr/local/bin/vulture" : "");
    }

    if (full === "which biome") {
      return this.command(full, this.typescriptInstalled ? 0 : 1, this.typescriptInstalled ? "/usr/local/bin/biome" : "");
    }

    if (full === "which knip") {
      return this.command(full, this.typescriptInstalled ? 0 : 1, this.typescriptInstalled ? "/usr/local/bin/knip" : "");
    }

    if (full === "uv --version" || full === "pipx --version") {
      return this.command(full, 1, "missing");
    }

    if (full === "python3 --version") {
      return this.command(full, 0, "Python 3.12");
    }

    if (full.startsWith("python3 -m pip install --user --upgrade ruff vulture")) {
      this.pythonInstalled = true;
      return this.command(full, 0, "installed");
    }

    if (full === "npm --version") {
      return this.command(full, 0, "10.0.0");
    }

    if (full === "npm install -g @biomejs/biome knip") {
      this.typescriptInstalled = true;
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
    expect(installCandidates("npm")).toEqual([]);
  });

  test("python auto installation falls back to pip", async () => {
    const runner = new InstallRunner();
    const report = await ensureToolsInstalled(runner, "python", "auto", binaries);

    expect(report.success).toBe(true);
    expect(report.methodUsed).toBe("pip");
  });

  test("typescript installation uses npm", async () => {
    const runner = new InstallRunner();
    const report = await ensureToolsInstalled(runner, "typescript", "auto", binaries);

    expect(report.success).toBe(true);
    expect(report.methodUsed).toBe("npm");
  });
});
