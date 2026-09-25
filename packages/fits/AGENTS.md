# FITS package instructions

Own the one FITS reader: header cards and values, HDU layout, image samples, Rice tile-compressed images, sky WCS
orientation and projection, the float32 transport image, sample statistics for comparing two readings, and file access.
FITS is a stable standard with no knowledge of this application, so nothing here names a body, mission, telescope
product or prepared payload. Archive-specific tolerances already in the reader (SDO's column-10 quotes and TAI times,
ESO HIERARCH namespaces) are FITS conventions found in released files and stay documented where they are handled.

Keep the main entry host-neutral: it parses a `Uint8Array` (a Node `Buffer` is one) with `DataView` and no Node
built-ins, DOM globals or file I/O. `src/node/` is published as `@cssearth/fits/node`; it may import `node:*` and use
`Buffer`, and nothing outside `src/node/` may import it. Tree-shaking must keep working: no top-level side effects beyond
constant definitions.

## Behaviour is part of the contract

Preparation receipts, oracle fixtures and archived reports depend on exactly what this reader accepts, refuses and
returns. Change a decoded value, an accepted card convention or an error message only on purpose, together with every
test and oracle that pins it. The Astropy comparisons live in `tools/oracles/fits/` beside the scripts that write their
fixtures; run them with `node tools/oracles/test-fits.mts --unit` after any change here.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs.
- Keep object JSON, source inputs/manifests, licences, required notices, provenance, and prepared payloads outside packages.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.
