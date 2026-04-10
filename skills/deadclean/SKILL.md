---
name: deadclean
description: Run safe dead-code cleanup for Python and TypeScript projects using the deadclean CLI. Use when asked to remove unused code, run Ruff/Vulture, run Biome/Knip, clean up after vibe coding, bootstrap Knip/Vulture config, or produce concise dead-code findings for AI agents.
---

# deadclean

Use `deadclean` as the default surface for dead-code cleanup.
It auto-detects language (`python` or `typescript`) and runs the matching toolchain.
Supports polyglot monorepos with `--language all`.

## Core Workflow
1. Check tool availability.
2. Run report-only scan.
3. Run safe fix mode if requested.
4. Review deep dead-code findings before deletion.

```bash
deadclean doctor
deadclean .
deadclean . --fix
deadclean . --strict
deadclean init . --language all
```

## Toolchains
- Python:
  - Lint/fix: Ruff
  - Dead-code report: Vulture
  - Supports `.vulture_ignore` exclude patterns.
- TypeScript:
  - Lint/fix: Biome
  - Dead-code report: Knip JSON reporter (structured parsing).

## Command Map
- `deadclean [path]` auto-detect and scan.
- `deadclean [path] --language python|typescript|all` force language (all = polyglot).
- `deadclean [path] --fix` apply safe linter fixes first.
- `deadclean [path] --fix --fix-rounds 5` iterative fix (up to 5 rounds).
- `deadclean [path] --strict` fail when dead-code findings remain.
- `deadclean [path] --strict --strict-lint` fail on both dead-code and lint findings.
- `deadclean [path] --max-findings <n>` cap reported findings for agent-context efficiency.
- `deadclean [path] --min-confidence <0-100>` Vulture confidence threshold (default: 80).
- `deadclean [path] --knip-config <path> --workspace <name> --directory <dir>` monorepo-focused Knip control.
- `deadclean [path] --knip-arg <arg> --biome-arg <arg> --ruff-arg <arg> --vulture-arg <arg>` pass-through args.
- `deadclean [path] --exclude <pattern>` file/directory exclusion (repeatable).
- `deadclean [path] --diff-base main` only scan files changed vs main.
- `deadclean [path] --staged` only scan staged files.
- `deadclean [path] --json` emit structured JSON output.
- `deadclean [path] --sarif` emit SARIF output for GitHub Code Scanning.
- `deadclean [path] --output-file <path>` write output to file.
- `deadclean [path] --summary` one-line summary output.
- `deadclean [path] --quiet` suppress non-essential output.
- `deadclean baseline save [path]` record current findings as accepted baseline.
- `deadclean baseline check [path] --strict` only flag NEW dead code not in baseline.
- `deadclean install-tools --language all --method auto` install all required tools.
- `deadclean init [path] --language auto|python|typescript|all [--force]` scaffold `knip.json` and/or `.vulture_ignore`.
- `deadclean doctor` inspect runtime/tool availability.
- `deadclean doctor --strict` exit 1 if any tools missing.

## Config File

Place `.deadclean.json` or `deadclean.json` in project root. CLI args take precedence.

```json
{
  "language": "auto",
  "minConfidence": 80,
  "maxFindings": 200,
  "exclude": ["**/generated/**"]
}
```

## JSON Output Example

```json
{
  "path": "/path/to/project",
  "language": "python",
  "lintTool": "ruff",
  "deadCodeTool": "vulture",
  "lintIssueCount": 0,
  "fixedCount": 0,
  "deadCodeFindingCount": 2,
  "deadCodeFindings": [
    "app.py:7 unused function 'dead_helper' (60% confidence)",
    "utils.py:9 unused function 'ghost_function' (60% confidence)"
  ],
  "deadCodeFindingsStructured": [
    {
      "file": "app.py",
      "line": 7,
      "message": "unused function 'dead_helper' (60% confidence)",
      "tool": "vulture",
      "category": "unused_code",
      "name": null,
      "confidence": 60,
      "severity": "high"
    },
    {
      "file": "utils.py",
      "line": 9,
      "message": "unused function 'ghost_function' (60% confidence)",
      "tool": "vulture",
      "category": "unused_code",
      "name": null,
      "confidence": 60,
      "severity": "high"
    }
  ],
  "deadCodeFindingsByFile": {
    "app.py": [
      { "file": "app.py", "line": 7, "message": "unused function 'dead_helper' (60% confidence)", "tool": "vulture", "category": "unused_code", "name": null, "confidence": 60, "severity": "high" }
    ],
    "utils.py": [
      { "file": "utils.py", "line": 9, "message": "unused function 'ghost_function' (60% confidence)", "tool": "vulture", "category": "unused_code", "name": null, "confidence": 60, "severity": "high" }
    ]
  },
  "elapsedMs": 234,
  "timestamp": "2026-04-10T12:00:00.000Z",
  "status": "findings",
  "exitCode": 0,
  "toolVersions": {
    "ruff": "0.15.10",
    "vulture": "2.16",
    "biome": null,
    "knip": null
  },
  "filesScanned": null,
  "filesWithIssues": 2,
  "displayedDeadCodeFindingCount": 2,
  "findingsTruncated": false,
  "toolErrors": [],
  "executionErrors": []
}
```

## Safety Rules
- Do not delete Vulture or Knip findings without explicit confirmation.
- Treat dead-code findings as candidates, not guaranteed safe removals.
- Prefer `--strict` in CI; add `--strict-lint` only when lint gating is desired.
- Operational tool failures are reported separately from findings and should be resolved first.
- Child processes are killed on SIGINT/SIGTERM to prevent orphaned processes.
