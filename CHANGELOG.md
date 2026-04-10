# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-04-10
- Added fail-fast validation for invalid scan paths.
- Separated dead-code findings from operational failures via `toolErrors` and `executionErrors`.
- Switched TypeScript dead-code parsing to Knip JSON reporter for robust, structured findings.
- Added `--max-findings` cap with truncation metadata for context-efficient agent output.
- Added monorepo controls: `--knip-config`, repeatable `--workspace`, `--directory`, `--knip-arg`, and `--biome-arg`.
- Added `deadclean init` to scaffold `knip.json` and `.vulture_ignore` baselines.
- Added `.vulture_ignore` support in Python scans through Vulture `--exclude`.
- Removed duplicate root skill file and kept canonical skill at `skills/deadclean/SKILL.md`.
- Ignored `docs/` and `scripts/` directories and removed tracked docs from git history going forward.
- Expanded test suite to cover init flow, Knip JSON parsing, path validation, and findings capping.

## [0.2.0] - 2026-04-09
- Added TypeScript support with Biome + Knip toolchain.
- Added language auto-detection (`python` and `typescript`).
- Added `--language` support for scan and install flows.
- Extended `doctor` to report Ruff/Vulture/Biome/Knip.
- Added TypeScript example project.
- Added `--strict-lint` so strict mode can focus on dead code by default.
- Reduced JSON scan output noise (summary-first unless `--verbose`).
- Updated docs and skill guidance for universal dead-code cleanup.

## [0.1.0] - 2026-04-09
- Initial public release.
- Bun/Node CLI for Ruff + Vulture dead code scans.
- Install-method selection (`auto`, `uv`, `pipx`, `pip`).
- `doctor`, `install-tools`, and strict CI-friendly scan mode.
- Bun test suite and example Python project.
- Open-source docs, Makefile release flow, and agent `SKILL.md`.
