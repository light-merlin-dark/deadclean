```text
deadclean
safe dead-code cleanup for AI coding sessions
python + typescript support | ruff/vulture + biome/knip
```

## Why?

- One command for dead-code cleanup across Python and TypeScript projects.
- Language-aware behavior with auto-detection (`python` or `typescript`).
- Safe auto-fix flow for lint-level issues only.
- Deep dead-code reporting stays review-first (no automatic deletions).
- Operational errors are separated from findings for safer agent decisions.
- Output is compact and AI-agent-friendly in both text and JSON modes.

## Toolchains

### Python
- Lint and safe fixes: `ruff`
- Deep dead-code report: `vulture --min-confidence=100`

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

## Quick Start

```bash
# Check environment and tool availability
deadclean doctor

# Auto-detect language and scan current project
deadclean .

# Safe auto-fixes before scan
deadclean . --fix

# Scaffold baseline config files
deadclean init . --language all

# CI-style dead-code gate
deadclean . --strict

# CI-style lint + dead-code gate
deadclean . --strict --strict-lint

# JSON output for agents and automation
deadclean . --json
```

## Core Commands

### `deadclean [path] [options]`
Default language-aware scan command.

Options
- `--language <auto|python|typescript>` choose or auto-detect language.
- `--fix` run safe auto-fixes before scanning.
- `--min-confidence <0-100>` Vulture threshold for Python scans.
- `--max-findings <n>` cap findings for context efficiency (`0` disables cap).
- `--ensure-tools` install missing tools before scan.
- `--install-method <auto|uv|pipx|pip|npm>` install strategy for `--ensure-tools`.
- `--knip-config <path>` custom Knip config path.
- `--workspace <filter>` Knip workspace filter (repeatable).
- `--directory <path>` Knip directory scope.
- `--knip-arg <arg>` pass-through Knip arg (repeatable).
- `--biome-arg <arg>` pass-through Biome arg (repeatable).
- `--strict` fail on dead-code findings.
- `--strict-lint` include lint findings in strict exit behavior.
- `--verbose` include raw tool output in text/JSON output.
- `--json` machine-readable output.
- `--ruff-bin`, `--vulture-bin`, `--biome-bin`, `--knip-bin` override tool binaries.

### `deadclean doctor`
Shows runtime and tool status (`Node`, `Bun`, `Ruff`, `Vulture`, `Biome`, `Knip`).

### `deadclean init [path]`
Creates baseline cleanup config files.
- `knip.json` for TypeScript projects.
- `.vulture_ignore` for Python projects.
- `--language <auto|python|typescript|all>` target language toolchain.
- `--force` overwrite existing files.

### `deadclean install-tools [path]`
Installs required toolchains.
- Python install methods: `auto -> uv -> pipx -> pip`
- TypeScript install methods: `auto -> npm`
- `--language <auto|python|typescript|all>` target language toolchain.
- `--method <auto|uv|pipx|pip|npm>` install method.

## Output Model

- `deadCodeFindings`: actionable dead/unused code candidates.
- `toolErrors`: binary/tool availability failures.
- `executionErrors`: runtime/toolchain execution failures (kept separate from findings).
- `findingsTruncated`: true when findings were capped by `--max-findings`.

## Exit Codes

- `0`: scan completed (and if strict mode enabled, no strict violations).
- `1`: strict mode violation (`--strict` / `--strict-lint`).
- `2`: operational failure (`toolErrors` or `executionErrors`).

## Effective Usage Pattern

1. Run report-only scan.
2. Review dead-code findings.
3. Run `--fix` for safe linter cleanup.
4. Re-run with `--strict` (and optional `--strict-lint`) before merging.

## Example Projects

- Python sample: [`examples/python-vibe-sample`](examples/python-vibe-sample)
- TypeScript sample: [`examples/typescript-vibe-sample`](examples/typescript-vibe-sample)

```bash
deadclean ./examples/python-vibe-sample --fix --language python
deadclean ./examples/typescript-vibe-sample --fix --language typescript
```

## Monorepo Examples

```bash
# Scan a workspace only
deadclean . --language typescript --workspace apps/web

# Use custom Knip config and directory
deadclean . --language typescript --knip-config knip.json --directory apps/web

# Pass custom flags through to Knip/Biome
deadclean . --language typescript --knip-arg --include --knip-arg files,exports --biome-arg --files-ignore-unknown
```

## Development

```bash
# install deps
bun install

# run tests
bun test

# type-check
bun run lint

# build
bun run build

# run CLI
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

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built by [Robert E. Beckner III (Merlin)](https://rbeckner.com)
