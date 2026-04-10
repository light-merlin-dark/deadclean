```text
█████╗ ███████╗ █████╗ ██████╗  ██████╗██╗     ███████╗ █████╗ ███╗   ██╗
██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝██║     ██╔════╝██╔══██╗████╗  ██║
██║  ██║█████╗  ███████║██║  ██║██║     ██║     █████╗  ███████║██╔██╗ ██║
██║  ██║██╔══╝  ██╔══██║██║  ██║██║     ██║     ██╔══╝  ██╔══██║██║╚██╗██║
█████╔╝███████╗██║  ██║██████╔╝╚██████╗███████╗███████╗██║  ██║██║ ╚████║
╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝

One-command dead code cleanup for fast-moving projects
Developer-first • Review-safe • Agent-ready
```

## Why?

- One command for dead-code cleanup across Python and TypeScript projects.
- Language-aware behavior with auto-detection (`python` or `typescript`).
- Polyglot/monorepo support: scan both languages in one pass with `--language all`.
- Safe auto-fix flow for lint-level issues only.
- Deep dead-code reporting stays review-first (no automatic deletions).
- Structured JSON output with per-file grouping, tool versions, and timestamps.
- SARIF output for native GitHub Code Scanning integration.
- Config file support (`.deadclean.json`) for project-specific defaults.
- Baseline management for incremental dead-code cleanup.
- Changed-files-only scanning with `--diff-base` and `--staged`.
- Operational errors are separated from findings for safer agent decisions.
- Output is compact and AI-agent-friendly in text, JSON, and SARIF modes.

## Toolchains

### Python
- Lint and safe fixes: `ruff`
- Deep dead-code report: `vulture --min-confidence=80` (configurable)

### TypeScript
- Lint and safe fixes: `biome lint`
- Deep dead-code report: `knip --reporter json`

## Installation

```bash
npm install -g @light-merlin-dark/deadclean
```

## One-Time Tool Setup

Install all required language tools:

```bash
deadclean install-tools --language all --method auto
```

Supports `uv`, `pipx`, `pip` for Python; `npm`, `bun` for TypeScript.

## Quick Start

```bash
deadclean doctor
deadclean .
deadclean . --fix
deadclean . --json
deadclean . --strict
deadclean . --summary
deadclean init . --language all
```

## Core Commands

### `deadclean [path] [options]`
Default language-aware scan command.

**Language & Scope**
- `--language <auto|python|typescript|all>` choose or auto-detect language.
- `--diff-base <ref>` only scan files changed vs git ref.
- `--staged` only scan staged files.
- `--exclude <pattern>` file/directory exclusion (repeatable).

**Fix & Iteration**
- `--fix` run safe auto-fixes before scanning.
- `--fix-rounds <n>` iterative fix rounds (default: 1, 0=until convergence).

**Findings Control**
- `--min-confidence <0-100>` Vulture threshold (default: 80).
- `--max-findings <n>` cap findings (`0` disables cap, default: 200).

**Tool Management**
- `--ensure-tools` install missing tools before scan.
- `--install-method <auto|uv|pipx|pip|npm|bun>` install strategy.
- `--knip-config <path>` custom Knip config path.
- `--workspace <filter>` Knip workspace filter (repeatable).
- `--directory <path>` Knip directory scope.
- `--knip-arg <arg>` pass-through Knip arg (repeatable).
- `--biome-arg <arg>` pass-through Biome arg (repeatable).
- `--ruff-arg <arg>` pass-through Ruff arg (repeatable).
- `--vulture-arg <arg>` pass-through Vulture arg (repeatable).

**Output**
- `--json` machine-readable JSON output.
- `--sarif` SARIF output for GitHub Code Scanning.
- `--output <text|json|sarif>` explicit output mode.
- `--output-file <path>` write output to file.
- `--summary` one-line summary output.
- `--quiet` suppress non-essential output.
- `--verbose` include raw tool output.

**Strictness**
- `--strict` fail on dead-code findings.
- `--strict-lint` include lint findings in strict exit behavior.

**Binary Overrides**
- `--ruff-bin`, `--vulture-bin`, `--biome-bin`, `--knip-bin`.

### `deadclean doctor`
Shows runtime and tool status with readiness check.
- `--strict` exit 1 if any required tools are missing.

### `deadclean init [path]`
Creates baseline cleanup config files.
- `knip.json` for TypeScript projects.
- `.vulture_ignore` for Python projects.
- `--language <auto|python|typescript|all>` target language.
- `--force` overwrite existing files.

### `deadclean install-tools [path]`
Installs required toolchains.
- `--language <auto|python|typescript|all>` target language.
- `--method <auto|uv|pipx|pip|npm|bun>` install method.

### `deadclean baseline save [path]`
Record current findings as accepted baseline.

### `deadclean baseline check [path]`
Compare current findings against saved baseline (only new findings flagged).

## Config File

Place `.deadclean.json` or `deadclean.json` in your project root. CLI args take precedence.

```json
{
  "language": "auto",
  "minConfidence": 80,
  "maxFindings": 200,
  "fix": false,
  "fixRounds": 1,
  "strict": false,
  "strictLint": false,
  "exclude": ["**/generated/**", "**/migrations/**"],
  "knipConfig": null,
  "workspaces": [],
  "diffBase": null
}
```

## JSON Output Fields

| Field | Description |
|-------|-------------|
| `status` | `clean`, `findings`, or `error` |
| `exitCode` | Computed exit code (0/1/2) |
| `timestamp` | ISO 8601 timestamp |
| `toolVersions` | Versions of ruff, vulture, biome, knip |
| `deadCodeFindings` | Array of human-readable findings |
| `deadCodeFindingsStructured` | Array of structured finding objects |
| `deadCodeFindingsByFile` | Findings grouped by file path |
| `filesWithIssues` | Count of files containing findings |
| `findingsTruncated` | Whether findings were capped |

### Structured Finding Object

```json
{
  "file": "src/utils.ts",
  "line": 15,
  "message": "unused export: oldHelper",
  "tool": "knip",
  "category": "exports",
  "name": "oldHelper",
  "confidence": null,
  "severity": "high"
}
```

## Output Model

- `deadCodeFindings`: actionable dead/unused code candidates.
- `deadCodeFindingsStructured`: structured objects with file, line, tool, category, name, severity.
- `toolErrors`: binary/tool availability failures.
- `executionErrors`: runtime/toolchain execution failures (kept separate from findings).
- `findingsTruncated`: true when findings were capped by `--max-findings`.
- `status`: computed scan status (`clean`, `findings`, `error`).
- `exitCode`: computed exit code in JSON for agent consumption.

## Exit Codes

- `0`: scan completed (and if strict mode enabled, no strict violations).
- `1`: strict mode violation (`--strict` / `--strict-lint`).
- `2`: operational failure (`toolErrors` or `executionErrors`).

## Effective Usage Pattern

1. Run report-only scan.
2. Review dead-code findings.
3. Run `--fix` for safe linter cleanup.
4. Re-run with `--strict` (and optional `--strict-lint`) before merging.

## Monorepo Examples

```bash
# Scan both Python and TypeScript in one pass
deadclean . --language all

# Scan a workspace only
deadclean . --language typescript --workspace apps/web

# Only scan files changed vs main branch
deadclean . --diff-base main

# Only scan staged files (pre-commit hook)
deadclean . --staged

# One-line summary for quick checks
deadclean . --summary

# SARIF output for GitHub
deadclean . --output sarif --output-file results.sarif

# Baseline workflow for incremental cleanup
deadclean baseline save . --language python
deadclean baseline check . --language python --strict

# Iterative fix
deadclean . --fix --fix-rounds 5
```

## Example Projects

- Python sample: [`examples/python-vibe-sample`](examples/python-vibe-sample)
- TypeScript sample: [`examples/typescript-vibe-sample`](examples/typescript-vibe-sample)

```bash
deadclean ./examples/python-vibe-sample --fix --language python
deadclean ./examples/typescript-vibe-sample --fix --language typescript
```

## GitHub Actions

```yaml
- uses: light-merlin-dark/deadclean@main
  with:
    path: .
    strict: true
```

## Development

```bash
bun install
bun test
bun run lint
bun run build
node dist/index.js --help
```

## Publishing

```bash
make pre-publish
make publish
```

## Safety Model

- `--fix` applies only linter-safe changes (Ruff/Biome).
- Deep dead-code tools (Vulture/Knip) are report-only.
- Use `--strict` for dead-code gating and add `--strict-lint` if lint gating is also required.
- Child process timeout (120s) prevents indefinite hangs.
- SIGINT/SIGTERM cleanup kills orphaned child processes.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built by [Robert E. Beckner III (Merlin)](https://rbeckner.com)
