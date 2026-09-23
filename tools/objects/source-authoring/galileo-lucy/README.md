# Galileo and Lucy bodies

New object packages: Dactyl, Dinkinesh and Selam. All use the existing authored-body preparation and PolyCSS renderer. Dactyl and Selam explicitly use illustrative current phases, with dashed context orbits and circular selection indicators.

## Reproduction

Run from the repository root, serially. The checked-in body inputs are sufficient for normal `prepare-authored`; the authoring commands below reconstruct them from the selected originals and published measurements.

1. Restore missing imagery/font inputs using each package’s acquisition recipe. Shape parameters, original CMOD, converted OBJ, reference records and attribution are checked in.
2. To reconvert Dinkinesh, run `python3 tools/objects/source-authoring/galileo-lucy/cmod.py src/objects/dinkinesh/source/shape/dinkinesh.cmod src/objects/dinkinesh/source/shape/model.obj --volume-equivalent-radius-km 0.369`. Dactyl and Selam’s checked-in `shape/model.json` files transcribe the cited dimensions directly.
3. Run `node tools/objects/source-authoring/galileo-lucy/orbits.mts` to regenerate illustrative mutual orbits and display orientation. Its retained Celestia input may be copied from Dactyl’s source/reference directory to `output/galileo-lucy/celestia/asteroids.ssc`.
4. Run `node packages/astronomy/tools/generate-asteroids.mts --object=dinkinesh` and `node packages/astronomy/tools/generate-scene-satellites.mts --object=dactyl,selam` when refreshing ephemerides. Retain the Horizons responses in the body source directory. The asteroid generator uses independent vector fixtures.
5. Catalogue entries live in each descriptor’s `properties.catalog`; physical values, retained orbit states and independent fixtures live in `packages/astronomy/data/bodies/<id>.json`. Run `pnpm prepare:catalog`, build the packages and preparation bundle, regenerate solar geometry, and run `node tools/objects/dist/prepare-authored.js <id> --write` once per new body. To rebuild title/context source images, run `node tools/objects/source-authoring/galileo-lucy/initialize.mts` first. Keep document paths and source bindings current after authored changes; the old `pin.mts` helper is retired.
6. Run `node tools/prepare/prepare-navigation.mts dactyl dinkinesh selam` for the three body-owned marker images. Ida already has a prepared context image; for a new parent without one, include that parent in the command. The selected-body serializer binds stable marker URLs with one tile, so other bodies’ transports do not change. Run `pnpm prepare:world-context` and `pnpm prepare:minimap` to rebuild the ignored combined views. Approximate orbit cues come from the retained astronomy state’s `provenance.placement`; no shared Sun body list needs editing.

The checked-in `source/preparation/photometry.json` files in Ida and Dinkinesh are authored inputs for the shared parent-point brightness calculation. Ida retains the original JPL SBDB response; Dinkinesh cites the pre-encounter WISE estimate and its uncertainty. Neither supplies a surface texture or an independently measured moon albedo.

Run `python3 -m unittest discover -s tools/objects/source-authoring/galileo-lucy -p 'test_*.py'`, the adjacent `orbits.test.mjs`, and the three body `source.test.mjs` suites. Shared spatial-context and retained-renderer tests verify that approximate placement survives preparation and changes only the displayed cues.

The CMOD converter rotates `[x,y,z]` to `[x,-z,y]`, centers the source bounding box and scales uniformly. It removes only exactly zero-area source triangles, whose original indices are recorded in `shape/model.json`. The remaining triangles retain their source winding and UVs. The shared preparer then reduces the mesh under its error bound. The original model has no qualified observed/fill texture mask, so no photographic texture is imported.

The moon orbit sources separate published constraints from assumed planes, periapsis and phase. Their effective gravitational parameter makes each display conic consistent with its period; it is not presented as a measured mass. No long-term integration, encounter-camera registration or current phase accuracy is claimed.

## Dactyl photographic source review

Run `node tools/objects/source-authoring/galileo-lucy/review-dactyl.mts` from the
repository root. It verifies the retained native inputs against
`src/objects/dactyl/evidence/galileo/inputs.json`, decodes the three FITS frames
with the shared reader, checks the CK segment identities, and writes
full-detector PNGs, enlarged crops and a report to `output/dactyl-galileo-review/`.
An optional first argument changes that output directory. The crops use FITS
storage coordinates, nearest-neighbor enlargement and ×2 DN display gain; the
report counts clipped pixels. This command neither fits a camera nor modifies
the prepared scene. See the [Dactyl README](../../../../src/objects/dactyl/README.md)
for the inspected result and remaining registration requirements.

## Dactyl camera and orientation diagnostic

Run `node tools/objects/source-authoring/galileo-lucy/fit-dactyl.mts` from the
repository root with Node 24. It uses only checked-in inputs and writes to
`output/dactyl-registration/`; an optional first argument changes that directory.
It runs serially and does not prepare or mount a scene.

The command verifies every byte pin in Dactyl's `evidence/registration/inputs.json`,
compares the FITS storage array with original VICAR detector pixels, evaluates
the original scan-platform CK at shutter-center SCET, and checks that calculation
against the pinned native CSPICE fixture. It then fits an ellipsoid orientation
from the bright limb and Acmon, with Celmis withheld. `solutions.json` retains
all 576 starts in the scratch directory; `report.json` and
`orientation-candidates.png` preserve the selected result and the alternative
found after examining Celmis. The latter has no independent holdout.

The fit uses the source instrument's focal length, pitch, optical center and
radial distortion. It fits in source XYZ, before the existing preparation swap
from source X/Y to CSS Y/X. The simplified orthographic envelope, rounded range
and analyst feature picks make this an orientation experiment, not a new
photographic preparation path. See the [body's interpretation and limits](../../../../src/objects/dactyl/README.md#camera-and-orientation-experiment).

Append `--limb-extent` after the output directory to reproduce the two additional
outline cases, for example:

```sh
node tools/objects/source-authoring/galileo-lucy/fit-dactyl.mts output/dactyl-registration --limb-extent
```

This adds lower and then upper bright-cap crossings and reruns the same search
serially. `limb-extent.json` records every added crossing, scan definition and
selected pose; `limb-extent.png` compares the three cases at the same native crop
and display scale. Celmis never ranks these fits, but it was inspected during
development, so this is an orientation-sensitivity check rather than blind
qualification. It changes neither the original input pins nor the renderer.

The independent [numerical fixture](../../../../tests/objects/fixtures/dactyl/galileo-pointing.json)
records Python 3.12.14, SpiceyPy 8.2.0 and CSPICE N0067, the exact loaded kernels,
load order, UTCs, API calls and native results. To repeat the native calculation
in a SpiceyPy environment: clear the kernel pool, `furnsh` those three files in
order, call `str2et(utc)` and `sce2c(-77, et)`, then
`ckgp(-77001, ticks, 0.0, 'B1950')` and `ckgp(-77001, ticks, 0.0, 'J2000')`.
The boresight is matrix row 2. Do not add half an exposure to the label's SCET,
or treat the truncated frame-start SCLK as shutter center. The fixture is a
comparison reference only; no production camera is generated from its numbers.

The original mission products and kernels remain under their native notices.
No paper text or figures are redistributed. README numerical claims cite the
papers and the image/control definitions; detector previews retain NASA/JPL/Galileo
SSI credit and their declared display gain.

## Dactyl published-control diagnostic

With the complete publisher PDF available locally, run:

```sh
node tools/objects/source-authoring/galileo-lucy/fit-dactyl-published-controls.mts /path/to/1-s2.0-S0019103596900457-main.pdf
```

An optional second argument changes the default `output/dactyl-published-controls/`
directory. The PDF SHA-256 must match Dactyl's
[`published-controls.json`](../../../../src/objects/dactyl/evidence/registration/published-controls.json).
It is a supplied reference input, excluded from redistribution. This command
reads three exact embedded JPEG streams using offsets specific to that pinned
PDF; both the complete PDF and each stream are verified before decoding. It
neither installs a PDF runtime nor re-encodes those streams as new sources.

The report records the paper-to-native similarity alignment, regional/filter
sensitivity, source instrument distortion, the new 3,887 km Dactyl range, six
54-start orientation searches and sixteen local control-pick perturbations.
The existing ellipsoid and complete earlier bright-limb sample set stay fixed.
The unit-weight pole-plus-Acmon fit is the baseline. Other limb weights and the
pole-only fit expose sensitivity; they are not alternative qualification gates.
Celmis never enters the fit or ranking, but was inspected earlier in the work.

Outputs are `published-control-fit.json` and a detector diagnostic PNG made
solely from the original NASA/JPL/Galileo image. Report pins identify the
configuration, implementation and dependencies. The tool always reports
`qualifiedSurface: false` and cannot prepare a public photographic dataset.
The [Dactyl README](../../../../src/objects/dactyl/README.md#published-pole-and-range)
explains the remaining map/model correspondence and visibility requirements.

## Dactyl published map review

Run with Node 24 and the same pinned local publisher PDF:

```sh
node tools/objects/source-authoring/galileo-lucy/review-dactyl-map.mts /path/to/1-s2.0-S0019103596900457-main.pdf
```

An optional second argument changes `output/dactyl-map-review/`. The command
verifies the PDF, exact Figure 10 JPEG, native image, instrument, ellipsoid and
earlier pose dependencies before writing `published-map-review.json`. Eight
unused printed ticks check the digitized plot frame. Six separate map windows
then check the fixed unit-weight pole-plus-Acmon pose, using the original SSI
detector pixels and instrument distortion. Local correlation searches report
disagreement, competing peaks and search-boundary results; they never alter
the camera or supply accepted control points.

This lightweight source check writes no scene assets or paper images. It reports
`qualifiedSurface: false`: a recovered coordinate grid alone does not establish
the map's reference surface, permitted raster reuse or transfer to our ellipsoid.
See the [body interpretation](../../../../src/objects/dactyl/README.md#published-map-check).
