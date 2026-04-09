---
name: deadclean
description: Run safe dead-code cleanup for Python projects using Ruff and Vulture through the deadclean CLI. Use when asked to remove unused code, run Ruff/Vulture, clean up after vibe coding, or produce concise dead-code findings for AI agents.
---

# deadclean

Use `deadclean` as the default surface for dead-code cleanup.
Prefer safe automated fixes (`ruff --fix`) plus explicit review of Vulture findings.

## Core Workflow
1. Check environment status.
2. Run scan with safe defaults.
3. Apply optional safe fixes.
4. Review findings before deletion.

```bash
deadclean doctor
deadclean .
deadclean . --fix
deadclean . --strict
```

## Command Map
- `deadclean [path]` run Ruff + Vulture scan.
- `deadclean [path] --fix` apply safe Ruff fixes first, then scan.
- `deadclean [path] --strict` fail with non-zero exit when findings remain.
- `deadclean [path] --json` emit structured output for agents.
- `deadclean install-tools --method auto` install Ruff/Vulture (tries `uv`, `pipx`, then `pip`).
- `deadclean doctor` inspect tool availability.

## Safety Rules
- Do not delete Vulture-reported items without user confirmation.
- Treat Vulture output as candidate dead code, not guaranteed safe deletion.
- Use `--strict` in CI for enforcement without automatic removals.

## Recommended Patterns
- Post-agent coding cleanup:
```bash
deadclean . --fix --strict
```

- Scan a specific project:
```bash
deadclean /path/to/project --min-confidence 100
```

- Force machine-readable output:
```bash
deadclean . --json
```
