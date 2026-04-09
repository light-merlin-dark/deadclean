import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatDoctorText, formatJson, formatScanText } from "./format";
import { runDoctor } from "./doctor";
import { ensureToolsInstalled } from "./install";
import { RealCommandRunner } from "./process";
import { runScan } from "./scan";
import type { InstallMethod, OutputMode, ScanOptions } from "./types";

const VALID_INSTALL_METHODS: InstallMethod[] = ["auto", "uv", "pipx", "pip"];

interface BaseOptions {
  output: OutputMode;
  ruffBinary: string;
  vultureBinary: string;
}

interface InstallOptions extends BaseOptions {
  installMethod: InstallMethod;
}

const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  path: ".",
  fix: false,
  minConfidence: 100,
  ensureTools: false,
  installMethod: "auto",
  output: "text",
  strict: false,
  verbose: false,
  ruffBinary: "ruff",
  vultureBinary: "vulture"
};

function packageVersion(): string {
  const packagePath = resolve(__dirname, "..", "package.json");
  const raw = readFileSync(packagePath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}

function printHelp(): void {
  process.stdout.write(`deadclean ${packageVersion()}\n\n`);
  process.stdout.write("AI-friendly dead code cleanup with Ruff + Vulture.\n\n");
  process.stdout.write("Usage:\n");
  process.stdout.write("  deadclean [path] [options]\n");
  process.stdout.write("  deadclean scan [path] [options]\n");
  process.stdout.write("  deadclean doctor [options]\n");
  process.stdout.write("  deadclean install-tools [options]\n\n");

  process.stdout.write("Commands:\n");
  process.stdout.write("  scan           Run Ruff + Vulture scan (default command)\n");
  process.stdout.write("  doctor         Show runtime and tool availability\n");
  process.stdout.write("  install-tools  Install Ruff + Vulture using selected method\n\n");

  process.stdout.write("Scan options:\n");
  process.stdout.write("  --fix                       Apply safe Ruff auto-fixes first\n");
  process.stdout.write("  --min-confidence <0-100>    Vulture confidence threshold (default: 100)\n");
  process.stdout.write("  --ensure-tools              Install missing tools before scan\n");
  process.stdout.write("  --install-method <method>   auto | uv | pipx | pip\n");
  process.stdout.write("  --strict                    Exit non-zero if findings remain\n");
  process.stdout.write("  --verbose                   Include raw tool output\n");
  process.stdout.write("  --ruff-bin <name>           Ruff binary (default: ruff)\n");
  process.stdout.write("  --vulture-bin <name>        Vulture binary (default: vulture)\n");
  process.stdout.write("  --json                      Alias for --output json\n");
  process.stdout.write("  --output <mode>             text | json (default: text)\n\n");

  process.stdout.write("Install options:\n");
  process.stdout.write("  --method <method>           auto | uv | pipx | pip (default: auto)\n");
  process.stdout.write("  --json                      Alias for --output json\n\n");

  process.stdout.write("Examples:\n");
  process.stdout.write("  deadclean . --fix\n");
  process.stdout.write("  deadclean scan ./examples/python-vibe-sample --strict\n");
  process.stdout.write("  deadclean install-tools --method auto\n");
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
    vultureBinary: "vulture"
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--json") {
      options.output = "json";
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

    if (arg === "--min-confidence") {
      const value = Number(consumeValue(args, i, arg));
      if (!Number.isInteger(value)) {
        fail("--min-confidence must be an integer");
      }
      options.minConfidence = value;
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

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    if (arg === "--output" || arg === "--ruff-bin" || arg === "--vulture-bin") {
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
    installMethod: "auto"
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--method") {
      options.installMethod = parseInstallMethod(consumeValue(args, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--output" || arg === "--ruff-bin" || arg === "--vulture-bin") {
      i += 1;
      continue;
    }

    if (arg === "--json") {
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown option '${arg}'`);
    }

    fail(`Unexpected argument '${arg}'`);
  }

  return options;
}

async function runInstallTools(args: string[]): Promise<number> {
  const options = parseInstallOptions(args);
  const runner = new RealCommandRunner();
  const report = await ensureToolsInstalled(runner, options.installMethod, options.ruffBinary, options.vultureBinary);

  if (options.output === "json") {
    process.stdout.write(formatJson(report));
  } else {
    process.stdout.write("deadclean install-tools\n");
    process.stdout.write(`requested_method: ${report.methodRequested}\n`);
    process.stdout.write(`success: ${report.success}\n`);
    process.stdout.write(`method_used: ${report.methodUsed ?? "none"}\n`);
    process.stdout.write("attempts:\n");
    for (const attempt of report.attempts) {
      process.stdout.write(`  - ${attempt.method}: ${attempt.success ? "ok" : "failed"} | ${attempt.details}\n`);
    }
  }

  return report.success ? 0 : 1;
}

async function runScanCommand(args: string[]): Promise<number> {
  const options = parseScanOptions(args);
  const runner = new RealCommandRunner();
  const report = await runScan(runner, options);

  if (options.output === "json") {
    process.stdout.write(formatJson(report));
  } else {
    process.stdout.write(formatScanText(report));
  }

  if (!options.strict) {
    return 0;
  }

  return report.ruffIssueCount > 0 || report.vultureFindingCount > 0 ? 1 : 0;
}

async function runDoctorCommand(args: string[]): Promise<number> {
  const options = parseBaseOptions(args);
  const report = await runDoctor(options.ruffBinary, options.vultureBinary);

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

  if (first === "install-tools") {
    return runInstallTools(rest);
  }

  return runScanCommand(argv);
}
