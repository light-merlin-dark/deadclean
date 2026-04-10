import type { CommandResult, StructuredFinding, VultureFinding } from "./types";

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
  files?: Record<string, KnipIssue>;
}

export interface KnipParseResult {
  findings: string[];
  findingsStructured: StructuredFinding[];
  preludeWarnings: string[];
  parsingErrors: string[];
}

function extractKnipNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item: unknown) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "name" in item) return String((item as { name: string }).name);
        return null;
      })
      .filter((n): n is string => n !== null);
  }
  return [];
}

function classifySeverity(confidence: number | null, category: string): "high" | "medium" | "low" {
  if (category === "unused_function" || category === "exports" || category === "types") return "high";
  if (confidence !== null) {
    if (confidence >= 80) return "high";
    if (confidence >= 60) return "medium";
    return "low";
  }
  return "medium";
}

function parseConfidence(message: string): number | null {
  const match = message.match(/\((\d+)%\s+confidence\)/i);
  return match ? Number(match[1]) : null;
}

export function parseRuffIssueCount(result: CommandResult): number {
  const output = `${result.stdout}\n${result.stderr}`;

  try {
    const parsed = JSON.parse(output.trim());
    if (Array.isArray(parsed)) return parsed.length;
  } catch {}

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

export function parseRuffStructured(result: CommandResult): StructuredFinding[] {
  const output = `${result.stdout}\n${result.stderr}`.trim();

  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return parsed.map((item: { filename?: string; location?: { row?: number }; message?: string; code?: { code?: string } }) => ({
        file: item.filename ?? "",
        line: item.location?.row ?? null,
        message: item.message ?? "",
        tool: "ruff",
        category: item.code?.code ?? "lint",
        name: null,
        confidence: null,
        severity: "medium" as const
      }));
    }
  } catch {}

  return [];
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
        message: match[3],
        confidence: parseConfidence(match[3]) ?? 100
      };
    })
    .filter((finding): finding is VultureFinding => finding !== null);
}

export function parseVultureStructured(result: CommandResult): StructuredFinding[] {
  return parseVultureFindings(result).map((f) => ({
    file: f.file,
    line: f.line,
    message: f.message,
    tool: "vulture",
    category: "unused_code",
    name: null,
    confidence: f.confidence,
    severity: classifySeverity(f.confidence, "unused_code")
  }));
}

export function parseBiomeIssueCount(result: CommandResult): number {
  const output = `${result.stdout}\n${result.stderr}`;

  try {
    const parsed = JSON.parse(output.trim());
    if (parsed && typeof parsed === "object" && "diagnostics" in parsed) {
      const diagnostics = (parsed as { diagnostics: unknown[] }).diagnostics;
      if (Array.isArray(diagnostics)) return diagnostics.length;
    }
  } catch {}

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

export function parseBiomeStructured(result: CommandResult): StructuredFinding[] {
  const output = `${result.stdout}\n${result.stderr}`.trim();

  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === "object" && "diagnostics" in parsed) {
      const diagnostics = (parsed as { diagnostics: Array<{ location?: { file?: string; line?: number }; message?: string; category?: string }> }).diagnostics;
      if (Array.isArray(diagnostics)) {
        return diagnostics.map((d) => ({
          file: d.location?.file ?? "",
          line: d.location?.line ?? null,
          message: d.message ?? "",
          tool: "biome",
          category: d.category ?? "lint",
          name: null,
          confidence: null,
          severity: "medium" as const
        }));
      }
    }
  } catch {}

  return [];
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
  } catch {}

  const lines = trimmed.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const candidate = lines.slice(i).join("\n").trim();
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) {
      continue;
    }
    try {
      return {
        payload: JSON.parse(candidate) as KnipJsonPayload,
        prelude: lines.slice(0, i).join("\n").trim()
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
    const names = extractKnipNames(value);
    const detail = names.length > 0 ? `${label}:${names.join(", ")}` : `${label}:${value.length}`;
    parts.push(detail);
  }

  if (parts.length === 0) {
    return null;
  }

  return `${file} [${parts.join(", ")}]`;
}

function extractKnipStructured(issue: KnipIssue): StructuredFinding[] {
  const file = typeof issue.file === "string" && issue.file.trim().length > 0 ? issue.file : "(unknown file)";
  const findings: StructuredFinding[] = [];

  for (const [key, label] of Object.entries(KNIP_CATEGORY_LABELS)) {
    const value = issue[key];
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }
    const names = extractKnipNames(value);

    if (names.length > 0) {
      for (const name of names) {
        findings.push({
          file,
          line: null,
          message: `unused ${label}: ${name}`,
          tool: "knip",
          category: label,
          name,
          confidence: null,
          severity: classifySeverity(null, label)
        });
      }
    } else {
      findings.push({
        file,
        line: null,
        message: `${value.length} unused ${label}`,
        tool: "knip",
        category: label,
        name: null,
        confidence: null,
        severity: classifySeverity(null, label)
      });
    }
  }

  return findings;
}

export function parseKnipResult(result: CommandResult): KnipParseResult {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (!stdout && !stderr) {
    return {
      findings: [],
      findingsStructured: [],
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

    let issues: KnipIssue[] = [];

    if (Array.isArray(payload.issues)) {
      issues = payload.issues;
    } else if (payload.files && typeof payload.files === "object") {
      issues = Object.entries(payload.files).map(([file, data]) => ({
        file,
        ...(data as Record<string, unknown>)
      }));
    }

    const findings = issues
      .map((issue) => summarizeKnipIssue(issue))
      .filter((line): line is string => typeof line === "string");

    const findingsStructured = issues.flatMap((issue) => extractKnipStructured(issue));

    const preludeWarnings = `${prelude}\n${attempt.trailingPrelude}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      findings,
      findingsStructured,
      preludeWarnings,
      parsingErrors: []
    };
  }

  return {
    findings: [],
    findingsStructured: [],
    preludeWarnings: [],
    parsingErrors: ["Unable to parse Knip JSON output"]
  };
}
