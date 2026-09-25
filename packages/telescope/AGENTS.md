# Telescope package instructions

Own two things: the `telescope` command's thin wrapper (`src/cli.mts`, `src/help.mts`, bundled by `build.mts` into
`dist/telescope.mjs`), and the telescope library the workspace's archive and preparation tools share. The command still
finds a css.earth checkout and runs `tools/objects/telescopes/cli.mts` there; keep its arguments, help text, `--version`,
`--workspace` / `CSSEARTH_WORKSPACE` lookup, TTY forwarding and exit codes unchanged unless that is the change.

The library holds archive-neutral telescope plumbing: product records, PDS3 and PDS4 label reading, and the clients of
the pinned Python astronomy packages with their toolchain pins. Mission or archive policy (which programs, which frames,
how an archive's ledger is written) stays in `tools/objects/<archive>/`, and object-specific use of products stays in
the bake. Nothing here names a body.

Keep the main entry (`src/index.ts`) host-neutral: no Node built-ins, DOM globals or file I/O. `src/node/` is
`@cssearth/telescope/node`; it may import `node:*`, and nothing outside `src/node/` may import it. Code finds the
package's own files (`toolchains/`) and the workspace only through `src/node/paths.ts`, which locates the package by its
name, so the same code works from its sources, its build and a bundle. The library imports only packages and Node
built-ins; it never reaches `tools/`, `src/`, `site/` or `labs/`.

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
