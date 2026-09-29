# Telescope package instructions

Own the telescope library the workspace's archive and preparation tools and the `telescope` command share. The command
itself is [`@cssearth/telescope-cli`](../telescope-cli/AGENTS.md), a layer above this one: this package never imports it or
`@cssearth/bake` (which imports this package's PDS label readers).

The library holds archive-neutral telescope plumbing: product records, PDS3 and PDS4 label reading, target-name
resolution, SIMBAD sky targets, cited target associations, the inline Python runner, the ESO archive and esorex clients, and the clients of the pinned Python
astronomy packages with their toolchain pins. Mission or archive policy (which programs, which frames,
how an archive's ledger is written) stays with the telescope command (`packages/telescope-cli/src/archives/<archive>/`), and object-specific use of products stays in
the bake. Nothing here names a body.

Keep the main entry (`src/index.ts`) host-neutral: no Node built-ins, DOM globals or file I/O. `src/node/` is
`@cssearth/telescope/node`; it may import `node:*`, and nothing outside `src/node/` may import it. Code finds the
package's own files (`toolchains/`) and the workspace only through `src/node/paths.ts`, which locates the package by its
name, so the same code works from its sources, its build and a bundle. The library imports only packages and Node
built-ins; it never reaches `packages/bake`, `packages/telescope-cli`, `src/`, `site/` or `labs/`.

## Behaviour is part of the contract

Product records, receipts and source-qualification digests hash these files and depend on what they accept, refuse and
write. Change a record field, a digest, a parsed label value or an error message only on purpose, together with every
test that pins it. A toolchain pin (`toolchains/*.json` and its lock) is the identity of an installed environment: any
byte change there asks every checkout to reinstall it.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs.
- Keep object JSON, source inputs/manifests, provenance, and prepared payloads outside packages. The third-party
  licences and notices under `toolchains/` belong to the Python packages those pins install, and stay beside the pins.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.
