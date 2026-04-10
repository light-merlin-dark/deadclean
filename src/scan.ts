import { resolve, join } from "node:path";
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { ensureToolsInstalled, inspectLanguageTools } from "./install";
import { detectProjectLanguage } from "./language";
import {
  parseBiomeFixedCount,
  parseBiomeIssueCount,
  parseKnipResult,
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

function ensureMaxFindings(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("--max-findings must be a positive integer");
  }

  return value;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function selectTypeScriptLintTargets(root: string): Promise<string[]> {
  const candidates = ["src", "src-tanstack", "app", "lib", "server", "client"].map((folder) => join(root, folder));
  const targets: string[] = [];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      targets.push(candidate);
    }
  }
  return targets.length > 0 ? targets : [root];
}

async function ensureValidScanPath(path: string): Promise<void> {
  let fileStats;
  try {
    fileStats = await stat(path);
  } catch {
    throw new Error(`Scan path does not exist: ${path}`);
  }

  if (!fileStats.isDirectory() && !fileStats.isFile()) {
    throw new Error(`Scan path is not a file or directory: ${path}`);
  }
}

async function readVultureExcludePatterns(root: string): Promise<string[]> {
  const ignorePath = join(root, ".vulture_ignore");
  try {
    const raw = await readFile(ignorePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.startsWith("#"));
  } catch {
    return [];
  }
}

function classifyToolResult(label: string, result: CommandResult): { toolErrors: string[]; executionErrors: string[] } {
  const toolErrors: string[] = [];
  const executionErrors: string[] = [];
  const output = displayOutput(result);

  if (result.notFound) {
    toolErrors.push(`${label}: command not found`);
    return { toolErrors, executionErrors };
  }

  if (result.exitCode > 1) {
    executionErrors.push(`${label}: exit ${result.exitCode}${output ? ` | ${output}` : ""}`);
  }

  return { toolErrors, executionErrors };
}

function applyFindingsCap(findings: string[], maxFindings: number | null): {
  findings: string[];
  total: number;
  truncated: boolean;
} {
  if (maxFindings === null) {
    return {
      findings,
      total: findings.length,
      truncated: false
    };
  }

  if (findings.length <= maxFindings) {
    return {
      findings,
      total: findings.length,
      truncated: false
    };
  }

  return {
    findings: findings.slice(0, maxFindings),
    total: findings.length,
    truncated: true
  };
}

export async function runScan(runner: CommandRunner, options: ScanOptions): Promise<ScanReport> {
  const started = Date.now();
  const minConfidence = ensureConfidence(options.minConfidence);
  const maxFindings = ensureMaxFindings(options.maxFindings);
  const absolutePath = resolve(options.path);
  await ensureValidScanPath(absolutePath);
  const absolutePathStats = await stat(absolutePath);
  const language = await detectProjectLanguage(absolutePath, options.language);
  if (language === "typescript" && !absolutePathStats.isDirectory()) {
    throw new Error(`TypeScript scans require a project directory path: ${absolutePath}`);
  }
  const typeScriptLintTargets =
    language === "typescript" ? await selectTypeScriptLintTargets(absolutePath) : [absolutePath];

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
  const toolErrors: string[] = [];
  const executionErrors: string[] = [];

  if (options.fix) {
    if (language === "python") {
      fixResult = await runner.run(options.ruffBinary, ["check", absolutePath, "--fix", "--output-format", "full"]);
      const fixFailures = classifyToolResult("ruff --fix", fixResult);
      toolErrors.push(...fixFailures.toolErrors);
      executionErrors.push(...fixFailures.executionErrors);
    } else {
      fixResult = await runner.run(options.biomeBinary, ["lint", "--write", ...options.biomeArgs, ...typeScriptLintTargets]);
      if (fixResult.exitCode > 1 && /--write/i.test(displayOutput(fixResult))) {
        fixResult = await runner.run(options.biomeBinary, [
          "lint",
          "--apply",
          ...options.biomeArgs,
          ...typeScriptLintTargets
        ]);
      }
      const fixFailures = classifyToolResult("biome --write", fixResult);
      toolErrors.push(...fixFailures.toolErrors);
      executionErrors.push(...fixFailures.executionErrors);
    }
  }

  if (language === "python") {
    const vultureArgs = [absolutePath, `--min-confidence=${minConfidence}`];
    const excluded = await readVultureExcludePatterns(absolutePath);
    if (excluded.length > 0) {
      vultureArgs.push("--exclude", excluded.join(","));
    }

    [lintResult, deadCodeResult] = await Promise.all([
      runner.run(options.ruffBinary, ["check", absolutePath, "--output-format", "full"]),
      runner.run(options.vultureBinary, vultureArgs)
    ]);
  } else {
    const knipArgs = ["--reporter", "json", "--no-progress"];
    if (options.knipConfig) {
      knipArgs.push("--config", options.knipConfig);
    }
    for (const workspace of options.workspaces) {
      knipArgs.push("--workspace", workspace);
    }
    if (options.directory) {
      knipArgs.push("--directory", options.directory);
    }
    knipArgs.push(...options.knipArgs);

    [lintResult, deadCodeResult] = await Promise.all([
      runner.run(options.biomeBinary, ["lint", ...options.biomeArgs, ...typeScriptLintTargets]),
      runner.run(options.knipBinary, knipArgs, { cwd: absolutePath })
    ]);
  }

  const lintFailures = classifyToolResult(`${language === "python" ? "ruff" : "biome"} lint`, lintResult);
  const deadCodeFailures = classifyToolResult(`${language === "python" ? "vulture" : "knip"}`, deadCodeResult);
  toolErrors.push(...lintFailures.toolErrors, ...deadCodeFailures.toolErrors);
  executionErrors.push(...lintFailures.executionErrors, ...deadCodeFailures.executionErrors);

  let lintIssueCount = 0;
  let fixedCount = 0;
  let deadCodeFindingsRaw: string[] = [];

  if (language === "python") {
    const vultureFindings = parseVultureFindings(deadCodeResult);
    lintIssueCount = parseRuffIssueCount(lintResult);
    fixedCount = fixResult ? parseRuffFixedCount(fixResult) : 0;
    deadCodeFindingsRaw = vultureFindings.map((finding) => `${finding.file}:${finding.line} ${finding.message}`);
  } else {
    lintIssueCount = parseBiomeIssueCount(lintResult);
    fixedCount = fixResult ? parseBiomeFixedCount(fixResult) : 0;
    const knip = parseKnipResult(deadCodeResult);
    deadCodeFindingsRaw = knip.findings;
    if (knip.parsingErrors.length > 0) {
      executionErrors.push(...knip.parsingErrors.map((error) => `knip parsing: ${error}`));
    }
    if (knip.preludeWarnings.length > 0) {
      executionErrors.push(...knip.preludeWarnings.map((warning) => `knip prelude: ${warning}`));
    }
  }

  if (lintIssueCount === 0 && lintResult.exitCode === 1) {
    lintIssueCount = 1;
  }
  if (
    deadCodeFindingsRaw.length === 0 &&
    deadCodeResult.exitCode === 1 &&
    executionErrors.length === 0 &&
    toolErrors.length === 0
  ) {
    deadCodeFindingsRaw = ["dead-code findings reported"];
  }

  const capped = applyFindingsCap(deadCodeFindingsRaw, maxFindings);

  return {
    path: absolutePath,
    language,
    lintTool: language === "python" ? "ruff" : "biome",
    deadCodeTool: language === "python" ? "vulture" : "knip",
    options: {
      ...options,
      minConfidence,
      maxFindings
    },
    install,
    fixResult,
    lintResult,
    deadCodeResult,
    lintIssueCount,
    fixedCount,
    deadCodeFindingCount: capped.total,
    displayedDeadCodeFindingCount: capped.findings.length,
    findingsTruncated: capped.truncated,
    deadCodeFindings: capped.findings,
    toolErrors,
    executionErrors,
    elapsedMs: Date.now() - started
  };
}
