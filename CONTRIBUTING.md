# Contributing to deadclean

Thank you for your interest in contributing to deadclean!

## Development Setup

```bash
bun install
bun test
bun run lint
bun run build
```

## Project Structure

```
src/
  cli.ts        CLI argument parsing and command routing
  scan.ts       Core scan logic, config loading, polyglot support
  parsers.ts    Tool output parsers (Ruff, Vulture, Biome, Knip)
  format.ts     Output formatting (text, JSON, SARIF)
  install.ts    Tool installation (uv, pipx, pip, npm, bun)
  init.ts       Config scaffolding (knip.json, .vulture_ignore)
  doctor.ts     Runtime and tool readiness checks
  language.ts   Project language detection
  process.ts    Child process management with timeout and signal handling
  types.ts      Shared TypeScript types
  index.ts      CLI entry point
tests/          Bun test suite
examples/       Example projects for both languages
```

## Code Style

- TypeScript with strict mode enabled.
- No comments unless explicitly requested.
- Follow existing patterns and conventions in the codebase.
- Use dependency injection via `CommandRunner` for testability.

## Making Changes

1. Create a feature branch from `main`.
2. Make your changes with tests.
3. Run `bun run lint && bun test && bun run build` to verify.
4. Submit a pull request.

## Testing

- Tests use Bun's built-in test runner (`bun:test`).
- Mock `CommandRunner` for unit tests — never depend on real tools in tests.
- Cover both happy paths and error cases.

## Commit Messages

- Use concise, descriptive commit messages.
- Focus on the "why" rather than the "what".

## Reporting Issues

Open an issue at https://github.com/light-merlin-dark/deadclean/issues with:
- deadclean version (`deadclean --version`)
- Node/Bun version
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
