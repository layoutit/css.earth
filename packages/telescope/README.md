# @cssearth/telescope

The `telescope` command lets a person start with a target or an existing artifact. It saves bounded discovery evidence, retrieves an exact chosen product with its qualification evidence, and distinguishes exploration from a fulfilled scientific request.

This package supplies the command, not the observatory pipelines or catalogue. It uses a **css.earth science checkout** containing the telescope API, source manifests and any required Python environments. It can run from any directory with `--workspace PATH` or `CSSEARTH_WORKSPACE`; inside the checkout it finds the workspace automatically. Acquisition and reduction caches stay in that checkout, while deliveries go to your `--out` directory. The package does not download a checkout, install Python, or run pipelines during npm installation.

## Setup

Use Node 22.18+ (22.x) or Node 24+. Prepare a css.earth checkout with its documented dependencies. Archive discovery uses `node tools/cli/run-typed-module.mjs tools/objects/astronomy-packages/toolchain.mts install`; PDS decoding uses `node tools/cli/run-typed-module.mjs tools/objects/astronomy-packages/pds-toolchain.mts install`. Some reduction routes require additional instrument toolchains described by their existing guides.

The package has not been published by this PR. To test the distributable from the repository:

```sh
npm pack ./packages/telescope
npm install -g ./cssearth-telescope-0.1.0.tgz
export CSSEARTH_WORKSPACE=/path/to/css.earth
```

## Use

Start with a target when you want to see what is available:

```sh
telescope explore eris
telescope explore eris --kind cube --wavelength 2.2,2.4 --out runs/eris
telescope explore "Sgr A*" --kind cube --instrument ERIS
```

A name the catalogue does not ship, like the last one, is resolved by SIMBAD. The search then uses SIMBAD's identifiers and a
circle of SIMBAD's position error around its position (`--icrs-circle` replaces that circle). Archive records whose footprint
intersects the circle under another name are listed as in the field, not as the target.

In a terminal, `explore` shows the actual observations, unknown metadata, unsupported records and
provider limits in its saved snapshot, then asks which observation to retrieve. It does not download
or qualify a product until you select one. Press Enter at the prompt to leave the valid exploration
saved without starting a retrieval. With `--json`, redirected stdin, or redirected stdout, it never
prompts and emits the saved exploration as one JSON value. Without `--out`, it creates a unique run
under `./telescope-runs/` and reports that path.

Start with an existing supported artifact to inspect its source context and next operations:

```sh
telescope outputs runs/eris/pick-1/result.json
```

The human screen keeps unavailable operations and their blockers visible and prints concrete
`telescope export` command templates for available operations. In a terminal it also asks which
available operation to run, then requests only that operation's reported selectors and a new output
directory. Invalid selectors are rejected by the same command parser used by explicit exports and can
be entered again. Press Enter at any selection or parameter prompt to cancel before an export starts.
With `--json` or redirected input/output, inspection never prompts or starts an operation. The same
inspection is returned as structured data with `--json`. Supported inputs are telescope delivery
JSON, telescope product records, and prepared point-field or density-volume `object.json` packages.
A raw FITS or PDS file alone has no admitted provenance or qualification and is refused with that
boundary explained.

When you already know the scientific acceptance criteria, save an explicit request:

```sh
telescope query eris --wavelength 2.2,2.4 --kind cube \
  --any-time --min-arcsec 1 --out runs/eris
telescope get runs/eris --pick 1
```

Choose a number from the saved snapshot. The number is only presentation within that immutable snapshot; `get` binds to its recorded observation identity. It reloads current archive and qualification information, and saved commands and file paths are never executed as authority. A stale choice requires a new exploration or query. Existing verified results are reused only after their pins are checked again. A directory containing both `explore.json` and `query.json` is refused rather than guessed.

`query.json` preserves the question and evidence. Each `pick-N/` contains `result.json` and a `files/` tree with the complete recorded native output set, detached dependencies and evidence. Relative paths in the original receipts remain intact inside that tree. Raw calibration inputs are referenced by the original receipt, not all copied into the delivery. Scientific facts in `result.json` retain their workspace-relative receipt locations; use its file manifest to locate the exported copies.

Use `--json` for machine-readable stdout and `--verbose` for detailed evidence. Progress goes to stderr. Exit codes: **0** exploration/retrieval completed or a scientific request was fulfilled; **1** operation failed; **2** invalid arguments; **3** no retrievable choices or delivered data still has unresolved requirements; **4** delivered product refuses the request. Exploration exit 0 means the requested discovery or retrieval completed; it makes no scientific fulfillment claim.

The wrapper and scientific implementation remain separate versioned components: updating this npm package does not update the checkout's science code. `telescope --version` reports the wrapper version; each product receipt records the scientific software and inputs used.

## Supported v1 boundary

| Current artifact | Supported next operation | Additional input |
| --- | --- | --- |
| Qualified native delivery | image, spectrum, band image, aperture spectrum or feature map when `outputs` offers it | Explicit selectors reported by `outputs` |
| Exported 2D measurement | body map | Pinned navigation geometry |
| Body map | standalone interactive sphere | Complete embeddable standard body package |
| Existing prepared point field or density volume | portable renderer handoff | None |

These are supported transitions, not claims that every archive product supports every row.
Discovery covers the configured archive routes and bounded service profiles; an empty name
search is not a universal absence-of-observations result. A declared product kind likewise
does not establish that its bytes have a supported decoder, analysis or exporter. Run
`telescope outputs ARTIFACT` to inspect the actual artifact and its current prerequisites.

Native deliveries are portable with their recorded file tree. Derived measurements and maps
may retain absolute references to verified source files and therefore still depend on the
science workspace. Sphere HTML and physical renderer handoffs are self-contained within their
document or output directory. Missing retained sources are reported; they are never guessed,
rebased or replaced. A completed transformation preserves the original request verdict, so
export success does not turn unresolved or refused scientific evidence into fulfillment.

## Archive products

Scientific queries also inspect the bounded ESO/ALMA ObsCore and ESA PSA EPN-TAP services through PyVO. Their results enter the same saved choices, `get`, `outputs` and `export` commands. An advertised synchronous SODA service can fulfill an explicit ICRS cutout; failed subsets never fall back to a full download. Direct FITS and supported single-science-file ZIP/TAR products retain their complete pinned input set.

Use `telescope help` for region, frame and byte/member limits. `get --offline` replays an already delivered, pinned artifact without a remote refresh; it does not requalify it with current software. Acquisition verifies origin and integrity, while scientific request satisfaction can remain unresolved. [Protocol ownership, evidence and limitations](../../docs/vo-observation-access.md).

## Outputs

After `get`, inspect what the delivered product can support:

```sh
telescope families
telescope import import-spec.json --out imported-observation
telescope outputs imported-observation/import.json
telescope outputs runs/eris/pick-1/result.json
telescope export runs/eris/pick-1/result.json --output image --hdu 1 --plane 95 --out figures/eris-plane
telescope export runs/eris/pick-1/result.json --output spectrum --hdu 1 --pixel 25,27 --out figures/eris-pixel
telescope export runs/eris/pick-1/result.json --output band-image --hdu 1 --band 2.2,2.4 --out figures/eris-band
telescope export runs/eris/pick-1/result.json --output aperture-spectrum --hdu 1 --aperture 19,24,25,30 --background 29,24,35,30 --out figures/eris-aperture
telescope export runs/eris/pick-1/result.json --output feature-map --hdu 1 --band 2.30,2.34 --continuum 2.26,2.29,2.35,2.38 --out figures/eris-feature
```

When one declared family selects an existing content validator, import writes a pinned
`descriptor.json` and `outputs` lists the package-owned `family-run` operations. Ambiguous inputs
remain pinned and request an explicit family hint; recognition alone never establishes origin,
calibration or scientific fitness.

Selectors are zero-based and explicit. The adapter exports qualified FITS images, pixel/region spectra,
band images and continuum-subtracted feature maps to FITS/ECSV, PNG, SVG, CSV and a product record. It uses the same masks,
units and wavelength coordinates as qualification. CSV blanks preserve excluded samples;
plots do not bridge them. Supplied variance/inverse variance is converted to standard deviation
in the science unit.

- `band-image` returns a mean weighted by spectral bin overlap with `--band`, in the original
  science unit. Partial boundary bins contribute their overlap widths; descending axes work too.
- `aperture-spectrum` returns the arithmetic mean over a fixed rectangular pixel region.
  Bounds are `X0,Y0,X1,Y1`, with exclusive upper bounds. Choose a disjoint `--background` box
  to subtract its mean, or explicitly choose `--background none`. This is a mean per-pixel
  quantity, not total source flux; there is no solid-angle conversion or aperture correction.
- `feature-map` integrates the residual after subtracting a linear continuum anchored by the
  weighted means of two bracketing `--continuum` bands. Positive values are emission and
  negative values absorption relative to that continuum. Units are the source unit × µm;
  a frequency density integrated over wavelength is not a bolometric flux. The map makes
  no chemical-identification or detection-significance claim.

Aggregation requires every contributing sample to be valid for an output pixel/channel.
It does not silently change the aperture or renormalize around spectral gaps. Band/feature
maps require qualified bin edges; tabulated wavelength centers alone are insufficient.
Extraction uses temporary file-backed arrays, with no one-million-pixel CLI limit.
FITS/CSV retain the full native grid; figures use a recorded nearest-sample stride
when an axis exceeds 1600 pixels. Reader and serialization memory/disk costs remain.
PDS and ISIS products enter the same plotting path after decoding by their existing
owners. Select ambiguous PDS arrays with `--structure NAME` and use `--hdu 0`.

Astropy `NDDataArray` owns weighted arithmetic and standard-deviation propagation; css.earth
owns the selected regions, continuum definition and strict missing-sample policy.
Astropy WCSAxes, ImageNormalize and quantity_support own scientific plotting conventions;
Matplotlib renders the PNG/SVG tightly around the chart, labels and legend with a
0.12-inch gutter. PNG backgrounds are transparent; light labels suit dark backgrounds.
No Jdaviz installation, notebook or browser is required.

Every export also returns a `data` path: `image.fits` for images or `spectrum.ecsv` for
spectra, written by Astropy. Images carry their source celestial WCS when it is separable
on the unchanged grid, BUNIT, MASK (1 = missing) and ERR when supplied. If coordinates are
absent or coupled to other axes, the figure uses pixels and the receipt explains why;
malformed WCS is refused. ECSV carries explicit wavelength/value units, masks, selection
and uncertainty policy. These files can be opened independently of css.earth.
The receipt pins both the scientific data and figure, and records coordinate frame,
linear display limits, colormap and WCS warnings. No new astrometric calibration is implied.

Aggregate uncertainties default to omitted because covariance is unknown. Explicit
`--uncertainty independent` propagates validated per-sample variances, including the
background/continuum contributions, conditional on independent errors. Resampled pixels or
channels may violate that assumption. Figures label this condition; CSV and the receipt retain
it. No spatial/spectral resolution matching is performed when combining samples.

[Real Eris examples and source hash](../../docs/virtual-telescopes.md#example-exports-eris-jwst-nirspec-ifu).

Output directories must be new. Delivery files and their producing record are rechecked before
export, and files are checked again before publication. Outputs keep the original request and
its satisfaction result. Exporting a figure does not resolve missing science evidence.

`telescope outputs ARTIFACT.json` is the stage boundary for the whole chain. It accepts a
delivery, derived product record, or existing physical object package and reports only the next
supported exports. It revalidates the same current prerequisites used by export, including
retained source-delivery dependencies, body-map bindings, embeddable sphere resources, and
the physical object's loader, frame and credit closure. Availability is a checked snapshot;
export checks again before publication. A 2D image can advance to a body map; only a
complete projection bundle can advance to a sphere; point and volume handoffs require existing
physical depth. A completed sphere or spatial handoff is reported as terminal.

The existing astronomy Python environment now includes hash-pinned Matplotlib. Reinstall it
with `node tools/objects/astronomy-packages/toolchain.mts install` after pulling changed pins.
The npm package still does not install scientific dependencies automatically.

Surface projection is explicit:

```sh
telescope outputs MEASUREMENT/output.product.json
telescope export MEASUREMENT/output.product.json --output body-map --geometry navigation.json --out MAP
telescope outputs MAP/map.fits.product.json
telescope export MAP/map.fits.product.json --output sphere --out SPHERE
```

The navigation file pins SPICE kernels and chooses WCS or a supported fitted disc.
The body-map export writes a map and a figure. `telescope project` remains a compatibility alias.
The sphere is a standalone HTML file using the target's existing css.earth standard sphere and
physical scale. CSS and base64 images are embedded; no JavaScript executes. The projection ellipsoid
is recorded separately. Projection preserves
unknown beam resolution and does not qualify scientific publication. See the
[navigation contract and oracle](../../docs/virtual-telescopes.md#projection-and-sphere).
Physical 3D handoffs use an existing `point-field` or `density-volume` object package:

```sh
telescope export src/objects/stellar-neighbourhood/object.json --output points --out stars
telescope export src/objects/milky-way/object.json --output volume --out galaxy
```

These copy the prepared renderer files and credits, validate them with the exact
application loaders, and write a pinned receipt. The physical frame and model
interpretation stay intact. Raw source datasets are referenced, not bundled.
A spectral cube still needs a justified physical reconstruction; this export does
not interpret wavelength as depth. Restore missing prepared inputs with the
repository's `setup:prepared --object=ID` command.

Mercury's inactive interior image bindings are removed for the surface export;
its prepared geometry and camera remain unchanged.

## Independent output checks

The [output oracle](../../tools/objects/telescopes/output-oracle.mts) reads the original pinned
FITS data independently of the production reducer. Specutils 2.4.0 integrates the spectral
windows; Photutils 3.0.0 measures rectangular apertures. Native plane and pixel exports compare
directly with FITS slices. The reference tools are optional test dependencies, installed without
changing the production astronomy environment:

```sh
output/toolchains/astroquery/env/bin/python -m venv --system-site-packages work/telescope-oracles/env
work/telescope-oracles/env/bin/python -m pip install -c tools/objects/astronomy-packages/requirements.lock -r tools/objects/astronomy-packages/oracle-requirements.txt
node tools/objects/telescopes/output-oracle.mts figures/eris-band work/telescope-oracles/env/bin/python output/oracles/eris-band
CSSEARTH_ORACLE_PYTHON="$PWD/work/telescope-oracles/env/bin/python" node --test tools/objects/telescopes/cube-outputs.test.mts
```

Each comparison writes a residual figure and a JSON report identifying the source hash,
reference versions, mask/unit agreement and maximum numerical difference. It fails above
1e-10 of the reference peak. All valid samples are compared; masked samples must agree too.
The normal tests also check hand-computed signals, continuum slopes, background subtraction,
partial-bin weighting and propagated errors. Package oracles are opt-in and only run when
`CSSEARTH_ORACLE_PYTHON` is set; the command above enables them.

This verifies numerical extraction. Both readers still use Astropy FITS/WCS; neither verifies
archive calibration, unknown covariance, aperture corrections, molecular identity or detection
significance. Specutils mask interpolation is avoided by checking complete selected coverage
explicitly. Its line-flux function is called per spectrum, not on a multidimensional flux array.
