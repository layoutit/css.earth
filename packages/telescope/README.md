# @cssearth/telescope

The `telescope` command saves a scientific question, lists retrievable observations, and retrieves a chosen product with its qualification evidence. It distinguishes verified data from a fulfilled scientific request.

This package supplies the command, not the observatory pipelines or catalogue. It uses a **css.earth science checkout** containing the telescope API, source manifests and any required Python environments. It can run from any directory with `--workspace PATH` or `CSSEARTH_WORKSPACE`; inside the checkout it finds the workspace automatically. Acquisition and reduction caches stay in that checkout, while deliveries go to your `--out` directory. The package does not download a checkout, install Python, or run pipelines during npm installation.

## Setup

Use Node 22.18+ (22.x) or Node 24+. Prepare a css.earth checkout with its documented dependencies. Archive discovery uses `pnpm telescope:setup-archives`; PDS decoding uses `pnpm telescope:setup-pds`. Some reduction routes require additional instrument toolchains described by their existing guides.

The package has not been published by this PR. To test the distributable from the repository:

```sh
npm pack ./packages/telescope
npm install -g ./cssearth-telescope-0.1.0.tgz
export CSSEARTH_WORKSPACE=/path/to/css.earth
```

## Use

```sh
telescope query eris --wavelength 2.2,2.4 --kind cube \
  --any-time --min-arcsec 1 --out runs/eris
telescope get runs/eris --pick 1
```

Choose a number from your saved query. It is not a fixed observation ID or a claim that every target has a retrievable cube. `get` reloads current archive and qualification information; saved commands and file paths are never executed as authority. A stale choice requires a new query. Existing verified results are reused only after their pins are checked again.

`query.json` preserves the question and evidence. Each `pick-N/` contains `result.json` and a `files/` tree with the complete recorded native output set, detached dependencies and evidence. Relative paths in the original receipts remain intact inside that tree. Raw calibration inputs are referenced by the original receipt, not all copied into the delivery. Scientific facts in `result.json` retain their workspace-relative receipt locations; use its file manifest to locate the exported copies.

Use `--json` for machine-readable stdout and `--verbose` for detailed evidence. Progress goes to stderr. Exit codes: **0** query has retrievable choices or delivered product fulfills the request; **1** operation failed; **2** invalid arguments; **3** no retrievable choices or delivered data still has unresolved requirements; **4** delivered product refuses the request. A successful download does not imply exit 0.

The wrapper and scientific implementation remain separate versioned components: updating this npm package does not update the checkout's science code. `telescope --version` reports the wrapper version; each product receipt records the scientific software and inputs used.

## Outputs

After `get`, inspect what the delivered product can support:

```sh
telescope outputs runs/eris/pick-1/result.json
telescope export runs/eris/pick-1/result.json --output image --hdu 1 --plane 95 --out figures/eris-plane
telescope export runs/eris/pick-1/result.json --output spectrum --hdu 1 --pixel 25,27 --out figures/eris-pixel
telescope export runs/eris/pick-1/result.json --output band-image --hdu 1 --band 2.2,2.4 --out figures/eris-band
telescope export runs/eris/pick-1/result.json --output aperture-spectrum --hdu 1 --aperture 19,24,25,30 --background 29,24,35,30 --out figures/eris-aperture
telescope export runs/eris/pick-1/result.json --output feature-map --hdu 1 --band 2.30,2.34 --continuum 2.26,2.29,2.35,2.38 --out figures/eris-feature
```

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
The one-million-spatial-pixel limit applies; extraction streams through the cube.

Astropy `NDDataArray` owns weighted arithmetic and standard-deviation propagation; css.earth
owns the selected regions, continuum definition and strict missing-sample policy.
Astropy WCSAxes, ImageNormalize and quantity_support own scientific plotting conventions;
Matplotlib renders the PNG/SVG. No Jdaviz installation, notebook or browser is required.

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

The existing astronomy Python environment now includes hash-pinned Matplotlib. Reinstall it
with `node tools/objects/astronomy-packages/toolchain.mts install` after pulling changed pins.
The npm package still does not install scientific dependencies automatically.

Surface maps use the existing map authors and `telescope:publish-map`. A body-sphere output
requires surface registration and a prepared layer. A physical 3D output requires actual
position/depth evidence and a nebula-lab adapter. Those export adapters, along with PDS/ISIS
figure exporters, are not implemented in this initial output slice. The output listing says so.

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
