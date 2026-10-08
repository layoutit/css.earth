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
  where `src/archives/programs.mts` puts them. No archive module names a body.
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

`src/archives/archives.mts` describes every archive once (registry identifier and pinned address, the search `explore` runs, the ledger command); `explore`, the registry check and `src/archives/ledgers.mts`, which runs every ledger command, read that list, and a new archive is added there, not in each of them. `src/archives/memory.mts` is the memory between explorations: a question asked in the last day is answered from the evidence file it saved, never from anything else, and `--fresh` turns it off.

The object generator behind `telescope new-object` is `src/new-object/`: `cli.mts` is the entry the telescope runs as a process of its
own through `workspace-commands/new-object.mts`, `new-object-cli.mts` is the standalone entry for the modes the telescope does not expose
(`--star-limb`, `--imaged-limb`, `--star-lit`, `--thermal`, `--thermal-entries`, `--expected-glow`, `--host-light`, `--phase-curve`, `--simulation`, `--rock-eclipse`, `--published-map`, `--charts`, `--retext`, `--retime`, `--rename`, `--draft-photometry`, `--photometry`, the shape-only scaffold), and
`new-hosted-planet.mts` scaffolds one hosted planet. `--hosted <handoff>` is the generator's own second phase (`generate.mts`
`runHostedPhase`), started by a system run in a process that loads the rebuilt astronomy package; nobody types it. `hosted-orbits/` holds the two Python fitters `hosted.mts` runs beside it.
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
SIMBAD's object type with its place in SIMBAD's tree of types, metallicity, luminosity, age, rotation period, projected rotation speed and the tilt those give into each star's
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

A star's rotation and brightness map from its light are `src/archives/tess/` and `src/archives/kepler/`. Whether a light
curve shows a star turning is decided by a published method, never by a threshold or a choice made here, by you or by the
person asking. `tess/methods.mts` is the table: each entry is one paper's method for the kind of star and the light curves
that paper applies it to, with its criteria and its rule for a star observed more than once, as printed, and it measures
and judges a star's light curve files itself (`judge`). Two are wired: Reinhold & Hekker (2020) for main-sequence stars in
the K2 mission's PDC-MAP light curves, and Holcomb et al. (2022) for dwarfs in the TESS mission's 2-minute ones.
`kepler/light-curves.mts` and `tess/light-curves.mts` find those files at MAST; `tools.py` has lightkurve read one as it
is, astropy and star-privateer compute Reinhold & Hekker's three periods, and SpinSpotter run as its authors run it. Nothing
is measured from pixels. A star or a light curve no entry covers gets the paper's reason and no verdict, and is not
fetched. To cover another kind of star or of data, read the paper that treats it and add its entry, with the light curve
that paper uses; do not widen an entry beyond its paper, do not add a limit no paper prints, and do not tune a number on
our own stars: a comparison with the catalogues is evidence for the note, not a setting. Where an entry reads something
into its paper, its comment says so.

Three things around the two methods are stated in the note as this repository's. K2's light is judged first, and a star
K2's method refuses is judged on its TESS light too (`reduceStar`); a rotation K2's method accepts stays K2's. A star
whose record holds no temperature or no surface gravity takes the missing value from the TESS Input Catalog, the
catalogue Holcomb et al. select from, as the primary header of the star's own 2-minute light curve carries it (an entry's
`catalogue`; `tools.py input-catalogue` is lightkurve reading the header): only to fill, never to replace, and only when
the light curve's target lies within 3 arcseconds of the star. And `tess/published.mts` holds the third kind of entry, a
paper's own verdict: a paper whose code cannot be run here (Colman et al. 2024: no licence) still lists in its published
table the stars it found turning. An entry there reads the table through the telescope's TAP reader and says what a row
asserts and which columns decide, after the paper's sections on its sample, its light curves and its table and the
table's own description have been read; it is looked up only for a star the wired method refuses, it is a verdict only
on the light the paper judged, and it measures nothing. A column that does not hold what its description says is not
read, and the entry's comment gives the count. `tess/canto-martins.mts` is a second such entry, for a TESS Object of
Interest (Canto Martins et al. 2020: its periods were chosen by its authors' inspection), and `tess/papers.mts` lists
the entries in the order they are asked. A paper is wired only when it measured on the mission's 2-minute PDC-MAP light
curves, marks its firm detections of rotation and says which of a star's light a row is of; the note lists the papers
read that do not, each with the reason. A paper's verdict is drawn at the paper's own period or not at all
(`keptAsPublished`): half the catalogued period, or a period apart from another table's where the star's record adopts
none, withholds it, and two papers that print one star periods more than 20% apart give it none (`publishedApart`).

A Kepler star has no method wired. Its rotation is its row in the tables of Santos et al. (2019, 2021): two more entries
of the published-verdict kind (`kepler/santos.mts`), asked of a star no method and no paper above gives a rotation. Its
light is the KEPSEISMIC light curve those papers judged (`kepler/kepseismic.mts` finds the three files at MAST, and this
repository's FITS reader reads one: its table, and its mark for each point), of the filter the papers read a period of
that length in. That light curve is the star's four years in one series, so it is cut at the mission's own quarters
(`kepler/quarters.json`, from the Kepler Data Release 25 Notes; `kepler/quarters.mts`), and a quarter has a map when the
papers' rule on a quarter's variance keeps it (García et al. 2014) and its measured light spans a turn of the star. A map
is fitted to the measured points only. What this path reads into the papers and into the file is in the note's list and
in the two modules' comments: the filter of a row, the flagged rows left out, the file's unlabelled marks, the rule at a
star's first and last quarter, the one-turn limit, and the light's swing, which is measured here.

`verdict.mts` holds the verdict's shape and four checks against what is already published of the star (its catalogued
period, SIMBAD's type, the fastest its radius and mass let it turn, and the share of other stars' light in its TESS
pixels); each can only withhold a map, a paper's own verdict included. The fourth is a published limit: a TESS target
the TESS Input Catalog gives a contamination ratio of 0.2 or more is not read as its star's (`blended`; Fetherolf et al.
2023 and García Soto et al. 2023 print that limit for their own searches of the same light curves, and
`light-curves.mts` asks MAST for the ratio). Do not replace it with a number of ours, and do not decide anything on the
aperture shares a receipt keeps from a light curve's header (`CROWDSAP`, `FLFRCSAP`): no paper found prints a limit on
them for rotation. The ratio is of TESS's pixels: do not set it beside K2's or Kepler's light, for which no published
limit is wired; a star it leaves unread on TESS is still asked for among Kepler's light curves. `neighbours.mts` counts
the Gaia sources around a star for its page to say. `map.mts` has starry fit the map of each accepted light curve, and
writes its values to five decimals of the mean, or to seven for a map whose whole range would hold under 256 steps at
five (`written`): that is how a number is written, and no star gains or loses a map by it.
`reduce.mts` runs a star, or every star with `--all`, and writes its receipt and light curves under ignored
`output/tess/<star id>/`. The science is the pinned codes' (`toolchain.json`, and the telescope's starry toolchain);
`tools.py` holds calls and nothing else ([method note](../../docs/stellar-brightness-maps-from-tess.md)).

Every kind of surface map this repository reduces reaches a star's page through `src/new-object/maps/`: `surface-maps.mts`
writes the records any map needs (table, manifest input, raster surface, dataset, control, text) from a `MapKind`, and
`route.mts` reads a spec, writes each star and bakes from a `MapRoute`; `routes.mts` lists the kinds (`MAP_ROUTES`). A kind supplies only what is its own: its column,
units, colors, sentences, how its reduction is read and the catalogue records it is bound to. `magnetic/` is the kind for
maps from polarised spectra (`--from-spectra`, a spec's `magneticMaps`; a convention page takes the maps' tilt) and
`brightness/` the kind for maps from a star's TESS, K2 or Kepler light curves (`--from-pixels`, a spec's `brightnessMaps`; what differs by
mission is one table, `MISSIONS`, which also says whose light curve is read: the mission's own, or KEPSEISMIC; a map's records name the published method that judged it, in the method's own words, and the paper's own light curve; a map drawn on a paper's own verdict says the rotation and its period are that paper's, names the method that refused the same light, and brings no measured period; the page's axis is never
changed, and a period measured here goes into the star's measurements record; `new-object-cli.mts --pixel-light` writes the
reduction's verdict, mission, window and light scatter into the record of every star it looked at, mapped or not). A kind whose maps are how the star looks
supplies `natural`: the newest map in the star's own color, which becomes the dataset the page opens on
(`Color + brightness`). It is the Brightness map's scale drawn from a darker, richer step of the star's own hue up to its color (`tinted`, `DARK_STEP`; never toward black), far stronger than the
real contrast, which cannot be seen; its sentences say so with the star's number, and say what is measured (longitudes) and
what is not (latitudes, shapes, any color change). A map's scale is drawn from its range, never a reason to leave a star out: a receipt gives the range to a tenth of a percent, and a map that reads 100 to 100 there takes it from its table (`mapRange`).
A table written with seven decimals is filed under `fine/` in its mission's directory (`tableDirectory`): the source mirror keeps the first bytes published at a path, so a table written again takes a new one.
A kind's steps take its `stepGroup` id, or that id with `-maps` after it on a page whose other datasets already hold it as a dataset's id or a group's (a published map filed as `brightness`).
`--bake` takes 40 stars a command, and removes a star's stale arrival picture just before its own group is baked. A new calculation is a new kind and a line in `MAP_ROUTES`, not a second writer.

`pulsation/` is the kind for a pulsating star's light through one cycle (`--from-pulsation`, a spec's `pulsations`). It measures
and fits nothing: the light is the Fourier model the star's source publishes, the Gaia DR3 `vari_cepheid` row the package keeps
(`photometry/gaia-dr3-vari-cepheid.csv`, light-curve.mts), read and checked by `@cssearth/bake/photometry`, and a step is that
model's value at one phase as a share of the light at maximum. A step is how the star looks, so the kind supplies `look` (the
star's color dimmed in linear light, the first dataset's limb as it is, no legend) and one table for all its steps (`tableOf`,
`variableOf`). Ten steps a tenth of a period apart is a display choice (`PHASES`). No color or size change is drawn: add one
only with a published calibration, or a paper's own measurement, that covers the star, never a relation chosen here. A page
that plays the same model over its disc names the step group in its profile (`lightCurve.stills`), and the bake takes the veil
off those datasets. A star whose package names no Gaia source is tied to its row by its place and its catalogue row's period
(`installPublishedModel`; both limits are stated in the note as this repository's). The page keeps its default dataset
([method note](../../docs/pulsating-stars-light-through-a-cycle.md)).

The papers API behind `telescope papers` is `src/papers.mts` and `src/papers/`. There is one search path: `findWorks`
(`papers/works.mts`) asks OpenAlex, then arXiv when OpenAlex refuses, and the command and the star survey both call it; a
second query builder is not added beside it. `papers/names.mts` owns how a target and a subject are written (every spelling,
singular and plural), `papers/text.mts` the sentences quoted from a full text, and `papers/follow-ups.mts` what was
published after a paper (the works under its title, which is how an erratum is found, and the works that cite it). OpenAlex
meters searches by a daily budget, so a new feature spends one search where it can, never one for each work; the key is read
from `OPENALEX_API_KEY` and sent as a header, never written to a URL, a report or a fixture.

The sky band composer is `src/sky/` (exported as `./sky/*`): `sky-band-composite.mts` composes pinned hips2fits, AllWISE
atlas and JWST level-3 bands on one TAN grid, and `author-sky-bands.mts` acquires and pins those bands. It moved from
`tools/objects/observation/` (now here) because it imports this package's JWST imaging modules. `site/build/prepare/catalog/prepare-volume-presentation.mts`
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

Renderer runtime exceptions are file-scoped in [the architecture rule](../../.github/scripts/architecture/dependencies/preparation-without-renderer.mts):
`src/delivery/spatial-handoff.mts` runs physical resource loaders; `src/sphere/native-scroll/native-camera.mts`,
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
