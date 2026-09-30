# Surface observations

A surface-observation dataset drapes photographs over a body's retained mesh.
Preparation carries every photograph through the same stages, whatever archive
it came from. Most come from spacecraft. A ground-based telescope frame enters
the same way once its camera is computed from an ephemeris and a published spin
state. The runtime only displays the prepared atlas.

```text
decode → camera → pixel geometry → photometry → footprint → surface transfer → report
```

The stages are the modules beside this README, part of the terrestrial layer's
shared libraries (`@cssearth/bake/objects/layers/terrestrial`), with their tests
[in the same folder](./).

A body owner names a format and its pins in `raster.surfaceObservations`. A
format adapter decodes the product and builds its camera and pixel geometry.
Every later stage is shared, so a new archive product needs an adapter, not a
new route.

## Stages

| Stage | Module | What it does |
| --- | --- | --- |
| Decode | `formats/*.ts`, with the readers in the layer's `missions/` | Reads the product, checks its identity against the recipe and applies the archive's own quality verdict to each pixel. |
| Camera | `cameras.ts` | Projects surface points to detector pixels and casts rays back. A camera is fitted to archive backplanes, read from an archived closure, derived from SPICE kernels, taken from a registered control network, or computed for a ground-based frame by `packages/bake/src/objects/cameras/observer-camera.ts` from an ephemeris and a rotation model. A limb refinement can rotate a SPICE or OSIRIS reflectance camera onto the mesh's lit limb. |
| Pixel geometry | `geometry.ts` | Gives each pixel a surface point, a range and its incidence, emission and phase angles, from the archive's backplanes or from camera rays cast onto the full source mesh. |
| Photometry | `photometry.ts` | One gain function per dataset: a published model record, a disk function such as Lunar-Lambert, or the photograph's own shading. |
| Footprint | `footprint.ts` | Interpolates the four pixels around a projected point. A pixel contributes only if it has geometry, passes quality, faces the camera within the emission limit, lies on the sampled surface patch, is lit when the photometry normalizes illumination and admits a gain. The point needs contributors carrying at least half of the bilinear weight. |
| Surface transfer | `surface.ts` | Finds the closest source point for each displayed point and checks that the camera sees it. Then it selects a frame, matches levels between frames, sets the display range, measures area coverage and renders the flat preview. |
| Report | `surface.ts` | Writes the same report for every format. |

## Formats

| Recipe `format` | Adapter | Camera | Pixel geometry |
| --- | --- | --- | --- |
| `osiris-geo`, `amica-gaskell`, `pds4-geometry-cube` | `formats/geo.ts` | Fitted to the backplanes | Archive backplanes |
| `osiris-camera` | `formats/geo.ts` | Archived closure | Source-mesh rays |
| `llorri-camera` | `formats/geo.ts` | Archived closure with TAN-SIP distortion, bound to a body the frame lists in its field of view | Source-mesh rays |
| `near-msi-camera` | `formats/geo.ts` | Reconstructed image table and bounded limb refinement | Source-mesh rays; paired raw detector validity |
| `nh-lorri-camera` | `formats/geo.ts` | Archived closure with TAN-SIP distortion | Source-mesh rays |
| `nh-mvic-camera` | `formats/geo.ts` | Archived closure through a fitted image transform; three registered filters shown as colour | Source-mesh rays |
| `spice-camera` | `formats/geo.ts` | SPICE kernels | Source-mesh rays |
| `junocam-camera` | `formats/junocam.ts` | SPICE kernels, one camera per strip of a push-frame image, with the kernel's radial distortion and two epochs fitted to the lit limb | Source-mesh rays, cast only where a strip can hold lit surface |
| `encounter-fits` | `formats/encounter.ts` | Registered control network | Source-mesh rays |
| `controlled-shape-camera` | `formats/controlled-camera.ts` | A published control network (Thomas or Stooke shape releases) or the Galileo SSI image catalog | Source-mesh rays |
| `controlled-shape-color` | `formats/controlled-camera.ts` | The same cameras for three sequential filters, measured again against reference images | Source-mesh rays |
| `isis2-orthographic` | `formats/orthographic.ts` | None: every pixel names a DEM post | Registered DEM posts |

The [implementation map](../../../../../../../.agents/skills/celestial-skill/references/implementation-map.md#choose-a-photograph-route)
says which format fits what an archive ships. A JunoCam image is a stack of
strips from a spinning spacecraft, so `junocam-camera` builds one camera per
strip and joins them with [`composite.ts`](composite.ts). The
[JunoCam guide](../../../../../../../docs/junocam.md) records the route. The
NEAR MSI adapter retains calibrated I/F with its original illumination; see
Mathilde's [source method](../../../../../../../src/objects/mathilde/README.md).

## Recipes

Every dataset has the same shape. A format adds only its frame inputs and its
own blocks, and validation refuses any key the format does not declare.

```json
{
  "id": "osiris", "format": "osiris-geo", "consumer": "osiris-observation",
  "filter": "...", "allowLossy": false,
  "frames": [{ "id": "...", "path": "...", "qualityPath": "...", "startTime": "..." }],
  "selection": "lowest-emission", "levelMatching": { "samplesPerTriangle": 64, "minimumPairs": 128, "maximumGain": 1.35, "maximumAngleDegrees": 65 },
  "transfer": { "...": "see Transfer limits" }, "photometry": { "...": "..." },
  "display": { "basis": "authored", "percentiles": [1.9, 99.3] },
  "metadata": { "label": "OSIRIS", "coverage": "..." },
  "focus": { "...": "optional: where the camera looks when the dataset opens" }
}
```

- `frames` lists the photographs. The format caps their number: one for an
  orthophoto, eight for encounter frames and JunoCam images, thirty-two for
  controlled cameras, and each geo schema its own. A dataset with more than one
  frame also names its `selection` and `levelMatching`.
- A frame `id` is the archive's product id. Dataset and consumer ids are
  lower-case words joined by hyphens.
- `display` is either `percentiles` of the displayed surface samples or one
  stated `displayRange`, with a `basis`: `authored`, or `source` with the
  `sourceId` of a consumed input that states it.
- `recipe.ts` checks the shared shape. Each adapter declares what its frames
  and dataset add, in its `formats/` module.

## Adding an archive product

Write an adapter that implements `SurfaceObservationFormat` from `contract.ts`
and register it in `observations.ts`. The adapter:

1. declares what its frames and dataset add to the shared recipe, checks them with
   `recipe.ts` and names every pinned path the dataset consumes;
2. decodes each frame into an `ObservationImage`;
3. builds an `ObservationCamera` and a `PixelGeometry`, usually with
   `matrixCamera` or `fittedCamera` and `castSourceRays` or `archiveBackplanes`;
4. passes them to `cameraFrame` and returns the frames with a `SurfacePolicy`.

When a product needs a new kind of camera or geometry, extend `cameras.ts` or
`geometry.ts` so the next adapter can reuse it.

## Route policy

Every format follows the same rules, and each dataset report records them.

- **Transfer.** Each displayed point samples its closest point on the source
  mesh, with no limit on its distance from it. meshoptimizer's error is an
  estimate, and the measured deviation exceeded it on Atlas, Janus, comet 81P
  and Donaldjohanson, so such a limit made holes. Faces that only complete an
  open source surface are withheld as `estimated-geometry`, and an exact tie
  between source points as `ambiguous-source-point`.
- **Display range.** A controlled-camera monochrome dataset uses a range from
  zero to its 99.5th percentile, so a uniformly bright body is not stretched. A
  colour dataset shows its three bands on one authored `displayRange`, and the
  decoder checks each band and its units against the native labels. Floating
  samples receive the [shared IEC sRGB transfer](../../../color/color-transfer.ts)
  once, after surface transfer. Encoding does not qualify natural color.
- **Selection.** A mosaic picks the lowest emission, the first frame in recipe
  order or the finest resolution, or it averages its frames. The finest
  resolution is the frame whose pixel covers the least surface at that point:
  its pixel scale over the cosine of the emission angle there.
- **Edge-weighted average.** Every qualifying frame contributes its levelled
  value, weighted by how deep inside its usable disc the point lies over its
  pixel area, so a frame fades out at its limb and terminator; see
  [`contour.ts`](contour.ts). The SPHERE survey datasets use it, since their deconvolved frames ring
  at the disc edge, as the SPHERE team did for Vesta
  ([Fétick et al. 2019](https://doi.org/10.1051/0004-6361/201834749), section
  4.4). Spacecraft frames keep the pick.
- **Level matching.** Frames are compared on equal-area samples. A pair counts
  when it shares `minimumPairs` samples and its median log ratio is known to
  0.07, that is √(π/2) × 1.4826 × MAD / √n ≤ 0.07. Frames joined by counted
  pairs share one fit anchored on their group's first frame. Every gain must
  stay within `maximumGain`, which the format caps: 1.5 for geo formats, 3 for
  encounter frames and 16 for controlled cameras. Deconvolved ZIMPOL frames
  change scale between observing seasons, so frames 120 days or more apart
  start a new season, each levelled against its own first frame. A
  controlled-camera dataset casts at most 96 frames.
- **Controlled-camera registration.** A frame is refused when its camera places
  more than a quarter of its lit source shape on the photograph's
  edge-connected sky.

## Observer-computed cameras

A ground-based frame ships pixels and instrument metadata, and its camera is
computed. Everything that computation needs is pinned beside the body and named
in `source/preparation/observer-cameras.json`: the rotation model, the two
Horizons tables, the epoch rule and the centre rule. Nothing in such a recipe is
fitted.

- `node packages/bake/cli/observer-cameras.mts <object> --write` derives the
  camera fields and disc centre for every frame and writes them into the recipe.
  The layer's `registration/observer-cameras.test.mts` refuses a recipe that drifts from its
  inputs.
- `node packages/bake/cli/sphere-survey-setup.mts <object>` sets up a VLT/SPHERE
  survey body in a scratch copy and measures it against the survey's figure;
  `install.mts` writes it into the package. The
  [recipe](../../../../../../../.agents/skills/celestial-skill/references/sphere-survey-photographs.md)
  gives the steps.
- `node packages/bake/cli/sphere-horizons.mts <object> --write` writes and pins
  the two Horizons tables for the dataset's frames, asking in batches of at most
  25 times.

A spin record's column order is not the reader's choice.
The layer's `registration/spin-record-reading.ts` reads the release both ways and keeps the
reading within 5° of the published pole. It refuses when neither reading is that
close, or when the two are within 2° of each other. Eleonora's and Nemesis's
releases cannot be read this way; their ledgers record it.

The epoch is the exposure midpoint, from `ESO DET SEQ1 EXPTIME`: on Vesta the
exposure start was off by 0.75 degrees of longitude. The disc centre is the
limb, not the brightness centroid, which sits toward the Sun; `limbCentre` in
the layer's `registration/registration-sweeps.ts` finds it.

## Transfer limits

```json
"transfer": { "maximumSeparationFootprints": 2, "visibilityToleranceMeters": 0.5, "maximumEmissionDegrees": 75 }
```

- **Separation** is how far each interpolated pixel's surface point may lie from
  the sampled point; a larger distance means the pixels straddle a limb or a
  neck. Give either `maximumSeparationMeters` or `maximumSeparationFootprints`, a
  multiple of the pixels' own diagonal footprint, at most 4.
- **Visibility tolerance** is how closely the camera's ray must reach the source
  point, at most 1 m. **Emission** must stay below 90°.

A dataset on source-mesh rays needs terrain simplified with
`source-meshoptimizer`. The report lists the authored limits beside the limits
the frames support (`limits.derived`), and preparation stops when an authored
limit exceeds the derived one.

## Registration stage

`registration.mts` measures every camera route after it loads and writes the
numbers into the dataset report. It never fails a build.

- The **silhouette** compares the limb the mesh projects with the contour the
  frame shows and reports the position-angle residual, its noise floor and the
  systematic remainder. It applies only within 30 degrees of phase angle.
- The **reference sweep** turns the body under each frame against a surface
  reference and reports the peak, both mirrors and whether the frame is
  decisive. The reference is a map named in `reference.observation`, or the
  dataset's other frames. A constant phase error is invisible to a frame
  reference; only a map catches it.
- The **relief** sweep uses the body's own shape lit by its face normals, so an
  irregular mesh places a frame by its shading alone.

Every camera is lit: `ObservationCamera.sunDirection` is required, and a
backplane route recovers it from the archive's phase plane (`fitBackplaneSun`).

A dataset may name `refinement: { by?: 'relief' | 'frames' | 'map', tilt?:
'silhouette', agreementDegrees?: number }`. A correction is applied once and
kept only if the re-measured dataset improves; otherwise it is reverted, with
the reason in the report. A route's own limb fit is the separate key
`limbRefinement`.

A computed-camera dataset ships on its paper's own comparison figure, named in
`source/preparation/published-comparison.json`.
`node packages/bake/cli/published-comparison.mts <object> --write` measures that
figure through the pipeline's cameras and writes the README section between
`<!-- published-comparison:begin -->` and `<!-- published-comparison:end -->`.
None of its numbers is a gate.

`node packages/bake/cli/report-registration.mts <object> --write` writes the
stage's table between `<!-- registration-report:begin -->` and
`<!-- registration-report:end -->`, and `report-registration.test.mts` refuses a
README whose block differs from its report.
`node packages/bake/cli/registration-stage.mts <object> --write` re-runs the
stage alone without packing an atlas; `--all --write` does it for every body
with a camera dataset.

## Report

Each dataset writes one `cssearth-surface-observation-report@1` report, stored
under the dataset's `observation` key in `prepared/surfaces.json`. It records
the format and camera, each frame's identity, geometry, quality and footprint,
the authored and derived limits, the photometry, how frames were chosen and
levelled, the registration stage, the display range, the area each frame
covers, and the id of every consumed input.

## Evidence

For an OSIRIS dataset moved to another source mesh, compare the native GEO
Cartesian samples with both source shapes independently of the display atlas:

```sh
node packages/bake/cli/osiris-shape-comparison.mts comet-67p osiris output/67p-shape-comparison.json
```

The report includes points later withheld by photometry or visibility, so it
cannot be used as a displayed-pixel accuracy claim.
