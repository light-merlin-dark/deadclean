import type { CommandResult, VultureFinding } from "./types";

const RUFF_SUMMARY_PATTERN = /Found\s+(\d+)\s+errors?/i;
const RUFF_FIXED_PATTERN = /\((\d+)\s+fixed,\s*(\d+)\s+remaining\)/i;
const RUFF_PATH_LINE_PATTERN = /^.+:\d+:\d+:/;
const BIOME_SUMMARY_PATTERN = /Found\s+(\d+)\s+(error|errors|diagnostic|diagnostics)/i;
const BIOME_FIXED_PATTERN = /Applied\s+(\d+)\s+fix(?:es)?/i;

const KNIP_CATEGORY_LABELS: Record<string, string> = {
  files: "files",
  dependencies: "dependencies",
  devDependencies: "devDependencies",
  optionalPeerDependencies: "optionalPeerDependencies",
  unresolved: "unresolved",
  unlisted: "unlisted",
  binaries: "binaries",
  exports: "exports",
  nsExports: "nsExports",
  types: "types",
  nsTypes: "nsTypes",
  enumMembers: "enumMembers",
  namespaceMembers: "namespaceMembers",
  duplicates: "duplicates",
  catalog: "catalog"
};

interface KnipIssue {
  file?: string;
  [key: string]: unknown;
}

interface KnipJsonPayload {
  issues?: KnipIssue[];
}

export interface KnipParseResult {
  findings: string[];
  preludeWarnings: string[];
  parsingErrors: string[];
}

export function parseRuffIssueCount(result: CommandResult): number {
  const output = `${result.stdout}\n${result.stderr}`;
  const summaryMatch = output.match(RUFF_SUMMARY_PATTERN);

  if (summaryMatch) {
    return Number(summaryMatch[1]);
  }

  if (output.includes("All checks passed")) {
    return 0;
  }

  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.filter((line) => RUFF_PATH_LINE_PATTERN.test(line)).length;
}

export function parseRuffFixedCount(result: CommandResult): number {
  const output = `${result.stdout}\n${result.stderr}`;
  const fixMatch = output.match(RUFF_FIXED_PATTERN);

  if (fixMatch) {
    return Number(fixMatch[1]);
  }

  if (output.includes("No fixes available")) {
    return 0;
  }

  return 0;
}

export function parseVultureFindings(result: CommandResult): VultureFinding[] {
  const output = `${result.stdout}\n${result.stderr}`;

  if (output.includes("No dead code found")) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line): VultureFinding | null => {
      const match = line.match(/^(.+?):(\d+):\s*(.+)$/);
      if (!match) {
        return null;
      }

      return {
        file: match[1],
        line: Number(match[2]),
        message: match[3]
      };
    })
    .filter((finding): finding is VultureFinding => finding !== null);
}

export function parseBiomeIssueCount(result: CommandResult): number {
  const output = `${result.stdout}\n${result.stderr}`;
  const summaryMatch = output.match(BIOME_SUMMARY_PATTERN);
  if (summaryMatch) {
    return Number(summaryMatch[1]);
  }

  if (output.includes("Checked") && output.includes("No fixes applied")) {
    return 0;
  }

  if (output.includes("Checked") && output.includes("No issues found")) {
    return 0;
  }

  return result.exitCode === 0 ? 0 : 1;
}

export function parseBiomeFixedCount(result: CommandResult): number {
  const output = `${result.stdout}\n${result.stderr}`;
  const match = output.match(BIOME_FIXED_PATTERN);
  if (match) {
    return Number(match[1]);
  }

  if (output.includes("No fixes applied")) {
    return 0;
  }

  return 0;
}

function tryParseKnipPayload(output: string): { payload: KnipJsonPayload | null; prelude: string } {
  const trimmed = output.trim();
  if (!trimmed) {
    return { payload: null, prelude: "" };
  }

  try {
    return {
      payload: JSON.parse(trimmed) as KnipJsonPayload,
      prelude: ""
    };
  } catch {
    // Continue with best-effort extraction below.
  }

  const lines = trimmed.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const candidate = lines.slice(i).join("\n").trim();
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) {
      continue;
    }
    try {
      return {
        payload: JSON.parse(candidate) as KnipJsonPayload,
        prelude: lines
          .slice(0, i)
          .join("\n")
          .trim()
      };
    } catch {
      continue;
    }
  }

  return { payload: null, prelude: trimmed };
}

function summarizeKnipIssue(issue: KnipIssue): string | null {
  const file = typeof issue.file === "string" && issue.file.trim().length > 0 ? issue.file : "(unknown file)";
  const parts: string[] = [];

  for (const [key, label] of Object.entries(KNIP_CATEGORY_LABELS)) {
    const value = issue[key];
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }
    parts.push(`${label}:${value.length}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return `${file} [${parts.join(", ")}]`;
}

export function parseKnipResult(result: CommandResult): KnipParseResult {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (!stdout && !stderr) {
    return {
      findings: [],
      preludeWarnings: [],
      parsingErrors: []
    };
  }

  const attempts = [
    { candidate: stdout, trailingPrelude: stderr },
    { candidate: stderr, trailingPrelude: stdout },
    { candidate: `${stdout}\n${stderr}`.trim(), trailingPrelude: "" }
  ];

  for (const attempt of attempts) {
    if (!attempt.candidate) {
      continue;
    }
    const { payload, prelude } = tryParseKnipPayload(attempt.candidate);
    if (!payload) {
      continue;
    }

    const issues = Array.isArray(payload.issues) ? payload.issues : [];
    const findings = issues
      .map((issue) => summarizeKnipIssue(issue))
      .filter((line): line is string => typeof line === "string");

    const preludeWarnings = `${prelude}\n${attempt.trailingPrelude}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      findings,
      preludeWarnings,
      parsingErrors: []
    };
  }

  return {
    findings: [],
    preludeWarnings: [],
    parsingErrors: ["Unable to parse Knip JSON output"]
  };
}
