# Publishing Guide

## One-Time Setup

1. Ensure npm auth works:
```bash
make check-auth
```
2. Verify repo metadata in `package.json` is correct.

## Release Flow

1. Validate package quality:
```bash
make pre-publish
```
2. Publish:
```bash
make publish
```
3. Verify install from npm:
```bash
npm view @light-merlin-dark/deadclean version
```

## GitHub Release (Optional)

```bash
gh release create v$(node -p "require('./package.json').version") --generate-notes
```
