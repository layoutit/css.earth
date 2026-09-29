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
  ledger machinery they share (`src/archives/`). PDS, Keck, Gemini, NACO, Chandra, Spitzer, Juno, HST, JWST and IHW keep
  their programs, receipts, toolchain pins and the bodies a ledger or route is about (`ledger-focus.json`,
  `moving-targets.json`, `horizons-bodies.json`) beside that code, still read through `WORKSPACE`; JWST keeps one programs
  folder beside each tool that reads it (`jwst/programs`, `jwst/imaging/programs`, `jwst/klip/programs`). The
  interferometry reduction (`src/archives/interferometry/`: ALMA restores, VLTI calibration, star imaging) keeps its
  toolchain pins (`toolchains.json`), the ROTIR Julia project (`rotir/`), star seasons (`seasons/`) and test fixtures beside
  it; `toolchains.json` still names the ROTIR environment at its former path, because an installed toolchain keeps that
  text, and `currentArchivePath` in `src/archives/programs.mts` finds it here. Per-body
  authoring (the HST slit-scan map, the JWST band maps, the NACO body map, the ALMA thermal maps, the circumstellar
  discs) is `authoring/<archive>/` (exported by no subpath: it imports this package through its own name, never the
  other way), a leaf the architecture check enforces; the Io JIRAM maps moved to `packages/bake/authoring/juno/`. A receipt or ledger written before
  a move keeps the path it recorded; `src/archives/programs.mts` maps a recorded program path to its current location, for
  qualification, receipt writing and query display alike. No archive module names a body (`archives/archive-scope.test.mts`).
  A lock's `Regenerate:` header still naming the old tool path is refreshed at the next solve, since an installed toolchain
  keeps the lock's text and a changed lock asks for a reinstall. `packages/bake/authoring/juno/juno.test.mts`
  stays there until the stale JunoCam ledger is regenerated: its ledger-state check fails until then, and
  `test:telescope-cli` runs every test in this package;
- the entry scripts and rendering lane it runs by path as processes or compiled modules (`src/workspace-commands/`, the sphere
  lane in `src/sphere/sphere-lane.mts` and `src/sphere/sphere-html.mts`), because they read the checkout's body packages and
  application shell. The native CSS camera, resize input and carried viewport values that lane writes into its HTML are
  this package's `src/sphere/native-scroll/` (exported as `./sphere/native-scroll/*`, which the native scroll preview in
  `labs/experiments/` also imports); they followed the lane out of `tools/experiments/` (now `labs/experiments/`);
- the installer of the pinned Python astronomy toolchains (`src/toolchains/astronomy-toolchains.mts`, run as
  `node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts <toolchain> install|verify`), which the
  `@cssearth/telescope/node` errors name when a toolchain is missing.

The object generator behind `telescope new-object` is `src/new-object/`: `cli.mts` is the entry the telescope runs as a process of its
own through `workspace-commands/new-object.mts`, `new-object-cli.mts` is the standalone entry for the modes the telescope does not expose
(`--star-limb`, `--thermal`, `--host-light`, `--phase-curve`, `--charts`, `--retext`, `--retime`, the shape-only scaffold), and
`new-hosted-planet.mts` scaffolds one hosted planet. `hosted-orbits/` holds the two Python fitters `hosted.mts` runs beside it.
The generated solar geometry (`src/platform/solar-geometry.mts`) stays generated: the entries load it with `solar-epoch.mts` and
pass the epoch down, so no module here imports it.

The sky band composer is `src/sky/` (exported as `./sky/*`): `sky-band-composite.mts` composes pinned hips2fits, AllWISE
atlas and JWST level-3 bands on one TAN grid, and `author-sky-bands.mts` acquires and pins those bands. It moved from
`tools/objects/observation/` (now here) because it imports this package's JWST imaging modules. `site/build/prepare/prepare-volume-presentation.mts`
and the nebula lab's sky-band adapter use it; its tests are in `tests/objects/observation/`, using the
`@cssearth/objects/node/source-test` helper and FITS fixtures they read.

The workspace's tools import it only through the subpaths `package.json` exports. Its node tests run with
`pnpm test:telescope-cli`; a test whose toolchain or restored input is absent skips and names it.

## Shared package contract

- No per-object implementations or branches on named object IDs; examples and fixtures may name the bodies they use.
- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
  `pnpm lint:packages` enforces the limit.
- Maintain README.md and CLAUDE.md as a symlink to this guide.
