# Surface observations

A surface-observation lens drapes spacecraft photographs over a body's retained
mesh. Preparation carries every photograph through the same stages, whatever
archive it came from. The runtime only displays the prepared atlas.

```text
decode → camera → pixel geometry → photometry → footprint → surface transfer → report
```

A body owner names a format and its pins in `raster.surfaceObservations`. A
format adapter decodes the product and builds its camera and pixel geometry.
Every later stage is shared, so a new archive product needs an adapter, not a
new route.

## Stages

| Stage | Module | What it does |
| --- | --- | --- |
| Decode | `formats/*.mts`, with the readers in `../terrestrial-layers/` | Reads the product, checks its identity against the recipe and applies the archive's own quality verdict to each pixel. |
| Camera | `cameras.mts` | Projects surface points to detector pixels and casts rays back. A camera is fitted to archive backplanes, read from an archived closure, derived from SPICE kernels or taken from a registered control network. A limb refinement can rotate a SPICE or OSIRIS reflectance camera onto the mesh's lit limb. |
| Pixel geometry | `geometry.mts` | Gives each pixel a surface point, a range and its incidence, emission and phase angles. They come from the archive's backplanes, or from the camera's rays cast onto the full source mesh with interpolated vertex normals; a ray-cast pixel also knows whether terrain shadows it. Hits on faces the source marks as unconstrained are withheld. |
| Photometry | `photometry.mts` | One gain function per lens: a published model record, a disk function such as Lunar-Lambert, or the photograph's own shading. |
| Footprint | `footprint.mts` | Interpolates the four pixels around a projected point. A pixel contributes only if it has geometry, passes quality, faces the camera within the emission limit, lies on the sampled surface patch, is lit when the photometry normalizes illumination and admits a gain. Each contributor is normalized before interpolation, and the point needs contributors carrying at least half of the bilinear weight. |
| Surface transfer | `surface.mts` | Finds the closest source point for each displayed point and checks that the camera sees it. Then it selects a frame, matches levels between frames, sets the display range, measures area coverage and renders the flat preview. |
| Report | `surface.mts` | Writes the same report for every format. |

## Formats

| Recipe `format` | Adapter | Camera | Pixel geometry |
| --- | --- | --- | --- |
| `osiris-geo` | `formats/geo.mts` | Fitted to the backplanes | Archive backplanes |
| `amica-gaskell` | `formats/geo.mts` | Fitted to the backplanes | Archive backplanes |
| `pds4-geometry-cube` | `formats/geo.mts` | Fitted to the backplanes | Archive backplanes |
| `osiris-camera` | `formats/geo.mts` | Archived closure | Source-mesh rays |
| `llorri-camera` | `formats/geo.mts` | Archived closure with TAN-SIP distortion | Source-mesh rays |
| `near-msi-camera` | `formats/geo.mts` | Reconstructed image table and bounded limb refinement | Source-mesh rays; paired raw detector validity |
| `nh-lorri-camera` | `formats/geo.mts` | Archived closure with TAN-SIP distortion | Source-mesh rays |
| `nh-mvic-camera` | `formats/geo.mts` | Archived closure through a fitted image transform; three registered filters shown as colour | Source-mesh rays |
| `spice-camera` | `formats/geo.mts` | SPICE kernels | Source-mesh rays |
| `encounter-fits` | `formats/encounter.mts` | Registered control network | Source-mesh rays |
| `controlled-shape-camera` | `formats/controlled-camera.mts` | A published control network (Thomas or Stooke shape releases) or the Galileo SSI image catalog | Source-mesh rays |
| `controlled-shape-color` | `formats/controlled-camera.mts` | The same cameras for three sequential filters, measured again against reference images | Source-mesh rays |
| `isis2-orthographic` | `formats/orthographic.mts` | None: every pixel names a DEM post | Registered DEM posts |

The [implementation map](../../../.agents/skills/celestial-skill/references/implementation-map.md#choose-a-photograph-route)
says which format fits what an archive ships.

The NEAR MSI adapter retains calibrated I/F with its original illumination.
Mathilde's [source method](../../../src/objects/mathilde/README.md) records the
reconstructed image table, inferred detector conventions, raw-data checks and
limits of silhouette registration on the visualization shape.

## Recipes

Every lens has the same shape. A format adds only its frame inputs and its own
blocks, and validation refuses any key the format does not declare, so a
misspelt field fails instead of being ignored.

```json
{
  "id": "osiris", "format": "osiris-geo", "consumer": "osiris-observation",
  "filter": "...", "allowLossy": false,
  "frames": [{ "id": "...", "path": "...", "qualityPath": "...", "startTime": "..." }],
  "selection": "lowest-emission", "levelMatching": { "samplesPerTriangle": 64, "minimumPairs": 128, "maximumGain": 1.35, "maximumAngleDegrees": 65 },
  "transfer": { "...": "see Transfer limits" }, "photometry": { "...": "..." },
  "display": { "percentiles": [1.9, 99.3] },
  "metadata": { "label": "OSIRIS", "coverage": "..." },
  "focus": { "...": "optional: where the camera looks when the lens opens" }
}
```

- `frames` lists the photographs. The format caps their number: one for an
  orthophoto, eight for encounter frames, sixteen for controlled cameras, and
  each geo schema its own. A lens with more than one frame also names its
  `selection` and `levelMatching`; a single frame names neither.
- A frame `id` is the archive's product id, such as `n1506184171_1` or a Galileo
  SSI image number. Lens and consumer ids are lower-case words joined by hyphens.
- `display` is either `percentiles` of the displayed surface samples or one
  authored `displayRange`.
- `recipe.mts` checks the shared shape. Each adapter declares the rest:

| Format | Each frame adds | The lens adds |
| --- | --- | --- |
| `osiris-geo` | `startTime`, `qualityPath` | `filter`, `allowLossy`, optional `radiometry` |
| `amica-gaskell` | `startTime`, `labelPath`, `originalPath` | `filter` (`V`) and the shared `flatPath` |
| `pds4-geometry-cube` | `startTime`, `labelPath` | `filter`, `cube` |
| `osiris-camera` | `startTime`, `cameraPath` | `filter`, `allowLossy`, optional `refinement` |
| `llorri-camera`, `nh-lorri-camera` | `startTime`, `cameraPath` | `filter` |
| `near-msi-camera` | `startTime`, `cameraPath`, `originalPath` | `filter`, required `refinement`; retained illumination, uncompressed calibrated/raw FITS pairs |
| `nh-mvic-camera` | `startTime`, `cameraPath`, `labelPath` | `filter`; one frame with retained illumination, `metadata.falseColor` and a `displayRange` from 0 for all three bands |
| `spice-camera` | `startTime`, and `labelPath` for a VICAR image | `filter`, `spice`, optional `refinement` |
| `encounter-fits` | `labelPath`, `controlPath` | nothing |
| `controlled-shape-camera` | `labelPath`, and either every control-network camera field or a `cameraCatalog`; optional `encoding`, `backgroundMaximum`, `backgroundOffset`, `coverageInsetPixels`, `quality` | `photometry`: a published model, `lunar-lambert` with its `weight`, or `retained-observation`; `percentiles` or a `displayRange` from 0 |
| `controlled-shape-color` | The same, for each band of a band set | `bands` (the red, green and blue filters), `frames` as band sets, optional `registration`; `metadata.falseColor` and a `displayRange` from 0 |
| `isis2-orthographic` | `coordinatePaths` | `grid`, `maximumCoordinateErrorMeters`; one frame, no `transfer` and no `photometry` |

## Adding an archive product

Write an adapter that implements `SurfaceObservationFormat` from `contract.mts`
and register it in `index.mts`. The adapter:

1. declares what its frames and lens add to the shared recipe, checks them with
   `recipe.mts` and names every pinned path the lens consumes;
2. decodes each frame into an `ObservationImage`;
3. builds an `ObservationCamera` and a `PixelGeometry`, usually with
   `matrixCamera` or `fittedCamera` and `castSourceRays` or `archiveBackplanes`;
4. passes them to `cameraFrame` and returns the frames with a `SurfacePolicy`.

When a product needs a new kind of camera or geometry, extend `cameras.mts` or
`geometry.mts` so the next adapter can reuse it.

## Route policy

Every format follows the same transfer, display and level rules. Each lens
report records them.

- **Transfer.** Each displayed point samples its closest point on the source
  mesh. There is no separate check of the displayed point and no limit on its
  distance from the source mesh: meshoptimizer's error is an estimate, and the
  measured deviation exceeded it on Atlas (287 m against 200 m), Janus (2,043 m
  against 1,300 m), comet 81P and Donaldjohanson, so such a limit made holes.
  Faces that only complete an open source surface are withheld as
  `estimated-geometry`, and an exact tie between source points as
  `ambiguous-source-point`.
- **Display range.** A lens shows either `percentiles` of its displayed surface
  samples or one authored `displayRange`. A controlled-camera monochrome lens
  uses a range from zero to the 99.5th percentile its samples measured in
  preparation, so a uniformly bright body is not stretched between its own
  darkest and brightest samples. A colour lens shows its three bands on one
  authored `displayRange`: the MVIC cube's format names the bands and their data-number
  quantity, which the decoder checks against the native label, and a controlled
  colour lens checks each filter and its I/F units in the native labels. Floating
  samples receive the [shared IEC sRGB transfer](../color-transfer.mts) once,
  after surface transfer, and the report records the band policy. Encoding does
  not qualify natural color.
- **Selection.** A mosaic picks the lowest emission, the first frame in recipe
  order, or the finest pixel scale. Each displayed point keeps the one photograph
  it came from.
- **Level matching.** Frames are compared on equal-area samples
  (`samplesPerTriangle`). A pair of frames counts when it shares `minimumPairs`
  samples and its median log ratio is known to 0.07, that is
  √(π/2) × 1.4826 × MAD / √n ≤ 0.07. With `maximumAngleDegrees`, only samples both
  frames see within that incidence and emission angle count. Frames joined by
  counted pairs share one fit anchored on their group's first frame; a frame no
  counted pair reaches keeps its own level. Every fitted gain must stay within
  the lens's `maximumGain`, which the format caps: 1.5 for geo formats, 3 for
  encounter frames and 16 for controlled cameras, whose raw detector frames
  through different filters and exposures measure up to 10.3 from their
  reference.
- **Controlled-camera registration.** A frame is refused when its stated camera
  places more than a quarter of its lit source shape, within the lens's incidence
  limit, on the photograph's edge-connected sky. Across the first 136 controlled
  frames, registered frames placed at most 13% there and the two misregistered
  frames 36% and 99.8%. The frame report records the share.

## Transfer limits

```json
"transfer": { "maximumSeparationFootprints": 2, "visibilityToleranceMeters": 0.5, "maximumEmissionDegrees": 75 }
```

- **Separation** is how far each interpolated pixel's surface point may lie from
  the sampled point. A larger distance means the pixels straddle a limb or a
  neck. Give either `maximumSeparationMeters`, a fixed distance, or
  `maximumSeparationFootprints`, a multiple of the pixels' own diagonal
  footprint, at most 4. The footprint is the range times the camera's pixel
  angle, stretched by the emission angle, so one number serves every range and
  viewing angle.
- **Visibility tolerance** is how closely the camera's ray must reach the source
  point, at most 1 m. **Emission** must stay below 90°.

A lens on source-mesh rays needs terrain simplified with `source-meshoptimizer`,
so the source mesh the rays hit is the one the display mesh preserves.

The loader measures each frame's pixel angle and nadir footprint. The report
lists the authored limits beside the limits the frames support (`limits.derived`).
A fixed separation may be at most four diagonal footprints of the coarsest frame
at the emission limit, plus the mesh error when the backplanes come from the
archive's own shape model. Preparation stops when an authored limit exceeds the
derived one.

## Report

Each lens writes one `cssearth-surface-observation-report@1` report. Preparation
stores it under the lens's `observation` key in `prepared/surfaces.json`, with
the atlas transfer counts.

| Field | Content |
| --- | --- |
| `format`, `camera` | The recipe format, and the reference frame's camera kind and position |
| `frames` | Each frame's identity, camera, pixel geometry, quality report, pixel counts, measured footprint and any registration or refinement; a controlled camera adds its lit-shape-on-sky share |
| `limits` | The authored transfer limits and the derived limits with their rule |
| `photometry` | The model or disk function, its formula and limits |
| `selection`, `levelMatching` | How frames were chosen, and for a mosaic the fitted gains, every pair's samples, spread and precision, and any unconnected groups |
| `registration` | For a controlled colour lens, each band camera measured against its reference image |
| `display` | Where the range came from, the range and its units |
| `areaCoverage` | The share of the displayed surface each frame covers, from equal-area samples |
| `sourceIds` | Every consumed input, with its sha256 |

## Evidence

[`evidence/photograph-pipeline`](evidence/photograph-pipeline/) compares the
prepared images that moving every photograph lens onto this contract changed
with `main` at `3785f09de`:

- [Six minimap sheets](evidence/photograph-pipeline/minimaps-01.webp) show each
  changed 640 × 320 minimap on `main`, on the branch and as a Pixelmatch diff.
  51 minimaps changed, one of them (Epimetheus false colour) only in its
  encoding; 55 are byte-identical.
- [The context sheet](evidence/photograph-pipeline/contexts.webp) does the same
  for the 23 changed context images.
- [`evidence.json`](evidence/photograph-pipeline/evidence.json) pins both inputs
  and each diff by size and SHA-256 and records the compared and mismatched
  pixels. `diffs/` keeps every diff at full size.
- [`captures/`](evidence/photograph-pipeline/captures/) holds browser views of
  ten lenses at 1440 × 1000 and DPR 2; its `report.json` records the browser,
  revision, camera states and manifest hashes.

`tools/compare-visual-evidence.mts` made each diff from the exact committed
bytes, with threshold 0.1 and anti-aliasing included. A mismatch count only
locates change. The sheets were inspected against `main` at native resolution,
and the body READMEs record what that found.
