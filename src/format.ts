import { displayOutput } from "./process";
import type { CommandResult, DoctorReport, InstallReport, ScanReport } from "./types";

function formatInstallReport(install: InstallReport | null): string[] {
  if (!install) {
    return [];
  }

  const lines: string[] = [];
  lines.push("install:");
  lines.push(`  requested_method: ${install.methodRequested}`);
  lines.push(`  success: ${install.success}`);
  lines.push(`  method_used: ${install.methodUsed ?? "none"}`);
  lines.push("  attempts:");

  for (const attempt of install.attempts) {
    lines.push(`    - ${attempt.method}: ${attempt.success ? "ok" : "failed"} | ${attempt.details}`);
  }

  return lines;
}

export function formatDoctorText(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push("deadclean doctor");
  lines.push(`platform: ${report.platform}`);
  lines.push(`node: ${report.nodeVersion}`);
  lines.push(`bun: ${report.bunVersion ?? "not installed"}`);
  lines.push(`cwd: ${report.cwd}`);
  lines.push("tools:");

  for (const tool of report.tools) {
    lines.push(`  - ${tool.name}: ${tool.installed ? "installed" : "missing"}`);
    if (tool.installed) {
      lines.push(`    version: ${tool.version ?? "unknown"}`);
      lines.push(`    path: ${tool.path ?? "unknown"}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatScanText(report: ScanReport): string {
  const lines: string[] = [];

  lines.push("deadclean scan");
  lines.push(`path: ${report.path}`);
  lines.push(`language: ${report.language}`);
  lines.push(`lint_tool: ${report.lintTool}`);
  lines.push(`dead_code_tool: ${report.deadCodeTool}`);
  lines.push(`lint_issues: ${report.lintIssueCount}`);
  lines.push(`auto_fixed: ${report.fixedCount}`);
  lines.push(`dead_code_findings: ${report.deadCodeFindingCount}`);
  lines.push(`elapsed_ms: ${report.elapsedMs}`);

  lines.push(...formatInstallReport(report.install));

  if (report.deadCodeFindings.length > 0) {
    lines.push("dead_code_report:");
    for (const finding of report.deadCodeFindings) {
      lines.push(`  - ${finding}`);
    }
  } else {
    lines.push("dead_code_report:");
    lines.push("  - none");
  }

  if (report.options.verbose) {
    lines.push("lint_output:");
    lines.push(displayOutput(report.lintResult) || "(no output)");
    lines.push("dead_code_output:");
    lines.push(displayOutput(report.deadCodeResult) || "(no output)");
  }

  lines.push("next:");
  lines.push("  - Review dead-code findings before deleting code.");
  lines.push("  - Use --strict in CI to fail on remaining findings.");

  return `${lines.join("\n")}\n`;
}

function summarizeCommandResult(result: CommandResult, maxChars = 1200): Record<string, unknown> {
  const output = `${result.stdout}\n${result.stderr}`.trim();
  const trimmedOutput = output.length > maxChars ? `${output.slice(0, maxChars)}\n...(truncated)` : output;

  return {
    command: result.command,
    args: result.args,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    output: trimmedOutput
  };
}

export function formatScanJson(report: ScanReport, verbose: boolean): string {
  const payload: Record<string, unknown> = {
    path: report.path,
    language: report.language,
    lintTool: report.lintTool,
    deadCodeTool: report.deadCodeTool,
    lintIssueCount: report.lintIssueCount,
    fixedCount: report.fixedCount,
    deadCodeFindingCount: report.deadCodeFindingCount,
    deadCodeFindings: report.deadCodeFindings,
    elapsedMs: report.elapsedMs,
    options: {
      path: report.options.path,
      language: report.options.language,
      fix: report.options.fix,
      minConfidence: report.options.minConfidence,
      ensureTools: report.options.ensureTools,
      installMethod: report.options.installMethod,
      strict: report.options.strict,
      strictLint: report.options.strictLint
    }
  };

  if (report.install) {
    payload.install = report.install;
  }

  if (verbose) {
    payload.fixResult = report.fixResult ? summarizeCommandResult(report.fixResult) : null;
    payload.lintResult = summarizeCommandResult(report.lintResult);
    payload.deadCodeResult = summarizeCommandResult(report.deadCodeResult);
  }

  return formatJson(payload);
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
