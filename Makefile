.PHONY: install build dev clean test lint help auth-login check-auth whoami version patch minor major pre-publish publish release

help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install      - Install dependencies (bun install)"
	@echo "  make build        - Build TypeScript to dist/"
	@echo "  make dev          - Run CLI in development mode"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make lint         - Type-check without emit"
	@echo "  make test         - Run Bun test suite"
	@echo ""
	@echo "NPM Registry:"
	@echo "  make auth-login   - Login to npm (interactive)"
	@echo "  make check-auth   - Check npm authentication"
	@echo "  make whoami       - Show npm account"
	@echo ""
	@echo "Version Management:"
	@echo "  make version      - Show package version"
	@echo "  make patch        - Bump patch version"
	@echo "  make minor        - Bump minor version"
	@echo "  make major        - Bump major version"
	@echo ""
	@echo "Release:"
	@echo "  make pre-publish  - Lint, test, build, npm pack dry-run"
	@echo "  make publish      - Publish package to npm"
	@echo "  make release      - pre-publish + publish"

install:
	bun install

build:
	@echo "Building..."
	@npm run build
	@echo "Build complete"

dev:
	bun run src/index.ts --help

clean:
	rm -rf dist

test:
	@echo "Running tests..."
	@npm run test
	@echo "Tests passed"

lint:
	@echo "Type-checking..."
	@npm run lint
	@echo "Lint passed"

auth-login:
	npm login --registry https://registry.npmjs.org/

check-auth:
	@if npm whoami --registry https://registry.npmjs.org/ > /dev/null 2>&1; then \
		echo "Authenticated as: $$(npm whoami --registry https://registry.npmjs.org/)"; \
	else \
		echo "Not authenticated. Run: make auth-login"; \
		exit 1; \
	fi

whoami:
	@npm whoami

version:
	@node -p "require('./package.json').version"

patch:
	npm version patch

minor:
	npm version minor

major:
	npm version major

pre-publish: lint test build
	@echo "Running npm pack dry-run..."
	@npm pack --dry-run
	@echo "Package is ready"

publish: pre-publish
	npm publish --access public

release: publish
	@echo "Release complete"
