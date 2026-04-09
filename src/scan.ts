import { resolve } from "node:path";
import { ensureToolsInstalled, inspectRequiredTools } from "./install";
import { parseRuffFixedCount, parseRuffIssueCount, parseVultureFindings } from "./parsers";
import { displayOutput } from "./process";
import type { CommandRunner, InstallReport, ScanOptions, ScanReport } from "./types";

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

export async function runScan(runner: CommandRunner, options: ScanOptions): Promise<ScanReport> {
  const started = Date.now();
  const minConfidence = ensureConfidence(options.minConfidence);
  const absolutePath = resolve(options.path);

  let install: InstallReport | null = null;

  if (options.ensureTools) {
    install = await ensureToolsInstalled(runner, options.installMethod, options.ruffBinary, options.vultureBinary);
    if (!install.success) {
      const reason = install.attempts.map((attempt) => `${attempt.method}: ${attempt.details}`).join("\n");
      throw new Error(`Unable to install Ruff and Vulture.\n${reason}`.trim());
    }
  } else {
    const status = await inspectRequiredTools(runner, options.ruffBinary, options.vultureBinary);
    const missing = status.filter((tool) => !tool.installed).map((tool) => tool.name);
    if (missing.length > 0) {
      throw new Error(
        `Missing required tools: ${missing.join(", ")}. Run 'deadclean install-tools --method auto' or rerun with --ensure-tools.`
      );
    }
  }

  let ruffFix = null;
  if (options.fix) {
    ruffFix = await runner.run(options.ruffBinary, ["check", absolutePath, "--fix", "--output-format", "full"]);
    assertToolRun("ruff --fix", ruffFix.exitCode, displayOutput(ruffFix));
  }

  const [ruffCheck, vultureCheck] = await Promise.all([
    runner.run(options.ruffBinary, ["check", absolutePath, "--output-format", "full"]),
    runner.run(options.vultureBinary, [absolutePath, `--min-confidence=${minConfidence}`])
  ]);

  assertToolRun("ruff check", ruffCheck.exitCode, displayOutput(ruffCheck));
  assertToolRun("vulture", vultureCheck.exitCode, displayOutput(vultureCheck));

  const ruffIssueCount = parseRuffIssueCount(ruffCheck);
  const ruffFixedCount = ruffFix ? parseRuffFixedCount(ruffFix) : 0;
  const vultureFindings = parseVultureFindings(vultureCheck);

  return {
    path: absolutePath,
    options: {
      ...options,
      minConfidence
    },
    install,
    ruffFix,
    ruffCheck,
    vultureCheck,
    ruffIssueCount,
    ruffFixedCount,
    vultureFindingCount: vultureFindings.length,
    vultureFindings,
    elapsedMs: Date.now() - started
  };
}
