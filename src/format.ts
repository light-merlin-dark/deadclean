import { displayOutput } from "./process";
import type { CommandResult, DoctorReport, InstallReport, ScanReport, StructuredFinding } from "./types";

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
  lines.push(`ready: ${report.ready}`);
  lines.push("tools:");

  for (const tool of report.tools) {
    lines.push(`  - ${tool.name}: ${tool.installed ? "installed" : "missing"}`);
    if (tool.installed) {
      lines.push(`    version: ${tool.version ?? "unknown"}`);
      lines.push(`    path: ${tool.path ?? "unknown"}`);
    }
  }

  if (report.missingTools.length > 0) {
    lines.push(`missing_tools: ${report.missingTools.join(", ")}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatScanText(report: ScanReport, quiet: boolean = false, summary: boolean = false): string {
  if (summary) {
    return formatSummaryLine(report);
  }

  const lines: string[] = [];

  lines.push("deadclean scan");
  lines.push(`path: ${report.path}`);
  lines.push(`language: ${Array.isArray(report.language) ? report.language.join(", ") : report.language}`);
  lines.push(`lint_tool: ${report.lintTool}`);
  lines.push(`dead_code_tool: ${report.deadCodeTool}`);
  lines.push(`lint_issues: ${report.lintIssueCount}`);
  lines.push(`auto_fixed: ${report.fixedCount}`);
  lines.push(`dead_code_findings: ${report.deadCodeFindingCount}`);
  lines.push(`dead_code_shown: ${report.displayedDeadCodeFindingCount}`);
  lines.push(`findings_truncated: ${report.findingsTruncated}`);
  lines.push(`elapsed_ms: ${report.elapsedMs}`);
  lines.push(`timestamp: ${report.timestamp}`);
  lines.push(`status: ${report.status}`);
  lines.push(`exit_code: ${report.exitCode}`);

  lines.push(...formatInstallReport(report.install));

  if (report.deadCodeFindings.length > 0) {
    lines.push("dead_code_report:");
    for (const finding of report.deadCodeFindings) {
      lines.push(`  - ${finding}`);
    }
    if (report.findingsTruncated) {
      lines.push(`  - ... truncated ${report.deadCodeFindingCount - report.displayedDeadCodeFindingCount} findings`);
    }
  } else {
    lines.push("dead_code_report:");
    lines.push("  - none");
  }

  if (report.toolErrors.length > 0) {
    lines.push("tool_errors:");
    for (const error of report.toolErrors) {
      lines.push(`  - ${error}`);
    }
  }

  if (report.executionErrors.length > 0) {
    lines.push("execution_errors:");
    for (const error of report.executionErrors) {
      lines.push(`  - ${error}`);
    }
  }

  if (!quiet) {
    if (report.options.verbose) {
      lines.push("lint_output:");
      lines.push(displayOutput(report.lintResult) || "(no output)");
      lines.push("dead_code_output:");
      lines.push(displayOutput(report.deadCodeResult) || "(no output)");
    }

    lines.push("next:");
    lines.push("  - Review dead-code findings before deleting code.");
    lines.push("  - Use --strict in CI to fail on remaining findings.");
    lines.push("  - Resolve tool/execution errors before trusting findings.");
  }

  return `${lines.join("\n")}\n`;
}

function formatSummaryLine(report: ScanReport): string {
  const parts = [
    `${report.lintIssueCount} lint`,
    `${report.deadCodeFindingCount} dead-code`,
    `${report.fixedCount} fixed`,
    `${report.toolErrors.length + report.executionErrors.length} errors`,
    `${report.elapsedMs}ms`
  ];
  return `${parts.join(" | ")}\n`;
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

function groupFindingsByFile(findings: StructuredFinding[]): Record<string, StructuredFinding[]> {
  const grouped: Record<string, StructuredFinding[]> = {};
  for (const f of findings) {
    if (!grouped[f.file]) {
      grouped[f.file] = [];
    }
    grouped[f.file].push(f);
  }
  return grouped;
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
    deadCodeFindingsStructured: report.deadCodeFindingsStructured,
    deadCodeFindingsByFile: groupFindingsByFile(report.deadCodeFindingsStructured),
    elapsedMs: report.elapsedMs,
    timestamp: report.timestamp,
    status: report.status,
    exitCode: report.exitCode,
    toolVersions: report.toolVersions,
    filesScanned: report.filesScanned,
    filesWithIssues: report.filesWithIssues,
    options: {
      path: report.options.path,
      language: report.options.language,
      fix: report.options.fix,
      minConfidence: report.options.minConfidence,
      maxFindings: report.options.maxFindings,
      ensureTools: report.options.ensureTools,
      installMethod: report.options.installMethod,
      strict: report.options.strict,
      strictLint: report.options.strictLint,
      knipConfig: report.options.knipConfig,
      workspaces: report.options.workspaces,
      directory: report.options.directory,
      knipArgs: report.options.knipArgs,
      biomeArgs: report.options.biomeArgs,
      ruffArgs: report.options.ruffArgs,
      vultureArgs: report.options.vultureArgs,
      exclude: report.options.exclude,
      fixRounds: report.options.fixRounds,
      diffBase: report.options.diffBase
    }
  };

  if (report.install) {
    payload.install = report.install;
  }

  payload.displayedDeadCodeFindingCount = report.displayedDeadCodeFindingCount;
  payload.findingsTruncated = report.findingsTruncated;
  payload.toolErrors = report.toolErrors;
  payload.executionErrors = report.executionErrors;

  if (verbose) {
    payload.fixResult = report.fixResult ? summarizeCommandResult(report.fixResult) : null;
    payload.lintResult = summarizeCommandResult(report.lintResult);
    payload.deadCodeResult = summarizeCommandResult(report.deadCodeResult);
  }

  return formatJson(payload);
}

export function formatScanSarif(report: ScanReport): string {
  const rules: Array<{ id: string; shortDescription: { text: string } }> = [];
  const results: Array<Record<string, unknown>> = [];

  const seenCategories = new Set<string>();
  for (const finding of report.deadCodeFindingsStructured) {
    const ruleId = `deadclean/${finding.tool}/${finding.category}`;
    if (!seenCategories.has(ruleId)) {
      seenCategories.add(ruleId);
      rules.push({
        id: ruleId,
        shortDescription: { text: `Unused ${finding.category} detected by ${finding.tool}` }
      });
    }

    results.push({
      ruleId,
      level: finding.severity === "high" ? "error" : finding.severity === "medium" ? "warning" : "note",
      message: { text: finding.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: finding.file },
            ...(finding.line !== null ? { region: { startLine: finding.line } } : {})
          }
        }
      ]
    });
  }

  const sarif = {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "deadclean",
            version: "0.3.0",
            informationUri: "https://github.com/light-merlin-dark/deadclean",
            rules
          }
        },
        results
      }
    ]
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
