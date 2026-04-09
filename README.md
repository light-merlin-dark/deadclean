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
- Output is compact and AI-agent-friendly in both text and JSON modes.

## Toolchains

### Python
- Lint and safe fixes: `ruff`
- Deep dead-code report: `vulture --min-confidence=100`

### TypeScript
- Lint and safe fixes: `biome lint`
- Deep dead-code report: `knip`

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
- `--ensure-tools` install missing tools before scan.
- `--install-method <auto|uv|pipx|pip|npm>` install strategy for `--ensure-tools`.
- `--strict` fail on dead-code findings.
- `--strict-lint` include lint findings in strict exit behavior.
- `--verbose` include raw tool output in text/JSON output.
- `--json` machine-readable output.
- `--ruff-bin`, `--vulture-bin`, `--biome-bin`, `--knip-bin` override tool binaries.

### `deadclean doctor`
Shows runtime and tool status (`Node`, `Bun`, `Ruff`, `Vulture`, `Biome`, `Knip`).

### `deadclean install-tools [path]`
Installs required toolchains.
- Python install methods: `auto -> uv -> pipx -> pip`
- TypeScript install methods: `auto -> npm`
- `--language <auto|python|typescript|all>` target language toolchain.
- `--method <auto|uv|pipx|pip|npm>` install method.

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

## Safety Model

- `--fix` applies only linter-safe changes (Ruff/Biome).
- Deep dead-code tools (Vulture/Knip) are report-only.
- Use `--strict` for dead-code gating and add `--strict-lint` if lint gating is also required.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built by [Robert E. Beckner III (Merlin)](https://rbeckner.com)
