import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runDoctor } from "./doctor";
import { formatDoctorText, formatJson, formatScanJson, formatScanText } from "./format";
import { formatInitText, runInit } from "./init";
import { ensureToolsInstalled } from "./install";
import { detectProjectLanguage } from "./language";
import { RealCommandRunner } from "./process";
import { runScan } from "./scan";
import type {
  InstallMethod,
  LanguageMode,
  OutputMode,
  ProjectLanguage,
  ScanOptions,
  ToolBinaries
} from "./types";

const VALID_INSTALL_METHODS: InstallMethod[] = ["auto", "uv", "pipx", "pip", "npm"];
const VALID_LANGUAGES: LanguageMode[] = ["auto", "python", "typescript"];
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
  minConfidence: 100,
  maxFindings: 200,
  ensureTools: false,
  installMethod: "auto",
  output: "text",
  strict: false,
  strictLint: false,
  verbose: false,
  knipConfig: null,
  workspaces: [],
  directory: null,
  knipArgs: [],
  biomeArgs: [],
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
  process.stdout.write("  deadclean install-tools [path] [options]\n\n");

  process.stdout.write("Commands:\n");
  process.stdout.write("  scan           Run language-aware scan (default command)\n");
  process.stdout.write("  doctor         Show runtime and tool availability\n");
  process.stdout.write("  init           Create starter knip.json and .vulture_ignore files\n");
  process.stdout.write("  install-tools  Install required tools for Python/TypeScript\n\n");

  process.stdout.write("Scan options:\n");
  process.stdout.write("  --language <mode>           auto | python | typescript (default: auto)\n");
  process.stdout.write("  --fix                       Apply safe auto-fixes first\n");
  process.stdout.write("  --min-confidence <0-100>    Vulture threshold for Python scans\n");
  process.stdout.write("  --max-findings <n>          Cap reported findings (default: 200, use '0' for no cap)\n");
  process.stdout.write("  --ensure-tools              Install missing tools before scan\n");
  process.stdout.write("  --install-method <method>   auto | uv | pipx | pip | npm\n");
  process.stdout.write("  --knip-config <path>        Knip config file path\n");
  process.stdout.write("  --workspace <filter>        Knip workspace filter (repeatable)\n");
  process.stdout.write("  --directory <path>          Knip directory scope relative to project root\n");
  process.stdout.write("  --knip-arg <arg>            Extra Knip arg (repeatable)\n");
  process.stdout.write("  --biome-arg <arg>           Extra Biome lint arg (repeatable)\n");
  process.stdout.write("  --strict                    Exit non-zero if dead-code findings remain\n");
  process.stdout.write("  --strict-lint               Include lint findings in strict exit behavior\n");
  process.stdout.write("  --verbose                   Include raw tool output\n");
  process.stdout.write("  --ruff-bin <name>           Ruff binary (default: ruff)\n");
  process.stdout.write("  --vulture-bin <name>        Vulture binary (default: vulture)\n");
  process.stdout.write("  --biome-bin <name>          Biome binary (default: biome)\n");
  process.stdout.write("  --knip-bin <name>           Knip binary (default: knip)\n");
  process.stdout.write("  --json                      Alias for --output json\n");
  process.stdout.write("  --output <mode>             text | json (default: text)\n\n");

  process.stdout.write("Install options:\n");
  process.stdout.write("  --language <mode>           auto | python | typescript | all\n");
  process.stdout.write("  --method <method>           auto | uv | pipx | pip | npm\n");
  process.stdout.write("  --json                      Alias for --output json\n\n");

  process.stdout.write("Init options:\n");
  process.stdout.write("  --language <mode>           auto | python | typescript | all\n");
  process.stdout.write("  --force                     Overwrite existing generated files\n");
  process.stdout.write("  --json                      Alias for --output json\n\n");

  process.stdout.write("Examples:\n");
  process.stdout.write("  deadclean . --fix\n");
  process.stdout.write("  deadclean ./apps/web --language typescript --strict\n");
  process.stdout.write("  deadclean ./apps/web --language typescript --workspace web --max-findings 50\n");
  process.stdout.write("  deadclean ./services --language python --ensure-tools\n");
  process.stdout.write("  deadclean init . --language all\n");
  process.stdout.write("  deadclean install-tools . --language all --method auto\n");
  process.stdout.write("  deadclean doctor --json\n");
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
  if (value !== "text" && value !== "json") {
    fail(`Invalid output mode '${value}'. Expected: text | json`);
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

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--strict-lint") {
      options.strictLint = true;
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
      arg === "--biome-arg"
    ) {
      i += 1;
      continue;
    }

    if (arg === "--json") {
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

    if (arg === "--json") {
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

    if (arg === "--json") {
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

async function runInstallTools(args: string[]): Promise<number> {
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
  const options = parseScanOptions(args);
  const runner = new RealCommandRunner();
  const report = await runScan(runner, options);

  if (options.output === "json") {
    process.stdout.write(formatScanJson(report, options.verbose));
  } else {
    process.stdout.write(formatScanText(report));
  }

  const hasOperationalErrors = report.toolErrors.length > 0 || report.executionErrors.length > 0;
  if (hasOperationalErrors) {
    return 2;
  }

  if (!options.strict) {
    return 0;
  }

  const lintFailure = options.strictLint ? report.lintIssueCount > 0 : false;
  return report.deadCodeFindingCount > 0 || lintFailure ? 1 : 0;
}

async function runInitCommand(args: string[]): Promise<number> {
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
  const options = parseBaseOptions(args);
  const report = await runDoctor(options);

  if (options.output === "json") {
    process.stdout.write(formatJson(report));
  } else {
    process.stdout.write(formatDoctorText(report));
  }

  return 0;
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

  return runScanCommand(argv);
}
