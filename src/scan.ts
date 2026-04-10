import { resolve, join } from "node:path";
import { access, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { ensureToolsInstalled, inspectLanguageTools, inspectTool } from "./install";
import { detectProjectLanguage } from "./language";
import {
  parseBiomeFixedCount,
  parseBiomeIssueCount,
  parseBiomeStructured,
  parseKnipResult,
  parseRuffFixedCount,
  parseRuffIssueCount,
  parseRuffStructured,
  parseVultureFindings,
  parseVultureStructured
} from "./parsers";
import { displayOutput } from "./process";
import type {
  CommandResult,
  CommandRunner,
  DeadcleanConfig,
  InstallReport,
  ProjectLanguage,
  ScanOptions,
  ScanReport,
  StructuredFinding,
  ToolBinaries
} from "./types";

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
  let fileStats: import("node:fs").Stats | null = null;
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

export async function loadConfig(root: string): Promise<DeadcleanConfig> {
  const candidates = [join(root, ".deadclean.json"), join(root, "deadclean.json")];
  for (const configPath of candidates) {
    try {
      const raw = await readFile(configPath, "utf8");
      return JSON.parse(raw) as DeadcleanConfig;
    } catch {
      continue;
    }
  }
  return {};
}

export function mergeConfigWithDefaults(options: ScanOptions, config: DeadcleanConfig): ScanOptions {
  return {
    ...options,
    language: config.language ?? options.language,
    minConfidence: config.minConfidence ?? options.minConfidence,
    maxFindings: config.maxFindings ?? options.maxFindings,
    fix: config.fix ?? options.fix,
    fixRounds: config.fixRounds ?? options.fixRounds,
    strict: config.strict ?? options.strict,
    strictLint: config.strictLint ?? options.strictLint,
    output: config.output ?? options.output,
    exclude: config.exclude ?? options.exclude,
    knipConfig: config.knipConfig ?? options.knipConfig,
    workspaces: config.workspaces ?? options.workspaces,
    directory: config.directory ?? options.directory,
    diffBase: config.diffBase ?? options.diffBase
  };
}

function classifyToolResult(label: string, result: CommandResult): { toolErrors: string[]; executionErrors: string[] } {
  const toolErrors: string[] = [];
  const executionErrors: string[] = [];
  const output = displayOutput(result);

  if (result.notFound) {
    toolErrors.push(`${label}: command not found`);
    return { toolErrors, executionErrors };
  }

  if (result.timedOut) {
    executionErrors.push(`${label}: timed out`);
    return { toolErrors, executionErrors };
  }

  if (result.exitCode > 1) {
    executionErrors.push(`${label}: exit ${result.exitCode}${output ? ` | ${output}` : ""}`);
  }

  return { toolErrors, executionErrors };
}

function applyFindingsCap(findings: string[], structured: StructuredFinding[], maxFindings: number | null): {
  findings: string[];
  structured: StructuredFinding[];
  total: number;
  truncated: boolean;
} {
  if (maxFindings === null || findings.length <= maxFindings) {
    return {
      findings,
      structured,
      total: findings.length,
      truncated: false
    };
  }

  return {
    findings: findings.slice(0, maxFindings),
    structured: structured.slice(0, maxFindings),
    total: findings.length,
    truncated: true
  };
}

async function getChangedFiles(root: string, diffBase: string | null, staged: boolean, runner: CommandRunner): Promise<string[] | null> {
  if (!diffBase && !staged) return null;

  let args: string[];
  if (staged) {
    args = ["diff", "--cached", "--name-only", "--diff-filter=ACM"];
  } else if (diffBase) {
    args = ["diff", diffBase, "--name-only", "--diff-filter=ACM"];
  } else {
    return null;
  }

  const result = await runner.run("git", args, { cwd: root });
  if (result.exitCode !== 0) return null;

  return result.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

async function getToolVersions(runner: CommandRunner, binaries: ToolBinaries): Promise<Record<string, string | null>> {
  const [ruff, vulture, biome, knip] = await Promise.all([
    inspectTool(runner, binaries.ruffBinary),
    inspectTool(runner, binaries.vultureBinary),
    inspectTool(runner, binaries.biomeBinary),
    inspectTool(runner, binaries.knipBinary)
  ]);
  return {
    ruff: ruff.version,
    vulture: vulture.version,
    biome: biome.version,
    knip: knip.version
  };
}

interface SingleLanguageScanResult {
  language: ProjectLanguage;
  lintTool: string;
  deadCodeTool: string;
  lintResult: CommandResult;
  deadCodeResult: CommandResult;
  fixResult: CommandResult | null;
  install: InstallReport | null;
  lintIssueCount: number;
  fixedCount: number;
  deadCodeFindings: string[];
  deadCodeFindingsStructured: StructuredFinding[];
  toolErrors: string[];
  executionErrors: string[];
  filesScanned: number | null;
}

async function runSingleLanguageScan(
  runner: CommandRunner,
  language: ProjectLanguage,
  absolutePath: string,
  options: ScanOptions,
  changedFiles: string[] | null
): Promise<SingleLanguageScanResult> {
  const minConfidence = ensureConfidence(options.minConfidence);
  const absolutePathStats = await stat(absolutePath);
  const typeScriptLintTargets =
    language === "typescript" ? await selectTypeScriptLintTargets(absolutePath) : [absolutePath];

  if (language === "typescript" && !absolutePathStats.isDirectory()) {
    throw new Error(`TypeScript scans require a project directory path: ${absolutePath}`);
  }

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
        `Missing required tools: ${missing.join(", ")}. Run 'deadclean install-tools --language ${language} --method auto' or rerun with --ensure-tools.`
      );
    }
  }

  let fixResult: CommandResult | null = null;
  let lintResult: CommandResult;
  let deadCodeResult: CommandResult;
  const toolErrors: string[] = [];
  const executionErrors: string[] = [];

  const excludeArgs = options.exclude.length > 0 ? ["--exclude", options.exclude.join(",")] : [];

  const fixRounds = options.fixRounds > 0 ? options.fixRounds : 1;

  if (options.fix) {
    for (let round = 0; round < fixRounds; round++) {
      if (language === "python") {
        fixResult = await runner.run(options.ruffBinary, [
          "check", absolutePath, "--fix", "--output-format", "json", ...options.ruffArgs, ...excludeArgs
        ]);
      } else {
        fixResult = await runner.run(options.biomeBinary, [
          "lint", "--write", ...options.biomeArgs, ...excludeArgs, ...typeScriptLintTargets
        ]);
        if (fixResult.exitCode > 1 && /--write/i.test(displayOutput(fixResult))) {
          fixResult = await runner.run(options.biomeBinary, [
            "lint", "--apply", ...options.biomeArgs, ...excludeArgs, ...typeScriptLintTargets
          ]);
        }
      }

      const fixFailures = classifyToolResult(`${language === "python" ? "ruff" : "biome"} --fix`, fixResult);
      toolErrors.push(...fixFailures.toolErrors);
      executionErrors.push(...fixFailures.executionErrors);

      if (fixResult.exitCode === 0 || fixFailures.toolErrors.length > 0) break;
    }
  }

  if (language === "python") {
    const vultureArgs = [absolutePath, `--min-confidence=${minConfidence}`, ...options.vultureArgs, ...excludeArgs];
    const excluded = await readVultureExcludePatterns(absolutePath);
    if (excluded.length > 0) {
      vultureArgs.push("--exclude", excluded.join(","));
    }

    const scanPath = changedFiles && changedFiles.length > 0
      ? changedFiles.filter((f) => f.endsWith(".py")).map((f) => join(absolutePath, f))
      : [absolutePath];

    if (scanPath.length === 0) {
      [lintResult, deadCodeResult] = await Promise.all([
        runner.run(options.ruffBinary, ["check", absolutePath, "--output-format", "json", ...options.ruffArgs, ...excludeArgs]),
        runner.run(options.vultureBinary, vultureArgs)
      ]);
    } else {
      [lintResult, deadCodeResult] = await Promise.all([
        runner.run(options.ruffBinary, ["check", ...scanPath, "--output-format", "json", ...options.ruffArgs, ...excludeArgs]),
        runner.run(options.vultureBinary, [...scanPath, `--min-confidence=${minConfidence}`, ...options.vultureArgs, ...excludeArgs])
      ]);
    }
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
      runner.run(options.biomeBinary, ["lint", ...options.biomeArgs, ...excludeArgs, ...typeScriptLintTargets]),
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
  let deadCodeFindingsStructuredRaw: StructuredFinding[] = [];
  let filesScanned: number | null = null;

  if (language === "python") {
    const vultureFindings = parseVultureFindings(deadCodeResult);
    lintIssueCount = parseRuffIssueCount(lintResult);
    fixedCount = fixResult ? parseRuffFixedCount(fixResult) : 0;
    deadCodeFindingsRaw = vultureFindings.map((finding) => `${finding.file}:${finding.line} ${finding.message}`);
    deadCodeFindingsStructuredRaw = parseVultureStructured(deadCodeResult);
    deadCodeFindingsStructuredRaw.push(...parseRuffStructured(lintResult));
  } else {
    lintIssueCount = parseBiomeIssueCount(lintResult);
    fixedCount = fixResult ? parseBiomeFixedCount(fixResult) : 0;
    const knip = parseKnipResult(deadCodeResult);
    deadCodeFindingsRaw = knip.findings;
    deadCodeFindingsStructuredRaw = knip.findingsStructured;
    deadCodeFindingsStructuredRaw.push(...parseBiomeStructured(lintResult));
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

  return {
    language,
    lintTool: language === "python" ? "ruff" : "biome",
    deadCodeTool: language === "python" ? "vulture" : "knip",
    lintResult,
    deadCodeResult,
    fixResult,
    install,
    lintIssueCount,
    fixedCount,
    deadCodeFindings: deadCodeFindingsRaw,
    deadCodeFindingsStructured: deadCodeFindingsStructuredRaw,
    toolErrors,
    executionErrors,
    filesScanned
  };
}

export async function runScan(runner: CommandRunner, options: ScanOptions): Promise<ScanReport> {
  const started = Date.now();
  const maxFindings = ensureMaxFindings(options.maxFindings);
  const absolutePath = resolve(options.path);
  await ensureValidScanPath(absolutePath);

  let languages: ProjectLanguage[];
  if (options.language === "all") {
    languages = ["python", "typescript"];
  } else {
    languages = [await detectProjectLanguage(absolutePath, options.language === "auto" ? "auto" : options.language)];
  }

  const changedFiles = await getChangedFiles(absolutePath, options.diffBase, options.staged, runner);
  const toolVersions = await getToolVersions(runner, options);

  let allFindings: string[] = [];
  let allStructured: StructuredFinding[] = [];
  let allToolErrors: string[] = [];
  let allExecutionErrors: string[] = [];
  let totalLintIssues = 0;
  let totalFixed = 0;
  let primaryLintTool = "";
  let primaryDeadCodeTool = "";
  let primaryLintResult: CommandResult | null = null;
  let primaryDeadCodeResult: CommandResult | null = null;
  let primaryFixResult: CommandResult | null = null;
  let primaryInstall: InstallReport | null = null;
  let totalFilesScanned: number | null = null;
  let resolvedLanguages: ProjectLanguage[] = [];

  for (const lang of languages) {
    const result = await runSingleLanguageScan(runner, lang, absolutePath, options, changedFiles);
    resolvedLanguages.push(result.language);
    allFindings.push(...result.deadCodeFindings);
    allStructured.push(...result.deadCodeFindingsStructured);
    allToolErrors.push(...result.toolErrors);
    allExecutionErrors.push(...result.executionErrors);
    totalLintIssues += result.lintIssueCount;
    totalFixed += result.fixedCount;

    if (!primaryLintTool) {
      primaryLintTool = result.lintTool;
      primaryDeadCodeTool = result.deadCodeTool;
      primaryLintResult = result.lintResult;
      primaryDeadCodeResult = result.deadCodeResult;
      primaryFixResult = result.fixResult;
      primaryInstall = result.install;
    } else {
      primaryLintTool += ` + ${result.lintTool}`;
      primaryDeadCodeTool += ` + ${result.deadCodeTool}`;
    }
  }

  const capped = applyFindingsCap(allFindings, allStructured, maxFindings);

  const hasOperationalErrors = allToolErrors.length > 0 || allExecutionErrors.length > 0;
  let exitCode = 0;
  let status = "clean";

  if (hasOperationalErrors) {
    exitCode = 2;
    status = "error";
  } else if (capped.total > 0) {
    status = "findings";
    if (options.strict) {
      exitCode = 1;
    }
  }

  if (exitCode === 0 && options.strictLint && totalLintIssues > 0) {
    exitCode = 1;
    status = "findings";
  }

  const uniqueFilesWithIssues = new Set(capped.structured.map((f) => f.file));

  const report: ScanReport = {
    path: absolutePath,
    language: resolvedLanguages.length === 1 ? resolvedLanguages[0] : resolvedLanguages,
    lintTool: primaryLintTool,
    deadCodeTool: primaryDeadCodeTool,
    options: {
      ...options,
      maxFindings
    },
    install: primaryInstall,
    fixResult: primaryFixResult,
    lintResult: primaryLintResult!,
    deadCodeResult: primaryDeadCodeResult!,
    lintIssueCount: totalLintIssues,
    fixedCount: totalFixed,
    deadCodeFindingCount: capped.total,
    displayedDeadCodeFindingCount: capped.findings.length,
    findingsTruncated: capped.truncated,
    deadCodeFindings: capped.findings,
    deadCodeFindingsStructured: capped.structured,
    toolErrors: allToolErrors,
    executionErrors: allExecutionErrors,
    elapsedMs: Date.now() - started,
    timestamp: new Date().toISOString(),
    toolVersions,
    filesScanned: totalFilesScanned,
    filesWithIssues: uniqueFilesWithIssues.size,
    exitCode,
    status
  };

  return report;
}
