import type { CommandResult, VultureFinding } from "./types";

const RUFF_SUMMARY_PATTERN = /Found\s+(\d+)\s+errors?/i;
const RUFF_FIXED_PATTERN = /\((\d+)\s+fixed,\s*(\d+)\s+remaining\)/i;
const RUFF_PATH_LINE_PATTERN = /^.+:\d+:\d+:/;

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
