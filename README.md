```text
deadclean
safe dead-code cleanup for AI coding sessions
python + typescript support | ruff/vulture + biome/knip
```

## Why?

- One command for dead-code cleanup across Python and TypeScript projects.
- Auto-detects project language (`python` or `typescript`).
- Safe fix-first behavior:
  - Python: Ruff `--fix`
  - TypeScript: Biome fix mode
- Deep dead-code reporting:
  - Python: Vulture
  - TypeScript: Knip
- AI-friendly text and JSON output modes.

## Installation

```bash
npm install -g @light-merlin-dark/deadclean
```

## Tool Setup

Install language tools through `deadclean`:

```bash
# Install both Python + TypeScript tools
deadclean install-tools --language all --method auto

# Python only (auto tries uv -> pipx -> pip)
deadclean install-tools --language python --method auto

# TypeScript only (uses npm)
deadclean install-tools --language typescript --method auto
```

## Quick Start

```bash
# Check environment
deadclean doctor

# Auto-detect language and scan
deadclean .

# Safe auto-fixes before scan
deadclean . --fix

# Force TypeScript mode
deadclean ./apps/web --language typescript

# Force Python mode
deadclean ./services/api --language python

# CI mode
deadclean . --strict

# JSON for agents
deadclean . --json
```

## Command Surface

### `deadclean [path] [options]`
Default `scan` command.

Options:
- `--language <auto|python|typescript>` choose or auto-detect language.
- `--fix` run safe auto-fixes before scanning.
- `--min-confidence <0-100>` Vulture threshold for Python scans.
- `--ensure-tools` install missing tools before scan.
- `--install-method <auto|uv|pipx|pip|npm>` install strategy for `--ensure-tools`.
- `--strict` exit non-zero if lint/dead-code findings remain.
- `--verbose` include raw tool output.
- `--json` machine-readable output.
- `--ruff-bin`, `--vulture-bin`, `--biome-bin`, `--knip-bin` override tool binaries.

### `deadclean doctor`
Shows runtime and tool status (Node/Bun, Ruff, Vulture, Biome, Knip).

### `deadclean install-tools [path]`
Installs required tools.

Options:
- `--language <auto|python|typescript|all>` target language toolchain.
- `--method <auto|uv|pipx|pip|npm>` install method.

## Example Projects

- Python sample: [`examples/python-vibe-sample`](examples/python-vibe-sample)
- TypeScript sample: [`examples/typescript-vibe-sample`](examples/typescript-vibe-sample)

```bash
deadclean ./examples/python-vibe-sample --fix --language python
deadclean ./examples/typescript-vibe-sample --fix --language typescript
```

## Development

```bash
bun install
bun test
bun run lint
bun run build
node dist/index.js --help
```

## Safety Model

- `--fix` applies only linter-safe changes (Ruff/Biome).
- Deep dead-code tools (Vulture/Knip) are report-only.
- Use `--strict` in CI to enforce cleanup without auto-deleting code.

## License

MIT
