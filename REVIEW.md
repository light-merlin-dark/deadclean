# deadclean Comprehensive Review & Optimization Plan

> Session: 2026-04-10 | Version reviewed: 0.3.0 | Reviewer: CTO + Engineer mode

---

## Executive Summary

deadclean is a clean, focused CLI that wraps Ruff/Vulture (Python) and Biome/Knip (TypeScript) for one-command dead code cleanup. The codebase is ~1,000 lines of TypeScript across 11 source files with 99-line average per module. The architecture is solid: dependency injection via `CommandRunner`, separated concerns (scan, parse, format, install), and a clean `ScanReport` type.

**The project has strong bones.** This document identifies where it falls short for production-grade agent usage and where targeted investment will compound value.

---

## P0: Critical Issues (Broken or Misleading Behavior)

### 1. Python example finds ZERO dead code with default settings

The Python vibe sample contains `dead_helper()`, `ghost_function()`, and `normalize()` — all genuinely unused. But Vulture classifies these at **60% confidence**, not 100%. With `--min-confidence=100` (the default), the scan reports 0 findings.

**Impact:** The example project — the first thing users try — silently fails to demonstrate the tool's core value. Agents running with defaults miss real dead code.

```
# With default (min-confidence=100):
$ deadclean ./examples/python-vibe-sample --language python
dead_code_findings: 0   # <- wrong

# Without min-confidence filter:
$ vulture ./examples/python-vibe-sample
app.py:7: unused function 'dead_helper' (60% confidence)
utils.py:4: unused function 'normalize' (60% confidence)
utils.py:9: unused function 'ghost_function' (60% confidence)
```

**Fix options:**
- Lower default `--min-confidence` to 80 (catches most real dead code while keeping noise manageable)
- Or change default to 0 (let Vulture report everything, let agents filter)
- Update example project to include code that Vulture flags at 100% confidence
- Document the confidence threshold prominently in README and JSON output

### 2. TypeScript example doesn't detect the unused `deadFunction()`

Knip reports only `package.json [binaries:1]` (the `tsc` devDependency), not the actual unused export `deadFunction()` in `src/index.ts`. This happens because the example has no `knip.json` config, so Knip can't determine proper entry points.

**Impact:** Both example projects fail to demonstrate meaningful dead-code detection.

**Fix:**
- Add a `knip.json` to the TypeScript example with proper entry config
- Or have `init` auto-detect and create config before first scan in examples
- Document that Knip requires configuration for accurate results

### 3. `deadclean scan --help` crashes with "Unknown option '--help'"

The help flag only works as `deadclean --help`, not on subcommands.

```
$ deadclean scan --help
Error: Unknown option '--help'   # <- should show scan-specific help
$ deadclean init --help
Error: Unknown option '--help'   # <- same
```

**Impact:** Every user who tries `deadclean scan --help` gets an error. Agents that programmatically check subcommand help get a crash.

**Fix:** Route `--help`/`-h` inside each subcommand's argument parser to print context-specific help.

---

## P1: Agent-Critical Gaps (Missing Capabilities for Production Agent Use)

### 4. No child process timeout — CLI hangs forever on stuck tools

`RealCommandRunner.spawn()` has no timeout. If Knip hangs analyzing a huge monorepo or Ruff encounters an infinite loop on malformed code, the CLI blocks indefinitely. For an agent tool, this is a reliability killer.

```typescript
// process.ts — currently no timeout
const child = spawn(command, args, { ... });
// If child never emits 'close', this Promise never resolves.
```

**Fix:** Add a configurable timeout (default 120s) using `AbortController` or a manual timer that calls `child.kill()`.

### 5. No polyglot/monorepo scan (`--language all` for scan)

`init` and `install-tools` support `--language all`, but the scan command only accepts `python` or `typescript`. A monorepo with both languages requires two separate scan invocations.

**Fix:** Add `"all"` to `LanguageMode` for scan, run both toolchains sequentially, and merge results into a unified `ScanReport`.

### 6. Structured Vulture findings are flattened to strings

Vulture findings are parsed into `{file, line, message}` objects, then immediately flattened to `"file:line message"` strings for the output. In JSON mode, agents lose the ability to programmatically process findings.

```json
// Current (flat strings):
"deadCodeFindings": ["app.py:7: unused function 'dead_helper' (60% confidence)"]

// Should be (structured):
"deadCodeFindings": [
  {"file": "app.py", "line": 7, "message": "unused function 'dead_helper'", "confidence": 60}
]
```

**Fix:** Add a `deadCodeFindingsStructured` field to JSON output, or make `deadCodeFindings` an array of objects when `--json` is used.

### 7. Knip finding detail is too lossy — individual symbol names discarded

The Knip parser summarizes to `file [category:count]` format but drops the actual symbol names. An agent sees `src/a.ts [exports:1]` but can't tell that the unused export is `unusedFn`.

```
Current: "src/a.ts [exports:1]"
Better:  "src/a.ts [exports: unusedFn]"
```

**Fix:** Include the actual names from Knip's JSON arrays in the summary.

### 8. No `--output-file` option

Agents often want scan results written to a file for later comparison or as artifacts. Currently they must capture stdout and handle the parsing themselves.

**Fix:** Add `--output-file <path>` that writes the formatted output to a file.

### 9. JSON output doesn't include exit code or aggregate status

An agent consuming JSON has to re-implement the exit code logic (check toolErrors, executionErrors, strict mode) to know if the scan "passed." The JSON payload should include a computed `status` or `exitCode` field.

```json
// Missing from current output:
"status": "findings",
"exitCode": 0
```

### 10. No config file support (`.deadclean.json` / `deadclean.config.json`)

All options are CLI-only. For CI and agent workflows, a config file would:
- Reduce argument noise
- Allow project-specific defaults (e.g., `minConfidence: 80`)
- Store accepted dead-code baselines
- Enable reproducible scans without argument memorization

**Fix:** Support a `deadclean.json` config file with option overrides. CLI args take precedence.

---

## P2: High-Value Optimizations (Significant Utility Gains)

### 11. Use structured JSON output from tools instead of regex parsing

**Ruff** supports `--output-format json`. **Biome** supports `--output-format json`. Currently both are parsed via regex patterns (`RUFF_SUMMARY_PATTERN`, `BIOME_SUMMARY_PATTERN`), which is fragile across tool versions.

```typescript
// Current: fragile regex
const RUFF_SUMMARY_PATTERN = /Found\s+(\d+)\s+errors?/i;

// Better: structured parsing
runner.run("ruff", ["check", path, "--output-format", "json"])
// Then: JSON.parse(result.stdout).length
```

**Fix:** Switch to JSON output mode for Ruff and Biome, parse structured results. Fall back to regex only if JSON parsing fails.

### 12. Add `--ruff-arg` and `--vulture-arg` pass-through

There's `--knip-arg` and `--biome-arg` for TypeScript but no equivalent for Python. This is asymmetric and limits Python flexibility (e.g., can't pass `--config` to Ruff or `--exclude` to Vulture).

### 13. Add `--diff-base` / `--staged` for changed-files-only scanning

Massive value for CI and agent workflows. Only scan files that changed relative to a base:

```bash
deadclean . --diff-base main          # Only files changed vs main
deadclean . --staged                  # Only staged files
deadclean . --diff-base HEAD~3       # Last 3 commits
```

**Implementation:** Use `git diff --name-only` to get changed files, then scope tool invocations.

### 14. Baseline management for accepted dead code

A `deadclean baseline` subcommand to save/compare accepted dead-code items:

```bash
deadclean baseline save    # Record current findings as baseline
deadclean baseline check   # Only flag NEW dead code not in baseline
```

This lets teams incrementally clean up without being overwhelmed by existing dead code.

### 15. Doctor should report readiness status and support `--strict`

Currently `doctor` always returns exit code 0 even if all tools are missing. For agent pre-flight checks:

```json
{
  "ready": false,
  "readyFor": { "python": false, "typescript": true },
  "missingTools": ["ruff", "vulture"]
}
```

`doctor --strict` should exit 1 if any tools required for the target language are missing.

### 16. Add `--fix-rounds` for iterative auto-fix

Some fixes create new fixable issues. Currently `--fix` runs once. Add `--fix-rounds N` (default 1) to iteratively fix until stable:

```bash
deadclean . --fix                    # Single pass (current behavior)
deadclean . --fix --fix-rounds 5     # Up to 5 rounds
deadclean . --fix --fix-rounds 0     # Until convergence
```

### 17. Signal handling (SIGINT/SIGTERM)

No signal handlers. Ctrl+C during a scan may leave orphaned child processes (ruff, vulture, biome, knip). For agents that might timeout and kill the process:

**Fix:** Register `process.on('SIGINT', ...)` / `process.on('SIGTERM', ...)` that kills all active child processes.

### 18. Knip/Biome `npx` fallback

Knip and Biome are often used via `npx` rather than global install. When `knip` or `biome` binary isn't found, should try `npx knip` / `npx biome` as a fallback before reporting "command not found."

### 19. Missing `bun` install method for TypeScript tools

The project uses Bun but only supports `npm` for TypeScript tool installation. Add `bun` as an install method:

```typescript
// install.ts — currently only supports npm for TS
const installResult = await runner.run("npm", ["install", "-g", ...]);
// Should also try: bun install -g @biomejs/biome knip
```

### 20. Add `--summary` one-line output mode

For quick agent consumption:

```
2 lint | 5 dead-code | 2 fixed | 0 errors | 612ms
```

```bash
deadclean . --summary
```

---

## P3: Code Quality & Robustness

### 21. Test coverage has major gaps

Current test files only cover:
- `scan.test.ts` — 4 tests with mock runner
- `parsers.test.ts` — 6 parser tests
- `init.test.ts` — 2 init tests
- `install.test.ts` — 3 install tests

**Missing tests:**
- CLI argument parsing (0 tests for the 611-line `cli.ts`)
- Language detection (`language.ts` — 0 tests)
- Format output (`format.ts` — 0 tests)
- Doctor command (`doctor.ts` — 0 tests)
- Edge cases: mixed-language projects, paths with spaces, Windows paths
- Integration/E2E tests against actual tools

### 22. `displayOutput` discards potentially useful output

```typescript
function mergeOutput(stdout: string, stderr: string): string {
  if (stdout.trim().length > 0) {
    return stdout;    // <- discards stderr entirely if stdout is non-empty
  }
  return stderr;
}
```

Some tools output useful information on both streams. This should combine them.

### 23. `packageVersion()` reads from filesystem at runtime

```typescript
function packageVersion(): string {
  const packagePath = resolve(__dirname, "..", "package.json");
  const raw = readFileSync(packagePath, "utf8");
  // ...
}
```

This breaks if the package is bundled or if `package.json` isn't adjacent to `dist/`. Should use build-time string replacement.

### 24. `ScanReport` contains redundant options

`report.options` embeds the full `ScanOptions`, duplicating `path`, `language`, etc. that are already top-level fields. This inflates JSON output and creates maintenance burden.

### 25. TypeScript lint target discovery is fragile

```typescript
const candidates = ["src", "src-tanstack", "app", "lib", "server", "client"]
```

Hardcoded directory names. Breaks for:
- Monorepos with `packages/*` structure
- Projects using `src/main`, `src/shared`
- Any non-standard layout

**Fix:** Also support `--lint-targets` option. Use Biome's own config as primary source.

### 26. No `--exclude` / `--ignore` for scan-level file exclusion

`.vulture_ignore` exists for Python, but there's no language-agnostic `--exclude` pattern for the scan command itself. TypeScript has no equivalent.

### 27. No quiet mode

`--verbose` exists but there's no `--quiet` for suppressing non-essential output (the "next" suggestions, formatting headers, etc.).

---

## P4: Agent Experience (EX) Polish

### 28. Include timestamp in JSON output

```json
"timestamp": "2026-04-10T14:32:00.000Z"
```

Essential for caching, comparison, and audit trails.

### 29. Include file count and file list in output

```json
"filesScanned": 47,
"filesWithIssues": 3
```

Helps agents assess scope and prioritize.

### 30. Add per-file grouping in JSON output

Instead of a flat findings array:

```json
"deadCodeFindingsByFile": {
  "src/utils.ts": [
    {"line": 15, "type": "export", "name": "unusedFn", "message": "unused export"}
  ]
}
```

### 31. Include tool versions in scan output

```json
"toolVersions": {
  "ruff": "0.15.10",
  "vulture": "2.16"
}
```

Critical for debugging inconsistent results across environments.

### 32. Normalize confidence/severity across tools

Vulture has confidence (0-100). Knip has categories. Should present a unified severity:

```json
{"severity": "high", "confidence": 100, "category": "unused_function"}
```

### 33. SARIF output format for GitHub integration

Add `--output sarif` for native GitHub Code Scanning integration. This would make deadclean immediately useful in any GitHub Actions CI pipeline.

### 34. GitHub Action

Provide `action.yml` for deadclean so teams can drop it into CI:

```yaml
- uses: light-merlin-dark/deadclean@main
  with:
    path: .
    strict: true
```

### 35. `deadclean check` — combined pre-commit gate

A single command that runs lint + deadcode + typecheck (for TS) as a pre-commit/pre-push gate. Currently requires multiple invocations.

---

## P5: Documentation & Usability

### 36. README doesn't document `-v`/`--version`

The `--version` flag works but isn't listed in the README.

### 37. Example projects should showcase the tool's value

Both examples currently fail to demonstrate meaningful dead-code detection with default settings. They should:
- Include code that tools actually flag at default confidence levels
- Show expected output in README
- Include a `knip.json` in the TS example

### 38. SKILL.md should include JSON output examples

The agent skill file should show exact JSON output format so agents know what to parse.

### 39. Add CONTRIBUTING.md

No contribution guide exists. For an OSS project, this is table stakes.

### 40. CLI help should show defaults

```
--min-confidence <0-100>    Vulture threshold (default: 100)
--max-findings <n>          Cap findings (default: 200, 0=unlimited)
```

Currently defaults aren't shown in help text.

---

## Architecture Assessment

### What's working well
- **CommandRunner DI pattern** — Clean testability via `CommandRunner` interface
- **Separated concerns** — scan/parse/format/install/init are well-isolated
- **Error classification** — Separating `toolErrors` from `executionErrors` from findings is smart
- **Exit code model** — 0/1/2 distinction (success/strict-fail/operational-error) is clean
- **Findings cap** — `--max-findings` with truncation metadata is agent-friendly
- **Bun test suite** — Fast, focused tests

### What needs rethinking
- **Parser fragility** — Regex parsing of tool text output should move to JSON APIs
- **Options explosion** — `ScanOptions` has 18 fields and growing. Config file support would help.
- **Single-language-only scan** — Monorepo world demands multi-language in one pass

---

## Priority Matrix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Fix Python example confidence | S | H |
| P0 | Fix TS example Knip config | S | H |
| P0 | Fix subcommand --help | S | H |
| P1 | Child process timeout | M | H |
| P1 | Polyglot scan (`--language all`) | M | H |
| P1 | Structured findings in JSON | S | H |
| P1 | Knip finding detail (symbol names) | S | H |
| P1 | JSON output status/exitCode | S | M |
| P1 | Config file support | M | H |
| P1 | Output file option | S | M |
| P2 | JSON tool output (not regex) | M | H |
| P2 | `--ruff-arg` / `--vulture-arg` | S | M |
| P2 | `--diff-base` / `--staged` | L | H |
| P2 | Baseline management | M | H |
| P2 | Doctor readiness + strict | S | M |
| P2 | Fix rounds | S | M |
| P2 | Signal handling | S | M |
| P2 | npx fallback | S | M |
| P2 | bun install method | S | M |
| P2 | Summary mode | S | M |
| P3 | Test coverage expansion | L | M |
| P3 | displayOutput fix | S | M |
| P3 | Version embedding | S | L |
| P4 | Timestamp in JSON | S | M |
| P4 | File counts in output | S | M |
| P4 | Tool versions in output | S | M |
| P4 | Per-file grouping | S | M |
| P4 | SARIF output | M | M |
| P4 | GitHub Action | M | M |

**S** = Small (1-2h), **M** = Medium (2-4h), **L** = Large (4-8h)

---

## Recommended Implementation Order

### Sprint 1 — Fix What's Broken (P0 + critical P1)
1. Fix Python example (lower default confidence or fix example code)
2. Add `knip.json` to TypeScript example
3. Fix subcommand `--help`
4. Add child process timeout
5. Make findings structured in JSON output
6. Include Knip symbol names in output

### Sprint 2 — Agent Readiness (P1 + P2 core)
7. Config file support
8. Polyglot scan
9. Switch Ruff/Biome to JSON output mode
10. Add `--ruff-arg`, `--vulture-arg`
11. Doctor readiness status + `--strict`
12. Signal handling

### Sprint 3 — Power Features (P2 + P4)
13. `--diff-base` / `--staged`
14. Baseline management
15. `--fix-rounds`
16. npx/bun fallbacks
17. Timestamp + tool versions + file counts in JSON
18. SARIF output format

### Sprint 4 — Polish & Scale (P3 + P5)
19. Expand test coverage (CLI parsing, language detection, format)
20. Integration tests
21. GitHub Action
22. CONTRIBUTING.md
23. Enhanced SKILL.md with JSON examples

---

*End of review. 40 items identified across 5 priority tiers.*
