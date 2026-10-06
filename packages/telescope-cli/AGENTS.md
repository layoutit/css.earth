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
(`--star-limb`, `--imaged-limb`, `--star-lit`, `--thermal`, `--thermal-entries`, `--expected-glow`, `--host-light`, `--phase-curve`, `--simulation`, `--rock-eclipse`, `--published-map`, `--charts`, `--retext`, `--retime`, the shape-only scaffold), and
`new-hosted-planet.mts` scaffolds one hosted planet. `hosted-orbits/` holds the two Python fitters `hosted.mts` runs beside it.
The generated solar geometry (`src/platform/solar-geometry.mts`) stays generated: the entries load it with `solar-epoch.mts` and
pass the epoch down, so no module here imports it.

A published picture as one more dataset of a page is `src/new-object/pictures/`: `--from-esa` and a spec's `pictures`. `esa-image.mts` reads
ESA's picture pages and the sky tags in a JPEG, `registration.mts` owns the arithmetic from those tags and one pixel to a recipe's
observation, plane and rim, `picture-bank.mts` writes one entry's records from the bank it is like, and `pictures.mts` drafts, writes
and bakes. It never writes a sentence a reader sees and never picks a value for a color: those are the spec's, written by a person.

A star's corona derived from the magnetic maps its page already shows is `src/new-object/corona/`: `--from-magnetic` and a spec's
`coronae`. `corona-bank.mts` parses an entry, computes the grids through `@cssearth/bake/objects/stellar` and writes the bank's
records and the star's dataset steps; `corona.mts` reads the star's own records and maps, drafts, writes and bakes. A corona is
never a published result: every sentence these modules write says it is derived here and which of its numbers are measured. A
star whose gas, at its X-ray temperature, would not be held by its gravity is refused, not drawn.

What the catalogues print of every star is `src/new-object/metadata/`: `--metadata --all | STAR_ID...` writes spectral type,
metallicity, luminosity, age, rotation period, projected rotation speed and the tilt those give into each star's
`source/measurements.json`, each beside its source. `star-metadata.mts` owns the fields and which catalogue stands before
which; `metadata.mts` asks the NASA Exoplanet Archive once, and SIMBAD and the Gaia Archive in groups of stars. The pass never
replaces a value the record holds from its own source, computes a tilt only for a page that draws no measured axis, and bakes
nothing. A tool that needs a star's rotation or type reads the record, not a catalogue; the generator runs the pass on every star
it writes. `--periods` adds the rotation periods no archive row gives: `rotation-catalogues.mts` asks the Virtual Observatory
registry (RegTAP at the GAVO data centre) for every VizieR table with a rotation-period column and CDS X-Match for our stars
in each, and the record keeps them all (`rotationPeriodsCatalogued`). One is adopted only when more than half agree with the middle one (`adoptPeriod`);
two that disagree, often a rotation and its half, are left for a person or a fit to choose between. The registry is how a new kind of value is found too:
ask it which tables print the column before reading any paper.

The star survey behind `telescope stars GALAXY` is `src/stars/`. It and the generator's `--from-table` route
(`src/new-object/archives/tables/table-stars.mts`) read VizieR's table metadata and SIMBAD through the same two modules,
`vizier-tables.mts` and `simbad-tap.mts` beside it; a star class is a branch of SIMBAD's own type tree, never a
list of types kept here. A star listed by detector pixel is placed by `src/new-object/archives/images/image-pixel.mts`: it reads
header records of the archived exposure by byte range, keeps the one extension header as the package's ranged source input,
and takes the sky position from `@cssearth/fits` `skyProjection`, which owns the projection and its SIP distortion.
The survey ends by asking the papers API for works that name the galaxy and a kind of star: a literature claim about a
galaxy's stars is checked there before it is made, never from SIMBAD and VizieR alone.

Magnetic maps of stars from archived polarised spectra are `src/archives/espadons/`: `archive.mts` pins one star's run at the
Canadian Astronomy Data Centre, `reduce.mts` reduces it, and `compare.mts` and `benchmark.mts` set the result beside what papers
print for the same run. The science is not this package's: Korg computes each line's depth in the star's model atmosphere, LSDpy
averages the lines, SpecpolFlow measures the longitudinal field and ZDIpy fits the map. `toolchain.json` pins them and
`toolchain.mts install` puts them under `output/toolchains/zdi`; the GPL codes are run as tools and never copied here. What is
written here is the archive reader (`cadc.mts`, `product.mts`), the Kurucz line list with its Landé factors (`kurucz.mts`), the
files those codes read and the conversion of what they write (`mask.mts`, `lsd.mts`, `zdi.mts`); `tools.py` and `korg/depths.jl`
hold calls and nothing else. Do not add a step of physics to these modules: when a step is missing, find the published code that
does it and pin it. A program's `atmosphere`, `radialVelocity`, `star` and `published` values each carry where they are printed.
A star no paper maps takes its rotation from its own measurements record (`archive.mts --object`, `--ledger`), never from a value
typed here. A run's receipt is a result: `reduce.mts` writes it under ignored `output/espadons/<program id>/` and it is never committed; the
ledger records each run's verdict. The one choice the codes leave open, how tightly a map is fitted, is `KNEE` in `reduce.mts`, and it is settled by `benchmark.mts`
on the published runs.

The papers API behind `telescope papers` is `src/papers.mts` and `src/papers/`. There is one search path: `findWorks`
(`papers/works.mts`) asks OpenAlex, then arXiv when OpenAlex refuses, and the command and the star survey both call it; a
second query builder is not added beside it. `papers/names.mts` owns how a target and a subject are written (every spelling,
singular and plural), `papers/text.mts` the sentences quoted from a full text, and `papers/follow-ups.mts` what was
published after a paper (the works under its title, which is how an erratum is found, and the works that cite it). OpenAlex
meters searches by a daily budget, so a new feature spends one search where it can, never one for each work; the key is read
from `OPENALEX_API_KEY` and sent as a header, never written to a URL, a report or a fixture.

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
