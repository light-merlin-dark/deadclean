import { readFileSync, existsSync, writeFileSync, readFile } from "node:fs";
import { resolve } from "node:path";
import { runDoctor } from "./doctor";
import { formatDoctorText, formatJson, formatScanJson, formatScanSarif, formatScanText } from "./format";
import { formatInitText, runInit } from "./init";
import { ensureToolsInstalled } from "./install";
import { detectProjectLanguage } from "./language";
import { RealCommandRunner } from "./process";
import { loadConfig, mergeConfigWithDefaults } from "./scan";
import { runScan } from "./scan";
import type {
  InstallMethod,
  LanguageMode,
  OutputMode,
  ProjectLanguage,
  ScanOptions,
  ToolBinaries
} from "./types";

const VALID_INSTALL_METHODS: InstallMethod[] = ["auto", "uv", "pipx", "pip", "npm", "bun"];
const VALID_LANGUAGES: LanguageMode[] = ["auto", "python", "typescript", "all"];
const VALID_INSTALL_LANGUAGES: Array<LanguageMode | "all"> = ["auto", "python", "typescript", "all"];

interface BaseOptions extends ToolBinaries {
  output: OutputMode;
}

interface InstallOptions extends BaseOptions {
  installMethod: InstallMethod;
  language: LanguageMode | "all";
  path: string;
}

interface InitOptions extends BaseOptions {
  language: LanguageMode | "all";
  force: boolean;
  path: string;
}

const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  path: ".",
  language: "auto",
  fix: false,
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

function packageVersion(): string {
  const packagePath = resolve(__dirname, "..", "package.json");
  const raw = readFileSync(packagePath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}

function printHelp(): void {
  process.stdout.write(`deadclean ${packageVersion()}\n\n`);
  process.stdout.write("AI-friendly dead code cleanup for Python and TypeScript projects.\n\n");
  process.stdout.write("Usage:\n");
  process.stdout.write("  deadclean [path] [options]\n");
  process.stdout.write("  deadclean scan [path] [options]\n");
  process.stdout.write("  deadclean doctor [options]\n");
  process.stdout.write("  deadclean init [path] [options]\n");
  process.stdout.write("  deadclean install-tools [path] [options]\n");
  process.stdout.write("  deadclean baseline save [path] [options]\n");
  process.stdout.write("  deadclean baseline check [path] [options]\n\n");

  process.stdout.write("Commands:\n");
  process.stdout.write("  scan           Run language-aware scan (default command)\n");
  process.stdout.write("  doctor         Show runtime and tool availability\n");
  process.stdout.write("  init           Create starter knip.json and .vulture_ignore files\n");
  process.stdout.write("  install-tools  Install required tools for Python/TypeScript\n");
  process.stdout.write("  baseline save  Record current findings as accepted baseline\n");
  process.stdout.write("  baseline check Compare current findings against baseline\n\n");

  process.stdout.write("Scan options:\n");
  process.stdout.write("  --language <mode>           auto | python | typescript | all (default: auto)\n");
  process.stdout.write("  --fix                       Apply safe auto-fixes first\n");
  process.stdout.write("  --min-confidence <0-100>    Vulture threshold (default: 80)\n");
  process.stdout.write("  --max-findings <n>          Cap findings (default: 200, 0=unlimited)\n");
  process.stdout.write("  --ensure-tools              Install missing tools before scan\n");
  process.stdout.write("  --install-method <method>   auto | uv | pipx | pip | npm | bun\n");
  process.stdout.write("  --knip-config <path>        Knip config file path\n");
  process.stdout.write("  --workspace <filter>        Knip workspace filter (repeatable)\n");
  process.stdout.write("  --directory <path>          Knip directory scope relative to project root\n");
  process.stdout.write("  --knip-arg <arg>            Extra Knip arg (repeatable)\n");
  process.stdout.write("  --biome-arg <arg>           Extra Biome lint arg (repeatable)\n");
  process.stdout.write("  --ruff-arg <arg>            Extra Ruff arg (repeatable)\n");
  process.stdout.write("  --vulture-arg <arg>         Extra Vulture arg (repeatable)\n");
  process.stdout.write("  --exclude <pattern>         File/directory exclusion pattern (repeatable)\n");
  process.stdout.write("  --output-file <path>        Write output to file\n");
  process.stdout.write("  --fix-rounds <n>            Iterative fix rounds (default: 1, 0=until convergence)\n");
  process.stdout.write("  --diff-base <ref>           Only scan files changed vs git ref\n");
  process.stdout.write("  --staged                    Only scan staged files\n");
  process.stdout.write("  --strict                    Exit non-zero if dead-code findings remain\n");
  process.stdout.write("  --strict-lint               Include lint findings in strict exit behavior\n");
  process.stdout.write("  --summary                   One-line summary output\n");
  process.stdout.write("  --quiet                     Suppress non-essential output\n");
  process.stdout.write("  --verbose                   Include raw tool output\n");
  process.stdout.write("  --ruff-bin <name>           Ruff binary (default: ruff)\n");
  process.stdout.write("  --vulture-bin <name>        Vulture binary (default: vulture)\n");
  process.stdout.write("  --biome-bin <name>          Biome binary (default: biome)\n");
  process.stdout.write("  --knip-bin <name>           Knip binary (default: knip)\n");
  process.stdout.write("  --json                      Alias for --output json\n");
  process.stdout.write("  --sarif                     Alias for --output sarif\n");
  process.stdout.write("  --output <mode>             text | json | sarif (default: text)\n\n");

  process.stdout.write("Doctor options:\n");
  process.stdout.write("  --strict                    Exit 1 if any tools missing\n\n");

  process.stdout.write("Install options:\n");
  process.stdout.write("  --language <mode>           auto | python | typescript | all\n");
  process.stdout.write("  --method <method>           auto | uv | pipx | pip | npm | bun\n");
  process.stdout.write("  --json                      Alias for --output json\n\n");

  process.stdout.write("Init options:\n");
  process.stdout.write("  --language <mode>           auto | python | typescript | all\n");
  process.stdout.write("  --force                     Overwrite existing generated files\n");
  process.stdout.write("  --json                      Alias for --output json\n\n");

  process.stdout.write("Config file:\n");
  process.stdout.write("  Supports .deadclean.json or deadclean.json in project root.\n");
  process.stdout.write("  CLI args take precedence over config file values.\n\n");

  process.stdout.write("Examples:\n");
  process.stdout.write("  deadclean . --fix\n");
  process.stdout.write("  deadclean ./apps/web --language typescript --strict\n");
  process.stdout.write("  deadclean ./apps/web --language typescript --workspace web --max-findings 50\n");
  process.stdout.write("  deadclean ./services --language python --ensure-tools\n");
  process.stdout.write("  deadclean . --language all\n");
  process.stdout.write("  deadclean . --diff-base main\n");
  process.stdout.write("  deadclean . --staged\n");
  process.stdout.write("  deadclean . --summary\n");
  process.stdout.write("  deadclean . --output sarif --output-file results.sarif\n");
  process.stdout.write("  deadclean baseline save . --language python\n");
  process.stdout.write("  deadclean baseline check . --language python\n");
  process.stdout.write("  deadclean init . --language all\n");
  process.stdout.write("  deadclean install-tools . --language all --method auto\n");
  process.stdout.write("  deadclean doctor --json\n");
  process.stdout.write("  deadclean doctor --strict\n");
}

function fail(message: string): never {
  throw new Error(message);
}

function parseInstallMethod(value: string): InstallMethod {
  if (!VALID_INSTALL_METHODS.includes(value as InstallMethod)) {
    fail(`Invalid install method '${value}'. Expected: ${VALID_INSTALL_METHODS.join(", ")}`);
  }
  return value as InstallMethod;
}

function parseLanguage(value: string): LanguageMode {
  if (!VALID_LANGUAGES.includes(value as LanguageMode)) {
    fail(`Invalid language '${value}'. Expected: ${VALID_LANGUAGES.join(", ")}`);
  }
  return value as LanguageMode;
}

function parseInstallLanguage(value: string): LanguageMode | "all" {
  if (!VALID_INSTALL_LANGUAGES.includes(value as LanguageMode | "all")) {
    fail(`Invalid language '${value}'. Expected: ${VALID_INSTALL_LANGUAGES.join(", ")}`);
  }
  return value as LanguageMode | "all";
}

function parseOutput(value: string): OutputMode {
  if (value !== "text" && value !== "json" && value !== "sarif") {
    fail(`Invalid output mode '${value}'. Expected: text | json | sarif`);
  }
  return value;
}

function consumeValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    fail(`Missing value for ${option}`);
  }
  return value;
}

function parseBaseOptions(args: string[]): BaseOptions {
  const options: BaseOptions = {
    output: "text",
    ruffBinary: "ruff",
    vultureBinary: "vulture",
    biomeBinary: "biome",
    knipBinary: "knip"
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--json") {
      options.output = "json";
      continue;
    }

    if (arg === "--sarif") {
      options.output = "sarif";
      continue;
    }

    if (arg === "--output") {
      options.output = parseOutput(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--ruff-bin") {
      options.ruffBinary = consumeValue(args, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--vulture-bin") {
      options.vultureBinary = consumeValue(args, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--biome-bin") {
      options.biomeBinary = consumeValue(args, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--knip-bin") {
      options.knipBinary = consumeValue(args, i, arg);
      i += 1;
      continue;
    }
  }

  return options;
}

function parseScanOptions(args: string[]): ScanOptions {
  const base = parseBaseOptions(args);

  const options: ScanOptions = {
    ...DEFAULT_SCAN_OPTIONS,
    ...base
  };

  let pathSeen = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--fix") {
      options.fix = true;
      continue;
    }

    if (arg === "--language") {
      options.language = parseLanguage(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--min-confidence") {
      const value = Number(consumeValue(args, i, arg));
      if (!Number.isInteger(value)) {
        fail("--min-confidence must be an integer");
      }
      options.minConfidence = value;
      i += 1;
      continue;
    }

    if (arg === "--max-findings") {
      const value = Number(consumeValue(args, i, arg));
      if (!Number.isInteger(value) || value < 0) {
        fail("--max-findings must be an integer >= 0");
      }
      options.maxFindings = value === 0 ? null : value;
      i += 1;
      continue;
    }

    if (arg === "--ensure-tools") {
      options.ensureTools = true;
      continue;
    }

    if (arg === "--install-method") {
      options.installMethod = parseInstallMethod(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--knip-config") {
      options.knipConfig = consumeValue(args, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--workspace") {
      options.workspaces.push(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--directory") {
      options.directory = consumeValue(args, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--knip-arg") {
      options.knipArgs.push(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--biome-arg") {
      options.biomeArgs.push(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--ruff-arg") {
      options.ruffArgs.push(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--vulture-arg") {
      options.vultureArgs.push(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--exclude") {
      options.exclude.push(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--output-file") {
      options.outputFile = consumeValue(args, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--fix-rounds") {
      const value = Number(consumeValue(args, i, arg));
      if (!Number.isInteger(value) || value < 0) {
        fail("--fix-rounds must be an integer >= 0");
      }
      options.fixRounds = value;
      i += 1;
      continue;
    }

    if (arg === "--diff-base") {
      options.diffBase = consumeValue(args, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--staged") {
      options.staged = true;
      continue;
    }

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--strict-lint") {
      options.strictLint = true;
      continue;
    }

    if (arg === "--summary") {
      options.summary = true;
      continue;
    }

    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    if (
      arg === "--output" ||
      arg === "--ruff-bin" ||
      arg === "--vulture-bin" ||
      arg === "--biome-bin" ||
      arg === "--knip-bin" ||
      arg === "--language" ||
      arg === "--max-findings" ||
      arg === "--knip-config" ||
      arg === "--workspace" ||
      arg === "--directory" ||
      arg === "--knip-arg" ||
      arg === "--biome-arg" ||
      arg === "--ruff-arg" ||
      arg === "--vulture-arg" ||
      arg === "--exclude" ||
      arg === "--output-file" ||
      arg === "--fix-rounds" ||
      arg === "--diff-base" ||
      arg === "--install-method" ||
      arg === "--min-confidence"
    ) {
      i += 1;
      continue;
    }

    if (arg === "--json" || arg === "--sarif") {
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown option '${arg}'`);
    }

    if (pathSeen) {
      fail(`Unexpected argument '${arg}'`);
    }

    options.path = arg;
    pathSeen = true;
  }

  return options;
}

function parseInitOptions(args: string[]): InitOptions {
  const base = parseBaseOptions(args);
  const options: InitOptions = {
    ...base,
    language: "all",
    force: false,
    path: "."
  };

  let pathSeen = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--language") {
      options.language = parseInstallLanguage(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (
      arg === "--output" ||
      arg === "--ruff-bin" ||
      arg === "--vulture-bin" ||
      arg === "--biome-bin" ||
      arg === "--knip-bin"
    ) {
      i += 1;
      continue;
    }

    if (arg === "--json" || arg === "--sarif") {
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown option '${arg}'`);
    }

    if (pathSeen) {
      fail(`Unexpected argument '${arg}'`);
    }

    options.path = arg;
    pathSeen = true;
  }

  return options;
}

function parseInstallOptions(args: string[]): InstallOptions {
  const base = parseBaseOptions(args);
  const options: InstallOptions = {
    ...base,
    installMethod: "auto",
    language: "all",
    path: "."
  };

  let pathSeen = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--method") {
      options.installMethod = parseInstallMethod(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--language") {
      options.language = parseInstallLanguage(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (
      arg === "--output" ||
      arg === "--ruff-bin" ||
      arg === "--vulture-bin" ||
      arg === "--biome-bin" ||
      arg === "--knip-bin"
    ) {
      i += 1;
      continue;
    }

    if (arg === "--json" || arg === "--sarif") {
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown option '${arg}'`);
    }

    if (pathSeen) {
      fail(`Unexpected argument '${arg}'`);
    }

    options.path = arg;
    pathSeen = true;
  }

  return options;
}

async function resolveInstallLanguages(path: string, language: InstallOptions["language"]): Promise<ProjectLanguage[]> {
  if (language === "all") {
    return ["python", "typescript"];
  }

  if (language === "auto") {
    const resolved = await detectProjectLanguage(path, "auto");
    return [resolved];
  }

  return [language];
}

function writeOutput(content: string, filePath: string | null): void {
  if (filePath) {
    writeFileSync(filePath, content, "utf8");
  } else {
    process.stdout.write(content);
  }
}

async function runInstallTools(args: string[]): Promise<number> {
  if (hasHelpFlag(args)) {
    printHelp();
    return 0;
  }

  const options = parseInstallOptions(args);
  const runner = new RealCommandRunner();
  const absolutePath = resolve(options.path);
  const languages = await resolveInstallLanguages(absolutePath, options.language);

  const reports = [];
  for (const language of languages) {
    reports.push(await ensureToolsInstalled(runner, language, options.installMethod, options));
  }

  const success = reports.every((report) => report.success);

  if (options.output === "json") {
    process.stdout.write(
      formatJson({
        path: absolutePath,
        requestedLanguage: options.language,
        method: options.installMethod,
        success,
        reports
      })
    );
  } else {
    process.stdout.write("deadclean install-tools\n");
    process.stdout.write(`path: ${absolutePath}\n`);
    process.stdout.write(`requested_language: ${options.language}\n`);
    process.stdout.write(`requested_method: ${options.installMethod}\n`);
    process.stdout.write(`success: ${success}\n`);

    for (const report of reports) {
      process.stdout.write(`language: ${report.language}\n`);
      process.stdout.write(`  method_used: ${report.methodUsed ?? "none"}\n`);
      process.stdout.write("  attempts:\n");
      for (const attempt of report.attempts) {
        process.stdout.write(`    - ${attempt.method}: ${attempt.success ? "ok" : "failed"} | ${attempt.details}\n`);
      }
    }
  }

  return success ? 0 : 1;
}

async function runScanCommand(args: string[]): Promise<number> {
  if (hasHelpFlag(args)) {
    printHelp();
    return 0;
  }

  const options = parseScanOptions(args);
  const absolutePath = resolve(options.path);

  const config = await loadConfig(absolutePath);
  const mergedOptions = mergeConfigWithDefaults(options, config);

  const runner = new RealCommandRunner();
  const report = await runScan(runner, mergedOptions);

  let output: string;
  if (mergedOptions.output === "sarif") {
    output = formatScanSarif(report);
  } else if (mergedOptions.output === "json") {
    output = formatScanJson(report, mergedOptions.verbose);
  } else {
    output = formatScanText(report, mergedOptions.quiet, mergedOptions.summary);
  }

  writeOutput(output, mergedOptions.outputFile);

  return report.exitCode;
}

async function runInitCommand(args: string[]): Promise<number> {
  if (hasHelpFlag(args)) {
    printHelp();
    return 0;
  }

  const options = parseInitOptions(args);
  const report = await runInit({
    path: options.path,
    language: options.language,
    force: options.force,
    output: options.output
  });

  if (options.output === "json") {
    process.stdout.write(formatJson(report));
  } else {
    process.stdout.write(formatInitText(report));
  }

  return 0;
}

async function runDoctorCommand(args: string[]): Promise<number> {
  if (hasHelpFlag(args)) {
    printHelp();
    return 0;
  }

  const baseOptions = parseBaseOptions(args);
  const strict = args.includes("--strict");
  const report = await runDoctor(baseOptions, strict);

  if (baseOptions.output === "json") {
    process.stdout.write(formatJson(report));
  } else {
    process.stdout.write(formatDoctorText(report));
  }

  if (strict && !report.ready) {
    return 1;
  }

  return 0;
}

async function runBaselineSave(args: string[]): Promise<number> {
  const scanOptions = parseScanOptions(args);
  const absolutePath = resolve(scanOptions.path);

  const config = await loadConfig(absolutePath);
  const mergedOptions = mergeConfigWithDefaults(scanOptions, config);

  const runner = new RealCommandRunner();
  const report = await runScan(runner, mergedOptions);

  const baselinePath = resolve(absolutePath, ".deadclean-baseline.json");
  const baseline = {
    timestamp: new Date().toISOString(),
    path: report.path,
    language: report.language,
    deadCodeFindingCount: report.deadCodeFindingCount,
    deadCodeFindings: report.deadCodeFindings,
    deadCodeFindingsStructured: report.deadCodeFindingsStructured
  };

  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n", "utf8");

  if (scanOptions.output === "json") {
    process.stdout.write(formatJson({
      action: "baseline_save",
      path: baselinePath,
      findingsCount: report.deadCodeFindingCount,
      timestamp: baseline.timestamp
    }));
  } else {
    process.stdout.write(`Baseline saved to ${baselinePath}\n`);
    process.stdout.write(`Findings recorded: ${report.deadCodeFindingCount}\n`);
  }

  return 0;
}

async function runBaselineCheck(args: string[]): Promise<number> {
  const scanOptions = parseScanOptions(args);
  const absolutePath = resolve(scanOptions.path);

  const config = await loadConfig(absolutePath);
  const mergedOptions = mergeConfigWithDefaults(scanOptions, config);

  const baselinePath = resolve(absolutePath, ".deadclean-baseline.json");

  if (!existsSync(baselinePath)) {
    process.stderr.write("No baseline found. Run 'deadclean baseline save' first.\n");
    return 2;
  }

  const baselineRaw = readFileSync(baselinePath, "utf8");
  const baseline = JSON.parse(baselineRaw) as { deadCodeFindings: string[]; timestamp: string; deadCodeFindingCount: number };

  const runner = new RealCommandRunner();
  const report = await runScan(runner, mergedOptions);

  const baselineSet = new Set(baseline.deadCodeFindings);
  const newFindings = report.deadCodeFindings.filter((f) => !baselineSet.has(f));

  const result = {
    action: "baseline_check",
    baselineTimestamp: baseline.timestamp,
    currentFindings: report.deadCodeFindingCount,
    baselineFindings: baseline.deadCodeFindingCount,
    newFindingsCount: newFindings.length,
    newFindings,
    hasNewFindings: newFindings.length > 0
  };

  if (scanOptions.output === "json") {
    process.stdout.write(formatJson(result));
  } else {
    process.stdout.write("deadclean baseline check\n");
    process.stdout.write(`baseline: ${baseline.timestamp}\n`);
    process.stdout.write(`current: ${report.deadCodeFindingCount} findings\n`);
    process.stdout.write(`baseline: ${baseline.deadCodeFindingCount} findings\n`);
    process.stdout.write(`new: ${newFindings.length} findings\n`);

    if (newFindings.length > 0) {
      process.stdout.write("new findings:\n");
      for (const f of newFindings) {
        process.stdout.write(`  - ${f}\n`);
      }
    }
  }

  if (mergedOptions.strict && newFindings.length > 0) {
    return 1;
  }

  return 0;
}

async function runBaselineCommand(subArgs: string[]): Promise<number> {
  if (subArgs.length === 0 || hasHelpFlag(subArgs)) {
    printHelp();
    return 0;
  }

  const [action, ...rest] = subArgs;

  if (action === "save") {
    return runBaselineSave(rest);
  }

  if (action === "check") {
    return runBaselineCheck(rest);
  }

  fail(`Unknown baseline action '${action}'. Expected: save | check`);
}

function hasHelpFlag(args: string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

export async function runCli(argv: string[]): Promise<number> {
  if (argv.length === 0) {
    return runScanCommand([]);
  }

  const [first, ...rest] = argv;

  if (first === "--help" || first === "-h" || first === "help") {
    printHelp();
    return 0;
  }

  if (first === "--version" || first === "-v") {
    process.stdout.write(`${packageVersion()}\n`);
    return 0;
  }

  if (first === "scan") {
    return runScanCommand(rest);
  }

  if (first === "doctor") {
    return runDoctorCommand(rest);
  }

  if (first === "init") {
    return runInitCommand(rest);
  }

  if (first === "install-tools") {
    return runInstallTools(rest);
  }

  if (first === "baseline") {
    return runBaselineCommand(rest);
  }

  return runScanCommand(argv);
}
