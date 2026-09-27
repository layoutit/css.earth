# Telescope command package instructions

Own the `telescope` command. `src/bin.mts` is the installed binary (bundled by `build.mts` into `dist/telescope.mjs`): it
handles `--help`, `--version` and the workspace lookup (`--workspace PATH`, `CSSEARTH_WORKSPACE`, or the working directory's
ancestors), then runs that checkout's copy of this package's sources, `src/cli.mts`, with the same arguments, TTY state
(`CSSEARTH_TELESCOPE_*_TTY`) and exit code. `src/cli.mts` and the modules beside it are the command's implementation, run
from source (`pnpm telescope` in the checkout). Keep the arguments, help text, `--version`, workspace lookup, TTY forwarding
and exit codes unchanged unless that is the change. The command guide is [README.md](README.md), which the help text links to.

This package is the layer above the libraries: it imports `@cssearth/telescope`, `@cssearth/bake` and the other packages, and
`@cssearth/telescope` never imports it or `@cssearth/bake`. Code finds the checkout through `WORKSPACE` from
`@cssearth/telescope/node`, never by counting `../` from its own location. Two kinds of workspace code remain outside it:
- the archives' records: every archive's client code, reducers and ledger builder is `src/archives/<archive>/`, beside the
  ledger machinery they share (`src/archives/`), while its programs, toolchain pins, per-body authoring (the HST slit-scan
  map, the JWST band maps, the NACO body map, the Io JIRAM maps) and the bodies a ledger or route is about
  (`ledger-focus.json`, `moving-targets.json`, `horizons-bodies.json`) stay in `tools/objects/<archive>/`, which the code
  reads through `WORKSPACE` when a query needs it. PDS, Keck and Gemini have moved theirs beside their code, in
  `src/archives/<archive>/`, still read through `WORKSPACE`; receipts written before a move keep the path they recorded.
  No archive module names a body (`archives/archive-scope.test.mts`). That per-body JSON sits outside the module
  fingerprint closure, and a lock's `Regenerate:` header still naming the old tool path
  is refreshed at the next solve, since the lock's text is hashed into `pinsSha256`. `tools/objects/juno/juno.test.mts` stays
  beside the JunoCam programs until the stale JunoCam ledger is regenerated: its ledger-state check fails until then, and
  `test:telescope-cli` runs every test in this package;
- the entry scripts and rendering lane it runs by path as processes or compiled modules (`src/workspace-commands/`, the sphere
  lane in `tools/objects/telescope-sphere/`), because they read the checkout's body packages and application shell.

The workspace's tools import it only through the subpaths `package.json` exports. Its node tests run with
`pnpm test:telescope-cli`; a test whose toolchain or restored input is absent skips and names it.

## Shared package contract

- No per-object implementations or branches on named object IDs; examples and fixtures may name the bodies they use.
- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
  `pnpm lint:packages` enforces the limit.
- Maintain README.md and CLAUDE.md as a symlink to this guide.
