# @cssearth/telescope-cli

The `telescope` command lets a person start with a target or an existing artifact. It saves bounded discovery evidence, retrieves an exact chosen product with its qualification evidence, and distinguishes exploration from a fulfilled scientific request. `package.json` exposes a `telescope` binary, not an HTTP API. The implementation is this package's `src/`; the library it builds on is [`@cssearth/telescope`](../telescope/README.md#library).

The package supplies the command, not the observatory pipelines or catalogue. It needs a **css.earth science checkout** with the telescope API, source manifests and any required Python environments. Pass `--workspace PATH` or set `CSSEARTH_WORKSPACE`; inside the checkout it finds the workspace automatically and runs the checkout's `packages/telescope-cli/src/cli.mts` with the same arguments, TTY state and exit code. Caches stay in the checkout; deliveries go to your `--out` directory. npm installation does not download a checkout, install Python or run pipelines. Updating the npm package does not update the checkout's science code. `telescope --version` reports the wrapper version; each product receipt records the scientific software and inputs used.

## Setup

Use Node 22.18+ (22.x) or Node 24+. Run `node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts astroquery install` once for the pinned archive client (it includes pinned Matplotlib), then `verify` in place of `install` to check it. PDS decoding uses the same script with `pds install`. Some reduction routes need instrument toolchains described in their own guides.

Inside the repository, use `pnpm telescope --help`. To test the distributable:

```sh
pnpm --filter @cssearth/telescope-cli pack --pack-destination .
npm install -g ./cssearth-telescope-cli-0.2.0.tgz
export CSSEARTH_WORKSPACE=/path/to/css.earth
```

## Use

```sh
telescope explore eris
telescope explore eris --kind cube --wavelength 2.2,2.4 --out runs/eris
telescope explore "Sgr A*" --kind cube --instrument ERIS
```

A name the catalogue does not ship is resolved by SIMBAD, and records are selected by SIMBAD's identifiers and position error circle. `--icrs-circle` is a cutout: it cuts the product and replaces that search circle. Use `--instrument NAME` and `--from ISO --to ISO` to narrow live Keck, Gemini and Chandra queries.

In a terminal, `explore` shows the observations, unknown metadata, unsupported records and provider limits, then asks which observation to retrieve. Press Enter to keep the exploration without retrieving. With `--json` or redirected input or output it never prompts. Without `--out` it creates a run under `./telescope-runs/`. The saved `outcome` has a `selection` (`available` or `none`) and a `coverage` (`target-unresolved`, `incomplete` or `bounded`). Even `bounded` describes only the configured searches, not every observatory. An empty search is not proof that no observations exist.

`telescope fetch RUN/explore.json --archive ARCHIVE --pick N --out NEW_DIRECTORY` retrieves one raw source from `keck`, `gemini`, `chandra`, `spitzer` or `opus`. When a Chandra ObsID or Spitzer AOR has several science files, pass `--file NAME`. A failed Gemini, OPUS, Chandra or Spitzer fetch keeps completed files in `NEW_DIRECTORY.partial`; repeat the same command with `--resume`. A fetched raw file is not qualified for detection, calibration or scientific use.

`explore` also lists [WorldWide Telescope imagery](../../docs/astronomy-package-ownership.md#worldwide-telescope-data-reuse) as curated display images, not numbered choices. `telescope wwt-image RUN/explore.json --pick N --level 0..3 --out NEW_DIRECTORY` writes `image.png` and `source.json`. Check the publisher's reuse terms before publishing a derived asset. `telescope wwt-fits RUN/explore.json --pick N --level 0 --x 0 --y 0 --out NEW_DIRECTORY` retrieves one numeric FITS tile from WWT's PHAT collection ([MAST record](https://archive.stsci.edu/hlsp/phat)); the tile has no BUNIT, uncertainty or celestial WCS.

`telescope ascl NAME` searches the [Astrophysics Source Code Library](https://ascl.net/); with `--product PATH` it checks a delivery's software names against ASCL titles. A title match is only a citation lead.

`telescope simulations OBJECT` lists the Zenodo dataset records that name the object and speak of a simulation or a model, each with its license, size and files. It downloads nothing, and a listed record is a lead. To show one, read its paper and write an entry for `node packages/telescope-cli/src/new-object/new-object-cli.mts --simulation entries.json` ([simulation-dataset.mts](src/new-object/simulation/simulation-dataset.mts) documents the entry). That command checks the record's license, that it names the object and that it lists the file, brings the file into the body's source directory, and writes the dataset with its labels. The [published simulations](../../.agents/skills/celestial-skill/references/scientific-faithfulness.md#published-simulations) rule gives the conditions.

When you know the scientific acceptance criteria, save an explicit request:

```sh
telescope query eris --wavelength 2.2,2.4 --kind cube \
  --any-time --min-arcsec 1 --out runs/eris-request
telescope get runs/eris-request --pick 1
```

The number binds to the recorded observation identity in that snapshot. `get` reloads current archive and qualification information; a stale choice needs a new exploration. Each `pick-N/` holds `result.json` and a `files/` tree with the native output set and its evidence. `get --offline` replays a delivered artifact without a remote refresh. Queries also search ESO/ALMA ObsCore and ESA PSA EPN-TAP through PyVO; see [protocol ownership and limits](../../docs/vo-observation-access.md) and [the ESO spectrum profile](../../docs/vo-observation-access.md#eso-sdp-spectra).

`--json` gives machine-readable stdout, `--verbose` shows full diagnostics, and progress goes to stderr. Exit codes: **0** completed or fulfilled; **1** failed; **2** invalid arguments; **3** no retrievable choices or unresolved requirements; **4** the product refuses the request. Exit 0 from exploration makes no scientific claim.

## Supported v1 boundary

| Current artifact | Supported next operation | Additional input |
| --- | --- | --- |
| Qualified native delivery | image, spectrum, band image, aperture spectrum or feature map when `outputs` offers it | Explicit selectors reported by `outputs` |
| Exported 2D measurement | projected body map | Pinned navigation geometry |
| Projected body map | standalone interactive sphere | Complete embeddable standard body package |
| Existing prepared point field, density volume or volume dataset bank | portable renderer handoff | None |

These are supported transitions, not claims that every product supports every row. Run `telescope outputs ARTIFACT` to see what an artifact actually supports. Export never turns an unresolved or refused request into a fulfilled one.

## Using a result in a body scene

```sh
pnpm --silent telescope explore ceres --json --out output/ceres-telescope
pnpm --silent telescope get output/ceres-telescope --pick N --json
pnpm --silent telescope outputs output/ceres-telescope/pick-N/result.json --json
```

`export --output body-map` projects a verified 2D image but is not a published layer: [`body-map-publication.mts`](src/body-map-publication.mts) checks an author-produced map separately. `export --output sphere` makes standalone HTML, not a site dataset. To add a site dataset, use the body's [package guide](../../src/objects/README.md) and the [surface preparation owner](../../docs/surface-preparation.md); [Ceres's clay-band recipe](../../src/objects/ceres/source/preparation/raster.json) is an example. No command promotes an arbitrary delivery into a body's renderer.

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

Every contributing sample must be valid. Aggregate uncertainties are omitted unless you pass `--uncertainty independent`. Select ambiguous PDS arrays with `--structure NAME` and `--hdu 0`. [Real Eris examples](../../docs/virtual-telescopes.md#example-exports-eris-jwst-nirspec-ifu).

```sh
telescope export MEASUREMENT/output.product.json --output body-map --geometry navigation.json --out MAP
telescope export MAP/map.fits.product.json --output sphere --out SPHERE
telescope export src/objects/stellar-neighbourhood/object.json --output points --out stars
telescope export src/objects/milky-way-volume/object.json --output volume --out galaxy
telescope export src/objects/lmc-volume/object.json --output volume-dataset-bank --out lmc-datasets
```

The navigation file pins SPICE kernels. The sphere is a standalone HTML file with no JavaScript. See the [navigation contract](../../docs/virtual-telescopes.md#projection-and-sphere). Physical handoffs copy prepared renderer files and credits; restore missing inputs with `setup:prepared --object=ID`.

## Independent output checks

The [output oracle](src/output-oracle.mts) reads the pinned FITS data independently of the production reducer, using Specutils 2.4.0 and Photutils 3.0.0 as optional test dependencies:

```sh
output/toolchains/astroquery/env/bin/python -m venv --system-site-packages work/telescope-oracles/env
work/telescope-oracles/env/bin/python -m pip install -c packages/telescope/toolchains/requirements.lock -r packages/telescope/toolchains/oracle-requirements.txt
node packages/telescope-cli/src/output-oracle.mts figures/eris-band work/telescope-oracles/env/bin/python output/oracles/eris-band
CSSEARTH_ORACLE_PYTHON="$PWD/work/telescope-oracles/env/bin/python" node --test packages/telescope-cli/src/cube-outputs.test.mts
```

It fails above 1e-10 of the reference peak. It verifies numerical extraction only, not archive calibration, covariance, aperture corrections or detection significance.

Sphere silhouette framing uses `@cssearth/engine`; prepared loader and retained renderer consumers remain separate from this numeric contract.

Renderer runtime exceptions are file-scoped in [the architecture rule](../../.github/scripts/architecture/preparation-without-renderer.mts):
`src/spatial-handoff.mts` runs physical resource loaders; `src/sphere/native-scroll/native-camera.mts`,
`src/sphere/sphere-html.mts` and `src/sphere/sphere-oracle.mts` publish retained scenes.
The package keeps its renderer dependency for these four consumers. F16 validation uses objects contracts.
