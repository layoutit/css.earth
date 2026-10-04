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
  `moving-targets.json`, `horizons-bodies.json`) beside that code, still read through `WORKSPACE`; JWST keeps one `jwst/programs/` root: time-series directories and imaging, cube and KLIP JSON files.
  Receipts retain their original bytes and are matched by program id, band and pinned product, never the previous directory. The
  interferometry reduction (`src/archives/interferometry/`: ALMA restores, VLTI calibration, star imaging) keeps its
  toolchain pins (`toolchains.json`), the ROTIR Julia project (`rotir/`), star seasons (`seasons/`) and test fixtures beside
  it. Per-body authoring (the HST slit-scan map, the JWST band maps, the NACO body map, the ALMA thermal maps, the circumstellar
  discs) is `authoring/<archive>/` (exported by no subpath: it imports this package through its own name, never the
  other way), a leaf the architecture check enforces; the Io JIRAM maps moved to `packages/bake/authoring/juno/`. Receipts and ledgers record program paths
  where `src/archives/programs.mts` puts them. No archive module names a body (`archives/archive-scope.test.mts`).
  The Juno archive tests are beside the archive in `src/archives/juno/`;
  `test:packages` runs every test in this package;
- the entry scripts it runs by path as processes and the built sphere package entry (`src/workspace-commands/`, the sphere
  lane exported as `@cssearth/telescope-cli/sphere/lane` and `src/sphere/sphere-html.mts`), because they read the checkout's body packages and
  application shell. The native CSS camera, resize input and carried viewport values that lane writes into its HTML are
  this package's `src/sphere/native-scroll/` (exported as `./sphere/native-scroll/*`, which the native scroll preview in
  `labs/experiments/` also imports); they followed the lane out of `tools/experiments/` (now `labs/experiments/`);
- the installer of the pinned Python astronomy toolchains (`src/toolchains/astronomy-toolchains.mts`, run as
  `node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts <toolchain> install|verify`), which the
  `@cssearth/telescope/node` errors name when a toolchain is missing.

The object generator behind `telescope new-object` is `src/new-object/`: `cli.mts` is the entry the telescope runs as a process of its
own through `workspace-commands/new-object.mts`, `new-object-cli.mts` is the standalone entry for the modes the telescope does not expose
(`--star-limb`, `--thermal`, `--thermal-entries`, `--expected-glow`, `--host-light`, `--phase-curve`, `--simulation`, `--rock-eclipse`, `--published-map`, `--charts`, `--retext`, `--retime`, the shape-only scaffold), and
`new-hosted-planet.mts` scaffolds one hosted planet. `hosted-orbits/` holds the two Python fitters `hosted.mts` runs beside it.
The generated solar geometry (`src/platform/solar-geometry.mts`) stays generated: the entries load it with `solar-epoch.mts` and
pass the epoch down, so no module here imports it.

The star survey behind `telescope stars GALAXY` is `src/stars/`. It and the generator's `--from-table` route
(`src/new-object/archives/tables/table-stars.mts`) read VizieR's table metadata and SIMBAD through the same two modules,
`vizier-tables.mts` and `simbad-tap.mts` beside it; a star class is a branch of SIMBAD's own type tree, never a
list of types kept here.

The sky band composer is `src/sky/` (exported as `./sky/*`): `sky-band-composite.mts` composes pinned hips2fits, AllWISE
atlas and JWST level-3 bands on one TAN grid, and `author-sky-bands.mts` acquires and pins those bands. It moved from
`tools/objects/observation/` (now here) because it imports this package's JWST imaging modules. `site/build/prepare/prepare-volume-presentation.mts`
and the nebula lab's sky-band adapter use it; its tests are beside the composer in `src/sky/` and the request reader in `src/resolution-evidence.test.mts`, using the
`@cssearth/objects/node/source-test` helper and FITS fixtures they read.

The workspace's tools import it only through the subpaths `package.json` exports. Its node tests run with
`pnpm test:packages`; a test whose toolchain or restored input is absent skips and names it.

## Shared package contract

- No per-object implementations or branches on named object IDs; examples and fixtures may name the bodies they use.
- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
  `pnpm lint:packages` enforces the limit.
- Maintain README.md and CLAUDE.md as a symlink to this guide.

Sphere framing reads numeric silhouette geometry from `@cssearth/engine`. Its runtime publication, scene serialization and prepared loaders remain renderer consumers.

Renderer runtime exceptions are file-scoped in [the architecture rule](../../.github/scripts/architecture/preparation-without-renderer.mts):
`src/spatial-handoff.mts` runs physical resource loaders; `src/sphere/native-scroll/native-camera.mts`,
`src/sphere/sphere-html.mts` and `src/sphere/sphere-oracle.mts` publish retained scenes.
The package keeps its renderer dependency for these four consumers and the declared build metadata reader. F16 validation uses objects contracts.

Object-text scaffolding imports `OBJECT_TEXT_SCHEMA` from `@cssearth/objects`; cited-text
format parsing belongs there, while wording generation and editorial policy stay with their owners.

See the [shared source-format ownership contract](../objects/AGENTS.md) for WISE pins, rotation records and published limb coefficients.

`src/implementation-dependencies.mts` declares `RENDERER_BUILD_CONFIG_PATH` for its entry-source closure.
The architecture rule names this metadata reader separately from runtime consumers; its guard rejects an unlisted reader.

Sphere export runs the built `@cssearth/telescope-cli/sphere/lane` entry from `dist`. After editing `src/sphere/`, rebuild with `pnpm --filter @cssearth/telescope-cli build` before exporting again.

The library/command split is accepted: bake imports the light telescope library, while telescope-cli depends on bake for preparation; merging them would create a cycle. Reconsider only when the command no longer needs bake.

Fixture homes follow their test owner: shared command fixtures stay in `src/fixtures/`, while family, VO and archive fixtures stay beside their tests. This split is accepted to keep archive-specific inputs local; promote a fixture only when a second owner consumes it.

Interferometry intentionally keeps seven toolchains in one descriptor and one installer because the reduction workflow coordinates their install/verify policy. Split only when a toolchain gains an independent owner or installer contract.
