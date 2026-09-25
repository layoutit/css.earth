# SPICE package instructions

Own the one reader of NAIF SPICE kernels: DAF files, SPK ephemerides and CK pointing, text kernels, leap seconds,
spacecraft clocks, frame chains, light time and stellar aberration, two-body propagation, the pinhole camera a kernel set
places, and the side a flyby spacecraft approached. SPICE is a stable toolkit convention with no knowledge of this
application, so nothing here names a body, mission or prepared payload beyond what a kernel itself states.

Keep the main entry host-neutral: it evaluates a `Uint8Array` or kernel text with `DataView` and no Node built-ins, DOM
globals or file I/O. `src/node/` is published as `@cssearth/spice/node`; it may import `node:*` and use `Buffer`, and
nothing outside `src/node/` may import it. Tree-shaking must keep working: no top-level side effects beyond constant
definitions.

The node entry reads kernel sets from disk and restores the pinned mission kernel banks under the checkout's
`src/spice/<set>/`. It finds that directory from the package's own name, never from a fixed offset to its own file, so
the path is the same from `src/`, from `dist/` and from any caller. A bank's `manifest.json` has the shape of a body's
source manifest, whose validation belongs to the application: callers pass the manifest reader in.

## Behaviour is part of the contract

Preparation receipts, oracle fixtures, archived cameras and evidence reports depend on exactly what this reader
returns. Change a state, rotation, time conversion or error message only on purpose, together with every test and oracle
that pins it. The SpiceyPy comparisons live in `tools/oracles/spice/` beside the scripts that write their fixtures.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs.
- Keep object JSON, source inputs/manifests, kernels, licences, required notices, provenance, and prepared payloads
  outside packages.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.
