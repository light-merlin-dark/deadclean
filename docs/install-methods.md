# Install Methods

`deadclean` supports two toolchains:

- Python: `ruff`, `vulture`
- TypeScript: `biome`, `knip`

## Python Install Methods

- `auto`: tries `uv`, then `pipx`, then `pip`.
- `uv`: `uv tool install --upgrade ruff` and `uv tool install --upgrade vulture`.
- `pipx`: `pipx install/upgrade ruff` and `pipx install/upgrade vulture`.
- `pip`: `python3 -m pip install --user --upgrade ruff vulture`.

## TypeScript Install Method

- `auto` or `npm`: `npm install -g @biomejs/biome knip`.

## Examples

```bash
# all toolchains
deadclean install-tools --language all --method auto

# python only
deadclean install-tools --language python --method auto

# typescript only
deadclean install-tools --language typescript --method npm
```
