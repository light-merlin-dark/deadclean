import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { ensureToolsInstalled, inspectLanguageTools } from "./install";
import { detectProjectLanguage } from "./language";
import {
  parseBiomeFixedCount,
  parseBiomeIssueCount,
  parseKnipFindings,
  parseRuffFixedCount,
  parseRuffIssueCount,
  parseVultureFindings
} from "./parsers";
import { displayOutput } from "./process";
import type { CommandResult, CommandRunner, InstallReport, ScanOptions, ScanReport } from "./types";

function ensureConfidence(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error("--min-confidence must be an integer between 0 and 100");
  }
  return value;
}

function assertToolRun(label: string, code: number, output: string): void {
  if (code <= 1) {
    return;
  }

  throw new Error(`${label} failed with exit code ${code}\n${output}`.trim());
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function selectTypeScriptLintTarget(root: string): Promise<string> {
  const candidates = ["src", "app", "lib", "server", "client"].map((folder) => `${root}/${folder}`);
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return root;
}

export async function runScan(runner: CommandRunner, options: ScanOptions): Promise<ScanReport> {
  const started = Date.now();
  const minConfidence = ensureConfidence(options.minConfidence);
  const absolutePath = resolve(options.path);
  const language = await detectProjectLanguage(absolutePath, options.language);
  const typeScriptLintTarget = language === "typescript" ? await selectTypeScriptLintTarget(absolutePath) : absolutePath;

  let install: InstallReport | null = null;

  if (options.ensureTools) {
    install = await ensureToolsInstalled(runner, language, options.installMethod, options);
    if (!install.success) {
      const reason = install.attempts.map((attempt) => `${attempt.method}: ${attempt.details}`).join("\n");
      throw new Error(`Unable to install ${language} tools.\n${reason}`.trim());
    }
  } else {
    const status = await inspectLanguageTools(runner, language, options);
    const missing = status.filter((tool) => !tool.installed).map((tool) => tool.name);
    if (missing.length > 0) {
      throw new Error(
        `Missing required tools: ${missing.join(
          ", "
        )}. Run 'deadclean install-tools --language ${language} --method auto' or rerun with --ensure-tools.`
      );
    }
  }

  let fixResult: CommandResult | null = null;
  let lintResult: CommandResult;
  let deadCodeResult: CommandResult;

  if (options.fix) {
    if (language === "python") {
      fixResult = await runner.run(options.ruffBinary, ["check", absolutePath, "--fix", "--output-format", "full"]);
      assertToolRun("ruff --fix", fixResult.exitCode, displayOutput(fixResult));
    } else {
      fixResult = await runner.run(options.biomeBinary, ["lint", "--write", typeScriptLintTarget]);
      if (fixResult.exitCode > 1 && /--write/i.test(displayOutput(fixResult))) {
        fixResult = await runner.run(options.biomeBinary, ["lint", "--apply", typeScriptLintTarget]);
      }
      assertToolRun("biome --write", fixResult.exitCode, displayOutput(fixResult));
    }
  }

  if (language === "python") {
    [lintResult, deadCodeResult] = await Promise.all([
      runner.run(options.ruffBinary, ["check", absolutePath, "--output-format", "full"]),
      runner.run(options.vultureBinary, [absolutePath, `--min-confidence=${minConfidence}`])
    ]);

    assertToolRun("ruff check", lintResult.exitCode, displayOutput(lintResult));
    assertToolRun("vulture", deadCodeResult.exitCode, displayOutput(deadCodeResult));
  } else {
    [lintResult, deadCodeResult] = await Promise.all([
      runner.run(options.biomeBinary, ["lint", typeScriptLintTarget]),
      runner.run(options.knipBinary, [], { cwd: absolutePath })
    ]);

    assertToolRun("biome lint", lintResult.exitCode, displayOutput(lintResult));
    assertToolRun("knip", deadCodeResult.exitCode, displayOutput(deadCodeResult));
  }

  let lintIssueCount = 0;
  let fixedCount = 0;
  let deadCodeFindings: string[] = [];

  if (language === "python") {
    const vultureFindings = parseVultureFindings(deadCodeResult);
    lintIssueCount = parseRuffIssueCount(lintResult);
    fixedCount = fixResult ? parseRuffFixedCount(fixResult) : 0;
    deadCodeFindings = vultureFindings.map((finding) => `${finding.file}:${finding.line} ${finding.message}`);
  } else {
    lintIssueCount = parseBiomeIssueCount(lintResult);
    fixedCount = fixResult ? parseBiomeFixedCount(fixResult) : 0;
    deadCodeFindings = parseKnipFindings(deadCodeResult);
  }

  if (lintIssueCount === 0 && lintResult.exitCode === 1) {
    lintIssueCount = 1;
  }
  if (deadCodeFindings.length === 0 && deadCodeResult.exitCode === 1) {
    deadCodeFindings = [displayOutput(deadCodeResult) || "dead-code findings reported"];
  }

  return {
    path: absolutePath,
    language,
    lintTool: language === "python" ? "ruff" : "biome",
    deadCodeTool: language === "python" ? "vulture" : "knip",
    options: {
      ...options,
      minConfidence
    },
    install,
    fixResult,
    lintResult,
    deadCodeResult,
    lintIssueCount,
    fixedCount,
    deadCodeFindingCount: deadCodeFindings.length,
    deadCodeFindings,
    elapsedMs: Date.now() - started
  };
}
