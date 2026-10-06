# Galileo and Lucy bodies

Authoring for three object packages: Dactyl, Dinkinesh and Selam. All use the existing authored-body preparation and
PolyCSS renderer. Dactyl and Selam use illustrative current phases, with dashed context orbits and circular selection
indicators.

## Reproduction

Run from the repository root, serially. The checked-in body inputs are enough for normal `prepare-authored`; the
commands below rebuild them from the selected originals and published measurements.

1. Restore missing imagery and font inputs with each package's acquisition recipe. Shape parameters, original CMOD,
   converted OBJ, reference records and attribution are checked in.
2. To reconvert Dinkinesh, run `python3 packages/bake/authoring/galileo-lucy/cmod.py src/objects/dinkinesh/source/shape/dinkinesh.cmod src/objects/dinkinesh/source/shape/model.obj --volume-equivalent-radius-km 0.369`.
   Dactyl and Selam's `shape/model.json` files transcribe the cited dimensions directly.
3. Run `node packages/bake/authoring/galileo-lucy/orbits.mts` to regenerate the illustrative mutual orbits and display
   orientation. Its Celestia input may be copied from Dactyl's source/reference directory to
   `output/galileo-lucy/celestia/asteroids.ssc`.
4. When refreshing ephemerides, run `node packages/astronomy/cli/generate-asteroids.mts --object=dinkinesh` and
   `node packages/astronomy/cli/generate-scene-satellites.mts --object=dactyl,selam`. Keep the Horizons responses in the
   body source directory.
5. Catalogue entries live in each descriptor's `properties.catalog`; physical values, orbit states and independent
   fixtures live in `packages/astronomy/data/bodies/<id>.json`. Run `pnpm prepare:catalog`, build the packages,
   regenerate solar geometry, and run `node site/build/prepare/authored/prepare-authored.ts <id> --write` once per new body. To
   rebuild title and context source images, run `node packages/bake/authoring/galileo-lucy/initialize.mts` first.
6. Run `node packages/bake/cli/prepare-navigation.mts dactyl dinkinesh selam` for the three marker images. For a new
   parent without a prepared context image, include that parent in the command. Run `pnpm prepare:world-context` to
   rebuild the ignored world context.

Tests: `python3 -m unittest discover -s packages/bake/authoring/galileo-lucy -p 'test_*.py'`, the adjacent
`orbits.test.mjs`, and the three body `source.test.mjs` suites.

## Inputs and conventions

The `source/preparation/photometry.json` files in Ida and Dinkinesh are authored inputs for the shared parent-point
brightness calculation. Ida keeps the original JPL SBDB response; Dinkinesh cites the pre-encounter WISE estimate and
its uncertainty. Neither supplies a surface texture or a measured moon albedo.

The CMOD converter rotates `[x,y,z]` to `[x,-z,y]`, centers the source bounding box and scales uniformly. It removes only
exactly zero-area triangles, whose indices are recorded in `shape/model.json`. No photographic texture is imported,
because the original model has no qualified observed/fill texture mask.

The moon orbit sources separate published constraints from assumed planes, periapsis and phase. Their effective
gravitational parameter makes each display conic match its period; it is not a measured mass. No long-term
integration, encounter-camera registration or current phase accuracy is claimed.

## Dactyl photographic source review

Run `node packages/bake/authoring/galileo-lucy/review-dactyl.mts`. It verifies the native inputs against
`src/objects/dactyl/evidence/galileo/inputs.json`, decodes the three FITS frames, checks the CK segment identities, and
writes full-detector PNGs, enlarged crops and a report to `output/dactyl-galileo-review/` (an optional first argument
changes the directory). Crops use FITS storage coordinates, nearest-neighbor enlargement and ×2 DN display gain. It
neither fits a camera nor changes the prepared scene. See the [Dactyl README](../../../../src/objects/dactyl/README.md).

## Dactyl camera and orientation diagnostic

Run `node packages/bake/authoring/galileo-lucy/fit-dactyl.mts` with Node 24. It writes to `output/dactyl-registration/`
(an optional first argument changes the directory), runs serially and does not prepare or mount a scene.

It reads the inputs Dactyl's `evidence/registration/inputs.json` names, restoring a missing kernel or archive frame from
its URL, and evaluates the original scan-platform CK at shutter-center SCET. It then fits an ellipsoid orientation from
the bright limb and Acmon, with Celmis withheld, using the instrument's focal length, pitch, optical center and radial
distortion. `report.json` and `orientation-candidates.png` keep the selected result and the alternative found after
examining Celmis. This is an orientation experiment, not a photographic preparation path; see the
[body's interpretation and limits](../../../../src/objects/dactyl/README.md#camera-and-orientation-experiment).

Append `--limb-extent` after the output directory to add lower and upper bright-cap crossings and rerun the search:

```sh
node packages/bake/authoring/galileo-lucy/fit-dactyl.mts output/dactyl-registration --limb-extent
```

`limb-extent.json` records every added crossing and selected pose; `limb-extent.png` compares the three cases. Celmis
was inspected during development, so this is a sensitivity check, not blind qualification.

The independent [numerical fixture](../../../../src/objects/dactyl/fixtures/galileo-pointing.json) records Python
3.12.14, SpiceyPy 8.2.0 and CSPICE N0067 with the loaded kernels and native results. To repeat it in SpiceyPy: clear the
kernel pool, `furnsh` the three files in order, call `str2et(utc)` and `sce2c(-77, et)`, then
`ckgp(-77001, ticks, 0.0, 'B1950')` and `ckgp(-77001, ticks, 0.0, 'J2000')`. The boresight is matrix row 2. Do not add
half an exposure to the label's SCET, or treat the truncated frame-start SCLK as shutter center.

Mission products and kernels remain under their native notices. No paper text or figures are redistributed; detector
previews keep NASA/JPL/Galileo SSI credit.

## Dactyl published-control diagnostic

With the publisher PDF available locally, run:

```sh
node packages/bake/authoring/galileo-lucy/fit-dactyl-published-controls.mts /path/to/1-s2.0-S0019103596900457-main.pdf
```

An optional second argument changes `output/dactyl-published-controls/`. The PDF's byte count must match Dactyl's
[`published-controls.json`](../../../../src/objects/dactyl/evidence/registration/published-controls.json); it is a
supplied input, not redistributed. The command reads three embedded JPEG streams at offsets specific to that PDF.

The report covers the paper-to-native alignment, the 3,887 km Dactyl range, six orientation searches and sixteen
control-pick perturbations. The unit-weight pole-plus-Acmon fit is the baseline. Outputs are
`published-control-fit.json` and a detector diagnostic PNG. The tool always reports `qualifiedSurface: false`; see the
[Dactyl README](../../../../src/objects/dactyl/README.md#published-pole-and-range).

## Dactyl published map review

Run with Node 24 and the same local PDF:

```sh
node packages/bake/authoring/galileo-lucy/review-dactyl-map.mts /path/to/1-s2.0-S0019103596900457-main.pdf
```

An optional second argument changes `output/dactyl-map-review/`. The command verifies its inputs, then writes
`published-map-review.json`: eight printed ticks check the digitized plot frame, and six map windows check the fixed
pose against the original SSI pixels. It never alters the camera or supplies accepted control points, and it reports
`qualifiedSurface: false`. See the [body interpretation](../../../../src/objects/dactyl/README.md#published-map-check).
