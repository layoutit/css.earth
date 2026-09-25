# volume-viewer ownership

- Retained volume scenes, camera control and inspection through an injected renderer.
- Allowed internal dependencies: `@cssearth/bake/volume`; host-provided renderer operations.
- Keep all implementation in strict TypeScript and every authored source file at or below 600 physical lines.
- Export explicit public subpaths; validate external values at runtime.
- Preserve accepted hashes, numerical order, frames, spectral distinctions and persisted state during ownership changes. Never change expected outputs to conceal regressions.
- No object-specific branches, subject registry, research recipes, repository paths or browser storage. The host supplies configuration through validated contracts.
- Run affected typechecks and behavior checks; preserve generated outputs and live sessions.
- Scene constructors receive a backend and path resolver per instance; never add a default repository root or global renderer registration.
- Keep renderer-specific selectors and scientific input validation in host adapters or their canonical core contract. Camera controls and retained DOM/resource lifetimes belong here; lab subject and session policy do not.
