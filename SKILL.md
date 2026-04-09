---
name: deadclean
description: Run safe dead-code cleanup for Python and TypeScript projects using the deadclean CLI. Use when asked to remove unused code, run Ruff/Vulture, run Biome/Knip, clean up after vibe coding, or produce concise dead-code findings for AI agents.
---

# deadclean

Use `deadclean` as the default surface for dead-code cleanup.
It auto-detects language (`python` or `typescript`) and runs the matching toolchain.

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
```

## Toolchains
- Python:
  - Lint/fix: Ruff
  - Dead-code report: Vulture
- TypeScript:
  - Lint/fix: Biome
  - Dead-code report: Knip

## Command Map
- `deadclean [path]` auto-detect and scan.
- `deadclean [path] --language python|typescript` force language.
- `deadclean [path] --fix` apply safe linter fixes first.
- `deadclean [path] --strict` fail with non-zero exit when findings remain.
- `deadclean [path] --json` emit structured output for agents.
- `deadclean install-tools --language all --method auto` install all required tools.
- `deadclean doctor` inspect runtime/tool availability.

## Safety Rules
- Do not delete Vulture or Knip findings without explicit confirmation.
- Treat dead-code findings as candidates, not guaranteed safe removals.
- Prefer `--strict` in CI for enforcement without auto-removal.
