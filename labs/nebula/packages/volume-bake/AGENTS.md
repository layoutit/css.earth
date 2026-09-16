# volume-bake ownership

- Deterministic replay of accepted compact volume inputs.
- Allowed internal dependencies: volume-core; explicit renderer and star-asset backends supplied by the host.
- Keep all implementation in strict TypeScript and every authored source file at or below 600 physical lines.
- Export explicit public subpaths; validate external values at runtime.
- Preserve accepted hashes, numerical order, frames, spectral distinctions and persisted state during ownership changes. Never change expected outputs to conceal regressions.
- No object-specific branches, subject registry, research recipes, repository paths or browser storage. The host supplies configuration through validated contracts.
- Run affected typechecks and behavior checks; preserve generated outputs and live sessions.
