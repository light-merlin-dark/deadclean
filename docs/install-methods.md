# Install Methods

`deadclean` needs two Python tools in PATH: `ruff` and `vulture`.

## Methods

- `auto`: tries `uv`, then `pipx`, then `pip`.
- `uv`: `uv tool install --upgrade ruff` and `uv tool install --upgrade vulture`.
- `pipx`: `pipx install/upgrade ruff` and `pipx install/upgrade vulture`.
- `pip`: `python3 -m pip install --user --upgrade ruff vulture`.

## Recommendation

Use `auto` unless your environment has strict package-management rules.
