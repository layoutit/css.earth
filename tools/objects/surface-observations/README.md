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
| Pixel geometry | `geometry.mts` | Gives each pixel a surface point, a range and its incidence, emission and phase angles. They come from the archive's backplanes, or from the camera's rays cast onto the full source mesh. Hits on faces the source marks as unconstrained are withheld. |
| Photometry | `photometry.mts` | One gain function per lens: a published model record, a historical disk function or the photograph's own shading. |
| Footprint | `footprint.mts` | Interpolates the four pixels around a projected point. Each pixel must have geometry, pass quality, face the camera within the emission limit, lie on the sampled surface patch and admit a gain. |
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
| `isis2-orthographic` | `formats/orthographic.mts` | None: every pixel names a DEM post | Registered DEM posts |
| `published-image-projection` | `formats/published-image.mts` | Explicitly approximate orthographic placement | Source-mesh rays under that assumption |

The [implementation map](../../../.agents/skills/celestial-skill/references/implementation-map.md#choose-a-photograph-route)
says which format fits what an archive ships.

The NEAR MSI adapter retains calibrated I/F with its original illumination.
Mathilde's [source method](../../../src/planets/mathilde/README.md) records the
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
  "selection": "lowest-emission", "levelMatching": { "minimumPairs": 128, "maximumLogMad": 0.25, "maximumGain": 1.35, "samplesPerTriangle": 64 },
  "transfer": { "...": "see Transfer limits" }, "photometry": { "...": "..." },
  "display": { "percentiles": [1, 99.5] },
  "metadata": { "label": "OSIRIS", "coverage": "..." }
}
```

- `frames` lists the photographs, one to eight. A lens with more than one frame
  also names its `selection` and `levelMatching`; a single frame names neither.
- `display` is either `percentiles` of the qualified values or one authored
  `displayRange`.
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
| `isis2-orthographic` | `coordinatePaths` | `grid`, `maximumCoordinateErrorMeters`; one frame, a `transfer` with only `maximumSourceDistanceMeters`, no `photometry` |
| `published-image-projection` | `projection`: pinned image/shape hashes, crop, assumed basis, scale, centre, mask and limitations | One frame; original RGB range 0–255, retained illumination |

The published-image format is for an explicitly accepted approximate display,
such as [Toutatis](../../../src/planets/toutatis/source/reference/chang-e-2-method.md).
Its report always marks registration unqualified. It cannot substitute for a
measured camera, add geographic landmarks or establish source accuracy from a
limb match. A null spacecraft position and a separate viewing direction keep
the orthographic ray plane from becoming a fictitious camera observation.
The selector and description must identify approximate placement; the grid
marks excluded terrain. RGB values retain the publisher's display encoding
instead of passing through the scientific-band color transfer again.

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

Three choices still differ by format, and each lens report records them:

- **Display point check.** Archive-backplane and camera-closure formats also
  sample the displayed point before the closest source point, so a photograph
  must cover both.
- **Display range.** Those formats take the display percentiles from the first
  frame's qualified pixels. Encounter frames take them from samples on the
  displayed surface. An orthophoto uses its authored range. The MVIC colour cube
  shows its three bands on one authored range: its format names the bands and
  their data-number quantity, which the decoder checks against the native label.
  Floating samples receive the [shared IEC sRGB transfer](../color-transfer.mts)
  once, after surface transfer, and the report records the band policy. Encoding
  does not qualify natural color.
- **Selection.** A mosaic picks the lowest emission, the first frame in recipe
  order, or the finest pixel scale.

## Transfer limits

```json
"transfer": { "maximumSourceDistanceMeters": 90, "maximumSeparationMeters": 200, "visibilityToleranceMeters": 0.5, "maximumEmissionDegrees": 75 }
```

- **Source distance** is how far a displayed point may lie from the source mesh.
  It may not exceed the mesh's simplification error.
- **Separation** is how far each interpolated pixel's surface point may lie from
  the sampled point. A larger distance means the pixels straddle a limb or a
  neck. Give either `maximumSeparationMeters`, a fixed distance, or
  `maximumSeparationFootprints`, a multiple of the pixels' own diagonal
  footprint, at most 4. The footprint is the range times the camera's pixel
  angle, stretched by the emission angle, so one number serves every range and
  viewing angle.
- **Visibility tolerance** is how closely the camera's ray must reach the source
  point, at most 1 m. **Emission** must stay below 90°.

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
| `frames` | Each frame's identity, camera, pixel geometry, quality report, pixel counts, measured footprint and any registration or refinement |
| `limits` | The authored transfer limits and the derived limits with their rule |
| `photometry` | The model or disk function, its formula and limits |
| `selection`, `levelMatching` | How frames were chosen, and the fitted level gains for a mosaic |
| `display` | Where the range came from, the range and its units |
| `areaCoverage` | The share of the displayed surface each frame covers, from equal-area samples |
| `sourceIds` | Every consumed input, with its sha256 |
