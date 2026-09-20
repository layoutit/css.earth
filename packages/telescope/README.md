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
```

Selectors are zero-based and explicit. The first adapter exports qualified FITS images and
single-pixel spectra to PNG, SVG, numeric CSV and a product record. It uses the same masks,
units and wavelength coordinates as qualification. CSV blanks preserve excluded samples;
plots do not bridge them. Supplied variance/inverse variance is converted to standard deviation
in the science unit. No aperture summation or assumption of independent spatial errors is made.

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
