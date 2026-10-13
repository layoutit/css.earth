# @cssearth/telescope

The `telescope` command lets a person start with a target or an existing artifact. It saves bounded discovery evidence, retrieves an exact chosen product with its qualification evidence, and distinguishes exploration from a fulfilled scientific request. `package.json` exposes a `telescope` binary, not an HTTP API. The implementation is this package's `src/`; the library it builds on is [`@cssearth/telescope-core`](../telescope-core/README.md#library).

The installed CLI runs without a css.earth checkout. Async astronomy queries install their pinned Python environment on first use; npm installation itself does not run pipelines. The npm package includes the implementation, target catalogue and archive inputs.

Paths are owned by the library:

- **User root:** `CSSEARTH_TELESCOPE_HOME`, otherwise `~/Library/Caches/cssearth-telescope` on macOS, `$XDG_CACHE_HOME/cssearth-telescope` or `~/.cache/cssearth-telescope` on Linux, and `%LOCALAPPDATA%\cssearth-telescope` on Windows. Archive answers, MAST and Astroquery caches, toolchains, installed markers and scratch use this root, including in checkout mode. Exploration sessions default to its `telescope-runs/`; `--out` selects a delivery directory.
- **Optional workspace:** `--workspace PATH` takes precedence over `CSSEARTH_WORKSPACE`. Source entries launched from inside their own css.earth checkout also admit it, as `pnpm telescope` does. Merely importing checkout sources from another directory does not. Site authoring, `new-object`, bake and developer reductions require it and fail with `this command needs a css.earth checkout: pass --workspace` when absent.
- **Package data:** requirements locks, descriptors, notices, examples and modes resolve from the owning package. Programs and their preserved receipts use the selected workspace's archive program folders for both reading and authoring. Without a workspace, shipped programs are read-only and authoring is refused. Outside a workspace, the target loader reads `data/target-catalogue.json` in this package; the build generates that array of target catalogue entries. If it is missing, unknown targets still go to SIMBAD. Malformed snapshots are errors. Read-only archive ledgers and WWT catalogues use `data/src/sources/` outside a workspace.

With a workspace, target names and site records still come from `src/objects` and `src/sources`. Compatible toolchains in an admitted checkout or the legacy home Astroquery cache can be read after exact pin validation. New installs and writable caches use the selected user root.

Without a workspace, `new-object` (every drafter, `SPEC.json`, `--check`, `--bake` and `--skip-existing`) and physical volume preparation exit 2 before writing site records. The standalone alternative is `telescope export RESULT --output html --out DIRECTORY`.

## Setup

Use Node 22.18+ (22.x) or Node 24+. No system Python or micromamba is required: installers obtain Python from conda-forge. The telescope uses `CSSEARTH_TELESCOPE_MICROMAMBA` first, then a micromamba on `PATH`, otherwise downloads official micromamba release 2.9.0-0 into the user root and checks its published checksum in memory. Download progress goes to stderr; interrupted transfers restart cleanly when the same command is retried with network access.

Managed Python toolchains need macOS or Linux; on Windows use WSL. Commands that need no Python remain available on Windows. Some instrument locks target a specific Unix platform; consult their descriptors before installing.

Archive clients and PDS decoding install their pinned Python environments on demand. The astronomy environment builds orbitize and batman from source: a working C compiler and C standard-library headers are prerequisites. On macOS, install the Command Line Tools and SDK with `xcode-select --install`; on Debian/Ubuntu use `sudo apt install build-essential`; on Fedora use `sudo dnf install gcc`. The installer checks these before creating the environment. Python-free archives remain searchable if this prerequisite is missing. Install explicitly with `telescope toolchain install astroquery`, and check it with `telescope toolchain verify astroquery`. Some reduction routes need instrument toolchains described in their own guides; native compilers, Julia, IDL or Rosetta requirements still follow those descriptors.

Install the command without a checkout:

```sh
npm i -g @cssearth/telescope
telescope --help
```

For site development, use `telescope --workspace /path/to/css.earth …` with the checkout's installed dependencies. This uses that checkout's data and scripts for `new-object` and bake. Inside the checkout, `pnpm telescope …` runs the source implementation directly.

## Agent skill

The npm package ships one [telescope skill](skills/telescope/SKILL.md). Choose the host you use after installing the CLI; each line below is an independent host choice.

```sh
npm install -g @cssearth/telescope
telescope --help
telescope skill install --provider claude
telescope skill install --provider codex
telescope skill install --provider agents
telescope skill install --provider grok
telescope skill install --provider agy
telescope skill install --provider antigravity
telescope skill install --provider cursor
telescope skill install --provider opencode
```

For another host or a project, use `telescope skill install --dest /absolute/path/to/skills`. Add `--copy` for independent files, including where Windows directory symlinks are unavailable. The default link points into the installed npm package: keep that installation in place. Use a persistent install before linking, or `npx @cssearth/telescope skill install --provider codex --copy` for a copy. Add `--json` for machine-readable results.

Destinations:

| Host | Skills directory |
| --- | --- |
| Claude | `$CLAUDE_CONFIG_DIR/skills`, otherwise `~/.claude/skills` |
| Codex | `$CODEX_HOME/skills`, otherwise `~/.codex/skills` |
| Agents, Grok | `~/.agents/skills` |
| Agy | `~/.gemini/antigravity-cli/skills` |
| Antigravity | `~/.gemini/config/skills` |
| Cursor | `~/.cursor/skills` |
| OpenCode | `$XDG_CONFIG_HOME/opencode/skills`, otherwise `~/.config/opencode/skills` |

A provider or destination is required. Repeated installation is a no-op. Unrelated files, directories and links are refused. Copies carry `.telescope-install.json`, recording ownership and exact file bytes and directory membership. To switch modes or update an unchanged copy, uninstall first. Changed copies remain intact. `telescope skill uninstall --provider NAME` (or `--dest DIRECTORY`) removes only this package's link or an unchanged owned copy; it leaves other skills and host configuration alone. Restart the host to rediscover installed skills.

### Native plugin marketplaces

The repository's marketplaces list `@cssearth/telescope` as an npm plugin source. These commands require a published npm release and the marketplace files on the selected repository branch. From a local checkout, replace `layoutit/css.earth` with its absolute root path.

```sh
claude plugin marketplace add layoutit/css.earth
claude plugin install telescope@cssearth-telescope
codex plugin marketplace add layoutit/css.earth
codex plugin add telescope@cssearth-telescope
droid plugin marketplace add layoutit/css.earth
droid plugin marketplace list
droid plugin install telescope@css.earth --scope user
```

Choose only your host's pair of commands. Factory derives the registered marketplace name from the source; use the name printed by `marketplace list` in `telescope@NAME` (a local checkout's directory name can differ). Claude and Codex use the manifest's `cssearth-telescope` name. The package keeps skills at its root and ships all three host manifests, including Codex's compatibility manifest. It needs no lifecycle script to build the skill.

Schema checks were compared with current [Claude plugin](https://code.claude.com/docs/en/plugins-reference) and [marketplace](https://code.claude.com/docs/en/plugins/marketplace-reference), [OpenAI plugin](https://developers.openai.com/plugins/build/plugins), and [Factory plugin](https://docs.factory.com/harness/plugins) documentation. All document npm plugin sources. Claude and Codex accept root-relative skill paths; Factory discovers `skills/<name>/SKILL.md` by layout and does not read the manifest's component fields. Native plugin installation and standalone skill installation are separate; use one route per host.

Pi reads `pi.skills` from the npm metadata: `pi install npm:@cssearth/telescope`. Other supported hosts can discover the packaged folder through `npx skills add https://github.com/layoutit/css.earth/tree/main/packages/telescope-cli/skills/telescope`; this depends on the current skills CLI and the folder being available on that branch.

## Use

```sh
telescope explore eris
telescope explore eris --kind cube --wavelength 2.2,2.4 --out runs/eris
telescope explore "Sgr A*" --kind cube --instrument ERIS
```

A name the catalogue does not ship is resolved by SIMBAD, and records are selected by SIMBAD's identifiers and position error circle. With a TARGET, `--icrs-circle` is a cutout: it cuts the product and replaces that search circle. `telescope explore --icrs-circle 83.82,-5.39,0.1` searches a field without a target name; name-only archives are reported as not searched, with incomplete coverage. Use `--instrument NAME` and `--from ISO --to ISO` to narrow live Keck, Gemini and Chandra queries.

In a terminal, `explore` shows the observations, unknown metadata, unsupported records and provider limits, then asks which observation to retrieve. Reductions that write workspace programs or ledgers are listed as unsupported without an admitted workspace, with the reason `needs a css.earth checkout: pass --workspace`; they remain selectable with a workspace. Press Enter to keep the exploration without retrieving. With `--json` or redirected input or output it never prompts. Without `--out` it creates a run under the user root's `telescope-runs/`. The saved `outcome` has a `selection` (`available` or `none`) and a `coverage` (`target-unresolved`, `incomplete` or `bounded`). Even `bounded` describes only the configured searches, not every observatory. An empty search is not proof that no observations exist.

`explore` asks every archive at once and reports the ledgers that index the target, the ESPaDOnS polarised spectra at CADC among them; an archive that drops the connection is asked again, twice. Keck and Gemini are asked by the target's place on the sky as well as by name. A question asked in the last day is answered from its saved answer; `--fresh` asks every archive again.

`telescope fetch RUN/explore.json --archive ARCHIVE --pick N --out NEW_DIRECTORY` retrieves one raw source from `keck`, `gemini`, `chandra`, `spitzer` or `opus`. When a Chandra ObsID or Spitzer AOR has several science files, pass `--file NAME`. A failed Gemini, OPUS, Chandra or Spitzer fetch keeps completed files in `NEW_DIRECTORY.partial`; repeat the same command with `--resume`. A fetched raw file is not qualified for detection, calibration or scientific use.

`explore` also lists [WorldWide Telescope imagery](../../docs/astronomy-package-ownership.md#worldwide-telescope-data-reuse) as curated display images, not numbered choices. `telescope wwt-image RUN/explore.json --pick N --level 0..3 --out NEW_DIRECTORY` writes `image.png` and `source.json`. Check the publisher's reuse terms before publishing a derived asset. `telescope wwt-fits RUN/explore.json --pick N --level 0 --x 0 --y 0 --out NEW_DIRECTORY` retrieves one numeric FITS tile from WWT's PHAT collection ([MAST record](https://archive.stsci.edu/hlsp/phat)); the tile has no BUNIT, uncertainty or celestial WCS.

`telescope ascl NAME` searches the [Astrophysics Source Code Library](https://ascl.net/); with `--product PATH` it checks a delivery's software names against ASCL titles. A title match is only a citation lead.

`telescope leads OBJECT` asks DataCite, which registers the DOIs of Zenodo, Dryad, Dataverse, Figshare, university repositories, the CDS and MAST and of every arXiv preprint, for the records that name the object and speak of a measured phase curve or map, a measured eclipse, or a model. It lists them in the order a page prefers them, the ones that name the object in their title first. `telescope leads --class exoplanet` asks for every object of the class, ten a request, and ranks the objects with what each page opens on, the pages without a map first ([leads.mts](src/simulations/leads.mts)). A lead is read before anything is shown: a paper's fitted phase-curve table goes to `new-object --phase-curve`, a released model field to `new-object --simulation`. Three more things are set beside the papers, each from a few bulk answers. A lead that the page's `investigations.json` decides against or puts off, in an entry whose evidence or finding names its DOI, its arXiv number or the journal DOI its preprint is a version of, is marked with that entry and leaves the survey's worklist: to stop a paper being offered again, write its entry ([read.mts](src/simulations/read.mts)). An `included` entry marks a lead and does not remove it: a paper a ledger cites for a radius has not thereby been read for its phase curve. JWST's time series of a planet's star, from one MAST request, are set on the planet's recorded orbit: a visit of a whole orbit is a phase curve in the archive, one that holds an eclipse place and no transit is an eclipse, and each is listed with the phase it starts at and the day it becomes public ([observed.mts](src/simulations/observed.mts)). The eclipse is looked for half an orbit after transit and where the recorded eccentricity puts it, and a visit that holds either is listed. That is geometry and dates: a visit is of the star and may have been made for another of its planets, and public means the data, not a paper. And the exoplanet survey lists the planets of the NASA Exoplanet Archive with no page that would be added with something to draw: one an arXiv title says has a phase curve or a map, or one the archive itself holds an eclipse of, in its composite table's occultation depth or its emission-spectrum table ([unpaged.mts](src/simulations/unpaged.mts)). A class is read from a record's words, so a model paper that speaks of a night side is listed with the measured ones until it is read; a catalogue paper that names its planets only in a table is not found.

`telescope simulations OBJECT` lists the Zenodo dataset records that name the object and speak of a simulation or a model, each with its license, size and files. It downloads nothing, and a listed record is a lead. To show one, read its paper and write an entry for `node packages/telescope-cli/src/new-object/new-object-cli.mts --simulation entries.json` ([simulation-dataset.mts](src/new-object/simulation/simulation-dataset.mts) documents the entry). That command checks the record's license, that it names the object (in its title or description, or in the model file's own name, as a release of several planets' runs does) and that it lists the file, and writes the dataset with its labels. It never fetches the release whole: two range requests bring the file's first bytes (its header and coordinate variables) and the bytes of the selected grid into the body's source directory, each declared with its byte range in the source manifest. A 3.5 GB run costs about 130 kB. A release that is a ZIP archive holding the model file is named with `member`: NetCDF-4 spreads its structure through the file, and a member of any format is taken out of its archive whole, so the file is kept whole, outside git. Several entries may name one file: its header, or the whole member, is then one source record with every dataset among its consumers. The [published simulations](../../.agents/skills/celestial-skill/references/scientific-faithfulness.md#published-simulations) rule gives the conditions.

`telescope new-object --from-esa PAGE_ID=PICTURE_URL... --out SPEC.json` drafts a published picture as one more dataset of a page that already shows a shaped layer bank: a picture ESA publishes for Hubble or Webb (`m57=https://esawebb.org/images/weic2320c/`). It reads the picture's page (title, credit, release date, colors) and the sky tags in its JPEG, finds the star the picture shows where the tags put the page's place, and names the bank the picture will lie on like: the one the page opens on. A picture that does not hold the page's place is refused. The picture fades out on a circle about that place: the largest the frame holds, or, for a mosaic that does not fill its frame, the largest its own light fills. A person then writes the dataset's sentences and, under `geometry`, what this picture's light takes on those walls: printed values, each with its source. `telescope new-object SPEC.json` writes the new bank's records, the picture, the page's dataset and a README whose measured lines are filled in; `--bake` bakes the banks and their pages in one chain. A spec can be run again after a change, and the README a person wrote is kept. The entry's fields are in [picture-bank.mts](src/new-object/pictures/picture-bank.mts).

`telescope new-object --from-magnetic HOST... --out SPEC.json` drafts a star's corona from the magnetic maps its page already shows: one entry for each star, with every radial-field map of its raster recipe, its X-ray flux from the ROSAT all-sky survey's stars (Freund et al. 2022) and the two published relations that stand in for a coronal temperature and a mass loss nobody has measured. It prints each star's X-ray luminosity, temperature, mass loss and the wind's sonic point, and says which stars the method refuses. A person replaces a relation by a cited measurement where one exists. `telescope new-object SPEC.json --bake` then writes each star's volume bank (`src/objects/<star>-corona/`), adds a "Derived corona" dataset to the star with one step for each map, and bakes both. Every sentence it writes says the corona is derived here, not observed and not published; the method and what it was checked against are in [the shared note](../../docs/stellar-corona-from-magnetic-maps.md).

`telescope stars GALAXY` counts the stars SIMBAD lists inside a galaxy's catalogued outline by class (Cepheids, RR Lyrae stars, long-period variables, supergiants), names the papers they come from, and reads VizieR's tables of those papers for what a placed star needs: a period and a position of its own. It also names the single stars of no class that SIMBAD holds there with no parallax and no proper motion, the most cited first: a star one paper studied alone (M51-DS1) is often typed a plain star, and is drafted by hand from that paper. Last, it asks the papers API (OpenAlex, with arXiv when OpenAlex's daily budget is spent; the same index `telescope papers` reads) for the works whose title or abstract names the galaxy and a kind of star, those with the star in the title first: SIMBAD and VizieR take months to hold a new paper and never hold some, so a 2026 paper of Cepheids in M61 and M77 and a 2003 paper of one star in NGC 253's halo were found only there. It downloads nothing, and a star SIMBAD lists inside the outline may still be in front of the galaxy. A table it calls ready drafts a star: `telescope new-object --from-table cepheid:m81=J/ApJ/743/176/table1 --out spec.json` writes the spec of one Cepheid of that table, placed where its sight line crosses the disc the galaxy is drawn as ([table-stars.mts](src/new-object/archives/tables/table-stars.mts) documents the row choices). A table that gives every row its galaxy's centre, as a reanalysis does, places its stars at SIMBAD's position of the SIMBAD name CDS added to each row. A table that lists each star by its detector pixel (a chip, X and Y, as the Hubble Cepheid papers do) needs the exposure those pixels were measured on, which only the paper says: `--from-table "cepheid:m66=J/ApJ/529/723/appen#exposure=mast:HST/product/u35i0101r_c0m.fits,firstPixel=1"` reads that chip's header from MAST by byte range (11,520 bytes of a 10 MB file) and places the star where the header's world coordinates put the pixel. `firstPixel` is the coordinate the paper's software gives the centre of the first pixel: 1 for DAOPHOT and ALLFRAME, 0.5 for HSTphot. The position is Hubble's pointing as archived, not registered against a catalogue: on the one exposure checked, a supernova with a catalogued position fell 1.2″ from it ([image-pixel.mts](src/new-object/archives/images/image-pixel.mts)); a hand-written spec does the same with `position.archive: "mast"`. Coordinates a paper prints in a table that neither VizieR nor SIMBAD holds yet are used as printed with `position.archive: "paper"`: the paper is cited by its DOI and nothing is archived.

When you know the scientific acceptance criteria, save an explicit request:

```sh
telescope query eris --wavelength 2.2,2.4 --kind cube \
  --any-time --min-arcsec 1 --out runs/eris-request
telescope get runs/eris-request --pick 1
```

The number binds to the recorded observation identity in that snapshot. `get` reloads current archive and qualification information; a stale choice needs a new exploration. Each `pick-N/` holds `result.json` and a `files/` tree with the native output set and its evidence. `get --offline` replays a delivered artifact without a remote refresh. Queries also search ESO/ALMA ObsCore and ESA PSA EPN-TAP through PyVO; see [protocol ownership and limits](../../docs/vo-observation-access.md) and [the ESO spectrum profile](../../docs/vo-observation-access.md#eso-sdp-spectra).

`--json` gives machine-readable stdout, `--verbose` shows full diagnostics, and progress goes to stderr. Exit codes: **0** completed or fulfilled; **1** failed; **2** invalid arguments; **3** no retrievable choices or unresolved requirements; **4** the product refuses the request. Exit 0 from exploration makes no scientific claim.

### Magnetic maps of stars from archived spectra

The following source scripts and authoring examples require a development checkout. Toolchain installations and reduction outputs use the user root; programs are written to the admitted workspace.

A star's magnetic field can be mapped from a series of polarised spectra taken through one rotation. The tools of
`src/archives/espadons/` do that for the spectra of CFHT's ESPaDOnS spectropolarimeter in the Canadian Astronomy Data Centre,
with the codes the method's authors publish (Korg, LSDpy, SpecpolFlow and ZDIpy), which `toolchain.mts install` installs once.
[A star's magnetic map from archived spectra](../../docs/stellar-magnetic-maps-from-spectra.md) describes each step, what
the result was checked against and what it cannot do.

```sh
node packages/telescope-cli/src/archives/espadons/toolchain.mts install
node packages/telescope-cli/src/archives/espadons/archive.mts --runs --ra 300.182 --dec 22.711   # the star's observing runs
node packages/telescope-cli/src/archives/espadons/archive.mts hd-189733-2007-06 --name "HD 189733" --ra 300.182 --dec 22.711 --from 2007-06-20 --to 2007-07-06
node packages/telescope-cli/src/archives/espadons/reduce.mts hd-189733-2007-06
```

`archive.mts` writes a program beside the code, with each spectrum pinned by its size. Before `reduce.mts` can run, the
program needs three blocks a person fills from catalogues and papers, each value with where it is printed: `atmosphere`
(temperature, gravity), `radialVelocity`, and `star` (rotation period, tilt, projected rotation speed, the highest harmonic
degree). `reduce.mts` writes a receipt, the map as a table and a picture under `output/espadons/` in the user root; git holds the program, not the result.
`telescope new-object --from-spectra STAR --out SPEC.json` then drafts the star's reduced maps as datasets of its page.

### A star's rotation and brightness map from the TESS, K2 and Kepler missions' light curves

The K2 and TESS missions publish light curves of the stars they were asked to watch. The tools of `src/archives/tess/` and
`src/archives/kepler/` read those light curves as they are, have a published method for the star's kind decide whether its
rotation is seen in them, and have starry fit the brightness map that reproduces the light curve. A Kepler star is read
from its KEPSEISMIC light curve, on the rotation Santos et al. (2019, 2021) published for it, and a star MEarth-South
watched from the ground (`src/archives/mearth/`) from its MEarth light curve, on the rotation Newton et al. (2018)
published for it. That path has a toolchain of its own: `node packages/telescope-cli/src/archives/mearth/toolchain.mts install`.
[A star's rotation and brightness map from the TESS, K2 and Kepler missions' light curves](../../docs/stellar-brightness-maps-from-tess.md)
describes each step, each method with its paper, and what a light curve cannot fix.

```sh
node packages/telescope-cli/src/archives/tess/toolchain.mts install
node packages/telescope-cli/src/archives/tess/reduce.mts au-mic      # or --all: every star not yet judged
```

`reduce.mts` asks MAST for the star's light curves, has the method judge them, and writes a receipt, each light curve and,
when the rotation is accepted, one map a sector, campaign or quarter as a table under `output/tess/` in the user root. A TESS
target whose pixels the TESS Input Catalog gives too much of other stars' light (a contamination ratio of 0.2 or more) is
not read.
`telescope new-object --from-pixels all --out SPEC.json` then drafts every reduced star's maps as datasets of its page.

A star an interferometer resolved on several nights while it turned gets one surface fitted to all of them with ROTIR
(`src/archives/interferometry/surface-star.mts`), from a season record that pins the calibrated files, the star's published
size, limb, axis and period, and the settings.
[Interferometric imaging](../../docs/interferometric-imaging.md#a-star-that-turns-between-its-nights) gives the checks that
decide whether the map is cast and what in them is this repository's reading.

```sh
node packages/telescope-cli/src/archives/interferometry/toolchain.mts install rotir
node packages/telescope-cli/src/archives/interferometry/surface-star.mts packages/telescope-cli/src/archives/interferometry/seasons/udkadua-mirc-2011-09 output/interferometry/udkadua-mirc-2011-09
```

A spec's `resolvedMaps` (a host, and for each map the season's id, a dataset id and a label) then puts a cast map on the
star's page with `telescope new-object SPEC.json --bake`.

A pulsating star's light through one cycle is not reduced here: it is the model its source publishes. A Cepheid's package
keeps its row of Gaia DR3's `vari_cepheid` table, and `telescope new-object --from-pulsation all --out SPEC.json` drafts
ten steps of that model, a tenth of a period apart, as one dataset group of the star's page
([method note](../../docs/pulsating-stars-light-through-a-cycle.md)). `gaia:HOST` first looks up a star whose package names
no Gaia source: the one Cepheid of that table within an arcsecond of its place, with its catalogue row's period.

## Supported v1 boundary

| Current artifact | Supported next operation | Additional input |
| --- | --- | --- |
| Qualified native delivery | image, spectrum, band image, aperture spectrum or feature map when `outputs` offers it | Explicit selectors reported by `outputs` |
| Exported 2D measurement | projected body map | Pinned navigation geometry |
| Exported image or spectrum | standalone HTML with its receipt | None |
| Projected body map | standalone fixed sphere | Complete embeddable standard body package |
| Existing prepared point field, density volume or volume dataset bank | portable renderer handoff | None |
| Existing prepared point field | standalone HTML using the site SVG point layer | None |
| Prepared density volume without sky or impostor banks | standalone HTML using the site slab renderer | None |

These are supported transitions, not claims that every product supports every row. Run `telescope outputs ARTIFACT` to see what an artifact actually supports. Export never turns an unresolved or refused request into a fulfilled one.

## Using a result in a body scene

```sh
pnpm --silent telescope explore ceres --json --out output/ceres-telescope
pnpm --silent telescope get output/ceres-telescope --pick N --json
pnpm --silent telescope outputs output/ceres-telescope/pick-N/result.json --json
```

`export --output body-map` projects a verified 2D image but is not a published layer: [`body-map-publication.mts`](src/delivery/body-map-publication.mts) checks an author-produced map separately. `export --output sphere` makes standalone HTML, not a site dataset. To add a site dataset, use the body's [package guide](../../src/objects/README.md) and the [surface preparation owner](../../docs/surface-preparation.md); [Ceres's clay-band recipe](../../src/objects/ceres/source/preparation/raster.json) is an example. No command promotes an arbitrary delivery into a body's renderer.

## Outputs

```sh
telescope families
telescope import import-spec.json --out imported-observation
telescope outputs runs/eris/pick-1/result.json
telescope export runs/eris/pick-1/result.json --output image --hdu 1 --plane 95 --out figures/eris-plane
telescope export runs/eris/pick-1/result.json --output spectrum --hdu 1 --pixel 25,27 --out figures/eris-pixel
telescope export runs/eris/pick-1/result.json --output band-image --hdu 1 --band 2.2,2.4 --out figures/eris-band
telescope export runs/eris/pick-1/result.json --output aperture-spectrum --hdu 1 --aperture 19,24,25,30 --background 29,24,35,30 --out figures/eris-aperture
telescope export runs/eris/pick-1/result.json --output feature-map --hdu 1 --band 2.30,2.34 --continuum 2.26,2.29,2.35,2.38 --out figures/eris-feature
```

In a terminal, `outputs` also asks which available operation to run. Family operations run through `telescope family-run`, and `telescope family-assess REQUEST.json PRODUCT.json --out DIR` checks a descriptor. Selectors are zero-based. Exports write FITS or ECSV, PNG, SVG, CSV and a product record, using the same masks, units and wavelength coordinates as qualification. Output directories must be new.

- `band-image` is a mean weighted by spectral bin overlap with `--band`.
- `aperture-spectrum` is the mean over a rectangle `X0,Y0,X1,Y1` (exclusive upper bounds), minus a disjoint `--background` box or `--background none`. It is not total source flux.
- `feature-map` integrates the residual above a linear continuum from two `--continuum` bands, in the source unit × µm. It makes no chemical-identification or detection claim.

HTML embeds its images, styles and receipt and opens offline without scripts. Spectrum charts retain masked gaps and supplied uncertainties. Sphere HTML shows the prepared fixed view; the native CSS camera is omitted because it requires drawing variables. Point HTML uses the site SVG point layer in a prepared fixed view. Limits: composite volumes with sky banks, impostor banks or dataset banks are refused; these HTML viewers are planned for v2.

Every contributing sample must be valid. Aggregate uncertainties are omitted unless you pass `--uncertainty independent`. Select ambiguous PDS arrays with `--structure NAME` and `--hdu 0`. [Real Eris examples](../../docs/virtual-telescopes.md#example-exports-eris-jwst-nirspec-ifu).

```sh
telescope export MEASUREMENT/output.product.json --output html --out VIEWER
telescope export OBJECT_JSON --output html --out VOLUME_VIEWER
telescope export MEASUREMENT/output.product.json --output body-map --geometry navigation.json --out MAP
telescope export MAP/map.fits.product.json --output sphere --out SPHERE
telescope export src/objects/stellar-neighbourhood/object.json --output points --out stars
telescope export src/objects/milky-way-volume/object.json --output volume --out galaxy
telescope export src/objects/lmc-volume/object.json --output volume-dataset-bank --out lmc-datasets
```

The navigation file pins SPICE kernels. The sphere is a standalone HTML file with no JavaScript. See the [navigation contract](../../docs/virtual-telescopes.md#projection-and-sphere). Physical handoffs copy prepared renderer files and credits; restore missing inputs with `setup:prepared --object=ID`.

The published declarations reference Node types. TypeScript consumers install `@types/node` (an optional peer); the JavaScript CLI does not require it at runtime.

## Independent output checks

These optional checks run from a development checkout with its dependencies installed; they are not installed CLI commands. The [output oracle](src/delivery/output-oracle.mts) reads the pinned FITS data independently of the production reducer, using Specutils 2.4.0 and Photutils 3.0.0 as optional test dependencies:

```sh
export CSSEARTH_TELESCOPE_HOME="$PWD/output/telescope-oracle-user"
node --input-type=module -e 'import { astroqueryToolchain } from "@cssearth/telescope-core/node"; const { execFileSync } = await import("node:child_process"); const { python } = await astroqueryToolchain(); execFileSync(python, ["-m", "venv", "--system-site-packages", "output/telescope-oracles/env"], { stdio: "inherit" });'
output/telescope-oracles/env/bin/python -m pip install -c packages/telescope-core/toolchains/requirements.lock -r packages/telescope-core/toolchains/oracle-requirements.txt
node packages/telescope-cli/src/delivery/output-oracle.mts figures/eris-band output/telescope-oracles/env/bin/python output/oracles/eris-band
CSSEARTH_ORACLE_PYTHON="$PWD/output/telescope-oracles/env/bin/python" node --import ./packages/core/src/node/register-vite-suffix.mts --test packages/telescope-cli/src/delivery/cube-outputs.test.mts
```

It fails above 1e-10 of the reference peak. It verifies numerical extraction only, not archive calibration, covariance, aperture corrections or detection significance.

Sphere silhouette framing uses `@cssearth/engine`; prepared loader and retained renderer consumers remain separate from this numeric contract.

Renderer runtime exceptions are file-scoped in [the architecture rule](../../.github/scripts/architecture/dependencies/preparation-without-renderer.mts):
`src/delivery/spatial-handoff.mts` runs physical resource loaders; `src/sphere/native-scroll/native-camera.mts`,
`src/sphere/sphere-html.mts` and `src/sphere/sphere-oracle.mts` publish retained scenes.
The published JavaScript and declarations bundle these renderer consumers; the renderer is a checkout development dependency. F16 validation uses objects contracts.

Sphere export imports the built `@cssearth/telescope/sphere/lane` entry from `dist`. Without a workspace, it reads the compressed sphere bank shipped at build time, including shared geometry, raster layouts, styles and physical frames. With a workspace, it loads that checkout's generated solar geometry. The lane compiles only during package build. After editing `src/sphere/`, rebuild with `pnpm --filter @cssearth/telescope build` before exporting again.
