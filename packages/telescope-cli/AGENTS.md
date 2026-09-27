# Telescope command package instructions

Own the `telescope` command: `src/cli.mts` (arguments, help, `--version`, workspace lookup), `src/help.mts` (the help text
and version) and `build.mts`, which bundles the command into `dist/telescope.mjs`. The command's user guide is the
[telescope package README](../telescope/README.md), which the help text links to.

The command finds a css.earth checkout (`--workspace PATH`, `CSSEARTH_WORKSPACE`, or the working directory's ancestors) and
runs its implementation, `tools/objects/telescopes/cli.mts`, there. Keep its arguments, help text, `--version`,
`--workspace` / `CSSEARTH_WORKSPACE` lookup, TTY forwarding (`CSSEARTH_TELESCOPE_*_TTY`) and exit codes unchanged unless
that is the change.

This package is the layer above the libraries: the implementation it runs imports `@cssearth/telescope`, `@cssearth/bake`
and the other packages. `@cssearth/telescope` never imports it or `@cssearth/bake`. Until the implementation moves here, two
kinds of relative import remain: `tools/objects/telescopes/cli.mts` reads this package's `src/help.mts` by path, and the
implementation imports the archive folders (`tools/objects/<archive>/`, for example `families/f04-slit-profile.mts` →
`tools/objects/hst/`), which move with it. Beyond those, it reaches workspace code only as processes or modules it runs from
the checkout by path (`tools/objects/telescopes/workspace-commands.mts`, the sphere lane in `tools/objects/telescope-sphere/`).
Moving the implementation here also moves the archive programs, ledgers and toolchain locks whose paths body manifests,
ledgers and test fixtures record, so it is a change of its own under the provenance contract.

## Shared package contract

- No per-object folders, planet-specific implementations, or branches on named object IDs.
- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
  `pnpm lint:packages` enforces the limit.
- Maintain README.md and CLAUDE.md as a symlink to this guide.
