---
name: deadclean
description: Run safe dead-code cleanup for Python and TypeScript projects using the deadclean CLI. Use when asked to remove unused code, run Ruff/Vulture, run Biome/Knip, clean up after vibe coding, bootstrap Knip/Vulture config, or produce concise dead-code findings for AI agents.
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
- `deadclean [path] --language python|typescript` force language.
- `deadclean [path] --fix` apply safe linter fixes first.
- `deadclean [path] --strict` fail when dead-code findings remain.
- `deadclean [path] --strict --strict-lint` fail on both dead-code and lint findings.
- `deadclean [path] --max-findings <n>` cap reported findings for agent-context efficiency.
- `deadclean [path] --knip-config <path> --workspace <name> --directory <dir>` monorepo-focused Knip control.
- `deadclean [path] --knip-arg <arg> --biome-arg <arg>` pass-through args for advanced workflows.
- `deadclean [path] --json` emit structured output for agents.
- `deadclean install-tools --language all --method auto` install all required tools.
- `deadclean init [path] --language auto|python|typescript|all [--force]` scaffold `knip.json` and/or `.vulture_ignore`.
- `deadclean doctor` inspect runtime/tool availability.

## Safety Rules
- Do not delete Vulture or Knip findings without explicit confirmation.
- Treat dead-code findings as candidates, not guaranteed safe removals.
- Prefer `--strict` in CI; add `--strict-lint` only when lint gating is desired.
- Operational tool failures are reported separately from findings and should be resolved first.
