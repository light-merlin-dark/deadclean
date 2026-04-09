```
██████╗ ███████╗ █████╗ ██████╗  ██████╗██╗     ███████╗ █████╗ ███╗   ██╗
██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝██║     ██╔════╝██╔══██╗████╗  ██║
██║  ██║█████╗  ███████║██║  ██║██║     ██║     █████╗  ███████║██╔██╗ ██║
██║  ██║██╔══╝  ██╔══██║██║  ██║██║     ██║     ██╔══╝  ██╔══██║██║╚██╗██║
██████╔╝███████╗██║  ██║██████╔╝╚██████╗███████╗███████╗██║  ██║██║ ╚████║
╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝

Safe dead-code cleanup for AI coding sessions
Ruff + Vulture wrapper • Agent-friendly output • Install-method aware
```

## Why?

- One command to run Ruff and Vulture with sane defaults.
- Keeps auto-fixes safe: only Ruff `--fix` runs automatically.
- Vulture findings are reported, never auto-deleted.
- Output is compact and consistent for AI agents and CI logs.
- Supports multiple tool install methods (`auto`, `uv`, `pipx`, `pip`).

## Installation

```bash
npm install -g @light-merlin-dark/deadclean
```

Then install required Python tools your way:

```bash
# Auto (tries uv -> pipx -> pip)
deadclean install-tools --method auto

# Explicit method
deadclean install-tools --method uv
deadclean install-tools --method pipx
deadclean install-tools --method pip
```

## Quick Start

```bash
# Check environment
deadclean doctor

# Scan only (no edits)
deadclean .

# Safe Ruff fixes first, then scan
deadclean . --fix

# CI mode: fail if findings remain
deadclean . --strict

# JSON output for agents and automation
deadclean . --json
```

## Command Surface

### `deadclean [path] [options]`
Default `scan` command.

Options:
- `--fix` run safe Ruff auto-fixes before scanning.
- `--min-confidence <0-100>` Vulture threshold (default `100`).
- `--ensure-tools` install missing tools before scan.
- `--install-method <auto|uv|pipx|pip>` installation strategy when used with `--ensure-tools`.
- `--strict` exit non-zero if Ruff or Vulture findings remain.
- `--verbose` include raw Ruff/Vulture output.
- `--json` machine-readable output.
- `--ruff-bin <name>` override Ruff binary.
- `--vulture-bin <name>` override Vulture binary.

### `deadclean doctor`
Shows runtime and tool status (Node/Bun, Ruff, Vulture).

### `deadclean install-tools`
Installs Ruff and Vulture globally using the selected method.

## Example Project

A tiny demo project is included at [`examples/python-vibe-sample`](examples/python-vibe-sample) so you can test behavior quickly:

```bash
deadclean ./examples/python-vibe-sample --fix
```

## Development

```bash
# install deps
bun install

# run tests
bun test

# build
bun run build

# run built CLI
node dist/index.js --help
```

## Publishing

Use the included Makefile targets:

```bash
make check-auth
make pre-publish
make publish
```

See [`docs/publishing.md`](docs/publishing.md) for the full release checklist.

## Safety Model

- Ruff `--fix` is limited to safe linter fixes.
- Vulture is report-only and must be manually reviewed.
- `--strict` helps enforce cleanup in CI without auto-removal.

## License

MIT
