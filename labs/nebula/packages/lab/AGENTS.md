# lab ownership

- Internal React application, processing server and command orchestration.
- Allowed internal dependencies: `@cssearth/bake/volume`, `@cssearth/bake/volume/node`, reconstruction and volume-viewer.
- Keep all implementation in strict TypeScript and every authored source file at or below 600 physical lines.
- Export explicit public subpaths; validate external values at runtime.
- Preserve accepted outputs, numerical order, frames, spectral distinctions and persisted state during ownership changes. Never change expected outputs to conceal regressions.
- Keep object selection, UI state and filesystem/source configuration here; integration with application internals belongs only in explicit host adapters. Processing belongs to server jobs, not page lifecycle.
- Run affected typechecks and behavior checks; preserve generated outputs and live sessions.

Shared compact delivery, material receipt, simulation-envelope and cloud-parts formats are parsed by
`@cssearth/objects`; lab owns orchestration, file I/O and publication adapters.

Kinematics owns the molecular catalogue envelope; reconstruction returns scientific table data without that envelope.
`schema-protocols.test.ts` pins preserved Python registration/native schema checks and retained fixtures; CI selects it explicitly.
