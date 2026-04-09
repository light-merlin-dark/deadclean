# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-04-09
- Added TypeScript support with Biome + Knip toolchain.
- Added language auto-detection (`python` and `typescript`).
- Added `--language` support for scan and install flows.
- Extended `doctor` to report Ruff/Vulture/Biome/Knip.
- Added TypeScript example project.
- Updated docs and skill guidance for universal dead-code cleanup.

## [0.1.0] - 2026-04-09
- Initial public release.
- Bun/Node CLI for Ruff + Vulture dead code scans.
- Install-method selection (`auto`, `uv`, `pipx`, `pip`).
- `doctor`, `install-tools`, and strict CI-friendly scan mode.
- Bun test suite and example Python project.
- Open-source docs, Makefile release flow, and agent `SKILL.md`.
