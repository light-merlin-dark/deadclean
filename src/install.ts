import { platform } from "node:os";
import { displayOutput } from "./process";
import type {
  CommandResult,
  CommandRunner,
  InstallAttempt,
  InstallMethod,
  InstallReport,
  ProjectLanguage,
  ToolBinaries,
  ToolStatus
} from "./types";

const PYTHON_INSTALL_ORDER: InstallMethod[] = ["uv", "pipx", "pip"];

function parseVersion(output: string): string | null {
  const trimmed = output.trim();
  if (!trimmed) {
    return null;
  }
  const firstLine = trimmed.split(/\r?\n/, 1)[0];
  return firstLine || null;
}

async function findBinaryPath(runner: CommandRunner, binary: string): Promise<string | null> {
  const locator = platform() === "win32" ? "where" : "which";
  const result = await runner.run(locator, [binary]);
  if (result.exitCode !== 0) {
    return null;
  }

  const firstLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? null;
}

export async function inspectTool(runner: CommandRunner, binary: string): Promise<ToolStatus> {
  const versionResult = await runner.run(binary, ["--version"]);
  const installed = versionResult.exitCode === 0;

  return {
    name: binary,
    installed,
    version: installed ? parseVersion(displayOutput(versionResult)) : null,
    path: installed ? await findBinaryPath(runner, binary) : null
  };
}

export async function inspectLanguageTools(
  runner: CommandRunner,
  language: ProjectLanguage,
  binaries: ToolBinaries
): Promise<ToolStatus[]> {
  if (language === "python") {
    const [ruff, vulture] = await Promise.all([
      inspectTool(runner, binaries.ruffBinary),
      inspectTool(runner, binaries.vultureBinary)
    ]);
    return [ruff, vulture];
  }

  const [biome, knip] = await Promise.all([
    inspectTool(runner, binaries.biomeBinary),
    inspectTool(runner, binaries.knipBinary)
  ]);
  return [biome, knip];
}

export async function inspectAllTools(runner: CommandRunner, binaries: ToolBinaries): Promise<ToolStatus[]> {
  const [ruff, vulture, biome, knip] = await Promise.all([
    inspectTool(runner, binaries.ruffBinary),
    inspectTool(runner, binaries.vultureBinary),
    inspectTool(runner, binaries.biomeBinary),
    inspectTool(runner, binaries.knipBinary)
  ]);

  return [ruff, vulture, biome, knip];
}

function isSuccess(result: CommandResult): boolean {
  return result.exitCode === 0;
}

async function installWithUv(runner: CommandRunner): Promise<InstallAttempt> {
  const uvCheck = await runner.run("uv", ["--version"]);
  if (!isSuccess(uvCheck)) {
    return {
      method: "uv",
      success: false,
      details: "uv is not installed"
    };
  }

  const ruffInstall = await runner.run("uv", ["tool", "install", "--upgrade", "ruff"]);
  const vultureInstall = await runner.run("uv", ["tool", "install", "--upgrade", "vulture"]);
  const success = isSuccess(ruffInstall) && isSuccess(vultureInstall);

  return {
    method: "uv",
    success,
    details: success
      ? "Installed Ruff and Vulture using uv tool"
      : [displayOutput(ruffInstall), displayOutput(vultureInstall)].filter(Boolean).join("\n")
  };
}

async function pipxInstallOrUpgrade(runner: CommandRunner, tool: string): Promise<CommandResult> {
  const installResult = await runner.run("pipx", ["install", tool]);
  if (isSuccess(installResult)) {
    return installResult;
  }

  const upgradeResult = await runner.run("pipx", ["upgrade", tool]);
  return upgradeResult;
}

async function installWithPipx(runner: CommandRunner): Promise<InstallAttempt> {
  const pipxCheck = await runner.run("pipx", ["--version"]);
  if (!isSuccess(pipxCheck)) {
    return {
      method: "pipx",
      success: false,
      details: "pipx is not installed"
    };
  }

  const ruffResult = await pipxInstallOrUpgrade(runner, "ruff");
  const vultureResult = await pipxInstallOrUpgrade(runner, "vulture");
  const success = isSuccess(ruffResult) && isSuccess(vultureResult);

  return {
    method: "pipx",
    success,
    details: success
      ? "Installed Ruff and Vulture using pipx"
      : [displayOutput(ruffResult), displayOutput(vultureResult)].filter(Boolean).join("\n")
  };
}

async function pickPython(runner: CommandRunner): Promise<string | null> {
  const candidates = ["python3", "python"];

  for (const candidate of candidates) {
    const result = await runner.run(candidate, ["--version"]);
    if (result.exitCode === 0) {
      return candidate;
    }
  }

  return null;
}

async function installWithPip(runner: CommandRunner): Promise<InstallAttempt> {
  const python = await pickPython(runner);
  if (!python) {
    return {
      method: "pip",
      success: false,
      details: "python3/python is not available"
    };
  }

  const installResult = await runner.run(python, [
    "-m",
    "pip",
    "install",
    "--user",
    "--upgrade",
    "ruff",
    "vulture"
  ]);

  return {
    method: "pip",
    success: installResult.exitCode === 0,
    details:
      installResult.exitCode === 0
        ? `Installed Ruff and Vulture using ${python} -m pip`
        : displayOutput(installResult)
  };
}

export function installCandidates(method: InstallMethod): InstallMethod[] {
  if (method === "auto") {
    return PYTHON_INSTALL_ORDER;
  }
  if (method === "uv" || method === "pipx" || method === "pip") {
    return [method];
  }
  return [];
}

async function ensurePythonToolsInstalled(
  runner: CommandRunner,
  method: InstallMethod,
  binaries: ToolBinaries
): Promise<InstallReport> {
  const current = await inspectLanguageTools(runner, "python", binaries);
  if (current.every((tool) => tool.installed)) {
    return {
      language: "python",
      success: true,
      methodRequested: method,
      methodUsed: null,
      attempts: [
        {
          method,
          success: true,
          details: "Ruff and Vulture are already installed"
        }
      ]
    };
  }

  const attempts: InstallAttempt[] = [];
  const candidates = installCandidates(method);

  if (candidates.length === 0) {
    return {
      language: "python",
      success: false,
      methodRequested: method,
      methodUsed: null,
      attempts: [
        {
          method,
          success: false,
          details: "Invalid Python install method. Use auto, uv, pipx, or pip."
        }
      ]
    };
  }

  for (const candidate of candidates) {
    let attempt: InstallAttempt;

    if (candidate === "uv") {
      attempt = await installWithUv(runner);
    } else if (candidate === "pipx") {
      attempt = await installWithPipx(runner);
    } else {
      attempt = await installWithPip(runner);
    }

    attempts.push(attempt);

    if (attempt.success) {
      const postCheck = await inspectLanguageTools(runner, "python", binaries);
      if (postCheck.every((tool) => tool.installed)) {
        return {
          language: "python",
          success: true,
          methodRequested: method,
          methodUsed: candidate,
          attempts
        };
      }

      attempts.push({
        method: candidate,
        success: false,
        details: "Install command succeeded but tools are still unavailable in PATH"
      });
    }
  }

  return {
    language: "python",
    success: false,
    methodRequested: method,
    methodUsed: null,
    attempts
  };
}

async function tryNpxInstall(runner: CommandRunner, packages: string[]): Promise<InstallAttempt> {
  const npxCheck = await runner.run("npx", ["--version"]);
  if (!isSuccess(npxCheck)) {
    return { method: "npm", success: false, details: "npx is not available" };
  }

  const result = await runner.run("npm", ["install", "-g", ...packages]);
  return {
    method: "npm",
    success: isSuccess(result),
    details: isSuccess(result) ? `Installed ${packages.join(", ")} using npm` : displayOutput(result)
  };
}

async function tryBunInstall(runner: CommandRunner, packages: string[]): Promise<InstallAttempt> {
  const bunCheck = await runner.run("bun", ["--version"]);
  if (!isSuccess(bunCheck)) {
    return { method: "bun", success: false, details: "bun is not installed" };
  }

  const result = await runner.run("bun", ["install", "-g", ...packages]);
  return {
    method: "bun",
    success: isSuccess(result),
    details: isSuccess(result) ? `Installed ${packages.join(", ")} using bun` : displayOutput(result)
  };
}

async function ensureTypeScriptToolsInstalled(
  runner: CommandRunner,
  method: InstallMethod,
  binaries: ToolBinaries
): Promise<InstallReport> {
  const current = await inspectLanguageTools(runner, "typescript", binaries);
  if (current.every((tool) => tool.installed)) {
    return {
      language: "typescript",
      success: true,
      methodRequested: method,
      methodUsed: null,
      attempts: [
        {
          method,
          success: true,
          details: "Biome and Knip are already installed"
        }
      ]
    };
  }

  const packages = ["@biomejs/biome", "knip"];
  const attempts: InstallAttempt[] = [];

  if (method === "bun" || method === "auto") {
    const bunAttempt = await tryBunInstall(runner, packages);
    attempts.push(bunAttempt);
    if (bunAttempt.success) {
      const postCheck = await inspectLanguageTools(runner, "typescript", binaries);
      if (postCheck.every((tool) => tool.installed)) {
        return {
          language: "typescript",
          success: true,
          methodRequested: method,
          methodUsed: "bun",
          attempts
        };
      }
    }
  }

  if (method === "auto" || method === "npm") {
    const npmAttempt = await tryNpxInstall(runner, packages);
    attempts.push(npmAttempt);
    if (npmAttempt.success) {
      const postCheck = await inspectLanguageTools(runner, "typescript", binaries);
      if (postCheck.every((tool) => tool.installed)) {
        return {
          language: "typescript",
          success: true,
          methodRequested: method,
          methodUsed: "npm",
          attempts
        };
      }
    }
  }

  if (method !== "auto" && method !== "npm" && method !== "bun") {
    return {
      language: "typescript",
      success: false,
      methodRequested: method,
      methodUsed: null,
      attempts: [
        {
          method,
          success: false,
          details: "TypeScript tool installation supports only auto, npm, or bun."
        }
      ]
    };
  }

  return {
    language: "typescript",
    success: false,
    methodRequested: method,
    methodUsed: null,
    attempts
  };
}

export async function ensureToolsInstalled(
  runner: CommandRunner,
  language: ProjectLanguage,
  method: InstallMethod,
  binaries: ToolBinaries
): Promise<InstallReport> {
  if (language === "python") {
    return ensurePythonToolsInstalled(runner, method, binaries);
  }

  return ensureTypeScriptToolsInstalled(runner, method, binaries);
}
