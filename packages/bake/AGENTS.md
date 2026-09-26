# Bake package instructions

Own the build-time preparation code: what the preparation tools and the nebula lab run to turn source records into
prepared delivery. Nothing here runs in the application. The runtime (`@cssearth/renderer` and
`site/**`) must never import `@cssearth/bake`; a type the renderer needs belongs in the renderer's own contracts.

Each topic is one subpath entry. Topics must not import each other sideways; share code through `@cssearth/core` or
another package instead. The first topic is `volume`:

- `src/volume/` is published as `@cssearth/bake/volume`: the volume contracts, coordinates, fields, materials and
  sampling. It stays host-neutral, because the nebula lab's browser viewer imports it: no Node built-ins, `Buffer`,
  DOM, React, Vite, `sharp`, PolyCSS, renderer imports or file paths, and it never imports `node/`.
- `src/volume/node/` is published as `@cssearth/bake/volume/node`: the compact-input replay, the XYZ slices and the
  compiler bake. It may import `node:*`, `sharp` and the main volume entry; nothing outside `src/volume/node/` imports it.

## Behaviour is part of the contract

Prepared volumes, nebula deliveries and the lab's accepted density bakes depend on exactly what this code returns.
Preserve arithmetic order, finite support, frames, units, spectral semantics, missing-data handling and historical
compatibility. A relocation must not change accepted pixels or relax a validator. Material colour does not define
density: keep component-bound 3D material distinct from historical image-ray samplers, and never add an XY fallback to
the finite-emission compiler. Change an output only on purpose, together with every test and accepted bake that pins it.

The `nebulaImplementation` inventory in `package.json` lists the sources that nebula delivery identities hash. Keep it
covering every topic directory whose code a delivery runs.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs. The host supplies object
  paths, recipes and backends through validated contracts.
- Keep object JSON, source inputs/manifests, licences, required notices, provenance, and prepared payloads outside
  packages.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.
