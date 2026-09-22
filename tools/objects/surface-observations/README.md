# Surface observations

A surface-observation lens drapes photographs over a body's retained mesh.
Preparation carries every photograph through the same stages, whatever archive
it came from. Most come from spacecraft; a ground-based telescope frame enters
the same way once its camera is computed from an ephemeris and a published spin
state, because the route takes the camera as numbers rather than as a mission's
own geometry file. The runtime only displays the prepared atlas.

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
| Camera | `cameras.mts` | Projects surface points to detector pixels and casts rays back. A camera is fitted to archive backplanes, read from an archived closure, derived from SPICE kernels, taken from a registered control network, or computed for a ground-based frame by `../terrestrial-layers/observer-camera.mts` from an ephemeris and a rotation model: a light-curve inversion spin state, or an IAU pole model read from a text PCK such as the shared `pck00011.tpc`. A limb refinement can rotate a SPICE or OSIRIS reflectance camera onto the mesh's lit limb. |
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
| `llorri-camera` | `formats/geo.mts` | Archived closure with TAN-SIP distortion, bound to a body the frame lists in its field of view | Source-mesh rays |
| `near-msi-camera` | `formats/geo.mts` | Reconstructed image table and bounded limb refinement | Source-mesh rays; paired raw detector validity |
| `nh-lorri-camera` | `formats/geo.mts` | Archived closure with TAN-SIP distortion | Source-mesh rays |
| `nh-mvic-camera` | `formats/geo.mts` | Archived closure through a fitted image transform; three registered filters shown as colour | Source-mesh rays |
| `spice-camera` | `formats/geo.mts` | SPICE kernels | Source-mesh rays |
| `junocam-camera` | `formats/junocam.mts` | SPICE kernels, one camera per strip of a push-frame image, with the kernel's radial distortion and two epochs fitted to the lit limb | Source-mesh rays, cast only where a strip can hold lit surface |
| `encounter-fits` | `formats/encounter.mts` | Registered control network | Source-mesh rays |
| `controlled-shape-camera` | `formats/controlled-camera.mts` | A published control network (Thomas or Stooke shape releases) or the Galileo SSI image catalog | Source-mesh rays |
| `controlled-shape-color` | `formats/controlled-camera.mts` | The same cameras for three sequential filters, measured again against reference images | Source-mesh rays |
| `isis2-orthographic` | `formats/orthographic.mts` | None: every pixel names a DEM post | Registered DEM posts |

The [implementation map](../../../.agents/skills/celestial-skill/references/implementation-map.md#choose-a-photograph-route)
says which format fits what an archive ships.

A JunoCam image is a stack of strips, each read at its own instant from a spinning spacecraft, so `junocam-camera` builds one camera per strip and joins them
with [`composite.mts`](composite.mts): the strips of a filter make a band, and three bands make a colour photograph. The [JunoCam guide](../../../docs/junocam.md)
records the route and what it measured on Europa.

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
  "display": { "basis": "authored", "percentiles": [1.9, 99.3] },
  "metadata": { "label": "OSIRIS", "coverage": "..." },
  "focus": { "...": "optional: where the camera looks when the lens opens" }
}
```

- `frames` lists the photographs. The format caps their number: one for an
  orthophoto, eight for encounter frames and JunoCam images, thirty-two for controlled cameras, and
  each geo schema its own. A lens with more than one frame also names its
  `selection` and `levelMatching`; a single frame names neither.
- A frame `id` is the archive's product id, such as `n1506184171_1` or a Galileo
  SSI image number. Lens and consumer ids are lower-case words joined by hyphens.
- `display` is either `percentiles` of the displayed surface samples or one
  stated `displayRange`, and names its `basis`: `authored` when a contributor
  chose the stretch, or `source` with the `sourceId` of a consumed input that
  states it. Every lens is authored today.
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
| `junocam-camera` | `startTime`, `labelPath` | `spice` (kernel bank, kernels in load order, observer, target and its label name, body frame, aberration) and `epochRefinement` with its budgets; the red, green and blue strips shown as colour, so `metadata.falseColor` and a `displayRange` from 0 |
| `encounter-fits` | `labelPath`, `controlPath` | nothing |
| `controlled-shape-camera` | `labelPath`, and either every control-network camera field or a `cameraCatalog`; optional `encoding`, `backgroundMaximum`, `backgroundOffset`, `coverageInsetPixels`, `quality` | `photometry`: a published model, `lunar-lambert` with its `weight`, or `retained-observation`; `percentiles` or a `displayRange` from 0 |
| `controlled-shape-color` | The same, for each band of a band set | `bands` (the red, green and blue filters), `frames` as band sets, optional `bandAlignment`; `metadata.falseColor` and a `displayRange` from 0 |
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
  samples or one stated `displayRange`. A controlled-camera monochrome lens
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
  order or the finest resolution, or it averages its frames. A pick keeps each
  displayed point in the one photograph it came from. The finest resolution is the frame whose pixel covers the least
  surface at that point: its pixel scale over the cosine of the emission angle
  there, so a nearer frame that sees the point obliquely loses to a farther one
  that sees it face on. Ranking by pixel scale alone left Kleopatra's
  two-apparition lens at 6.69 km per displayed pixel on the surface against
  5.06 km, and Hebe's at 5.31 against 4.42, measured on their meshes.
- **Edge-weighted average.** Every frame that qualifies at a point contributes
  its levelled value, weighted by how deep inside its usable disc the point
  lies over its pixel area at the target. The depth is the distance to the
  nearest pixel the lens cannot use (off the body, past the emission or
  incidence limit, or disqualified) as a fraction of the frame's deepest
  pixel's, so a frame fades out at its limb and terminator instead of stopping
  there; see [`contour.mts`](contour.mts). The SPHERE team mapped Vesta the same
  way ([Fétick et al. 2019](https://doi.org/10.1051/0004-6361/201834749),
  section 4.4): epochs averaged with weights that fall toward the limb, the
  contour itself left out. The paper states no width for its Gaussian weight;
  this one falls linearly and needs none. The SPHERE survey lenses use it,
  since their deconvolved frames ring at the disc edge. On Kleopatra's lens map
  the step between neighbouring pixels where the finest-resolution pick
  changed frame fell from a median 2.13% of the display range to 0.10%
  (worst 1%: 41.7% to 2.7%), and on Kalliope's from 1.35% to 0.12% (47.9% to
  7.1%). Differences one data pixel apart inside one frame stayed about the
  same (Kleopatra median 0.34% and 0.43%, Kalliope 0.48% and 0.41%). Coverage
  did not change. Spacecraft frames keep the pick.
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
  reference. Deconvolved ZIMPOL frames state no unit, and the survey's
  deconvolution changes scale between observing seasons (Kleopatra's 2017 and
  2018 frames differ about 20× in total counts through one filter at one gain).
  Their format gives the fit each frame's season, frames 120 days or more apart
  starting a new one. Every frame must then be reached by counted pairs, each
  season's level comes from those pairs alone, and `maximumGain` bounds each
  frame against its own season's first frame. A controlled-camera lens casts at
  most 96 frames, the fit's bound.
- **Controlled-camera registration.** A frame is refused when its stated camera
  places more than a quarter of its lit source shape, within the lens's incidence
  limit, on the photograph's edge-connected sky. Across the first 136 controlled
  frames, registered frames placed at most 13% there and the two misregistered
  frames 36% and 99.8%. The frame report records the share.

## Observer-computed cameras

A ground-based frame ships pixels and instrument metadata, and its camera is computed rather than read. Everything that computation needs is pinned beside the body and named in `source/preparation/observer-cameras.json`: the rotation model (a light-curve inversion spin record with its verified column order, or an IAU pole model in a text PCK with its NAIF body code), the two pinned Horizons tables, the epoch rule and the centre rule. `node tools/objects/observer-cameras.mts <object> --write` derives the eight controlled-camera fields and the disc centre for every frame of the lens and states them in the recipe; `terrestrial-layers/observer-cameras.test.mts` refuses a recipe that drifts from what its inputs give, for every body that carries the record. Nothing in such a recipe is fitted.

For a body of the VLT/SPHERE asteroid survey, `node tools/objects/sphere-survey/setup.mts <object>` does all of this in a scratch copy and measures the result against the survey's figure, and `install.mts` writes it into the package; the [recipe](../../../.agents/skills/celestial-skill/references/sphere-survey-photographs.md) gives the steps. `node tools/objects/sphere-horizons.mts <object> --write` writes and pins the two Horizons tables for exactly the lens's frames: Paranal rows at each frame's stated exposure start, which is the time the derivation matches rows by, and heliocentric vectors one light time earlier. Horizons refuses a list of more than 25 times, so the tool asks in batches and joins the rows. For the six bodies whose tables were made by hand, it reproduces their positions exactly and their ranges and vectors to within a kilometre.

A spin record's column order is not the reader's choice. `terrestrial-layers/spin-record-reading.mts` reads the release both ways and keeps the reading within 5° of the published pole: the one in the body's `reference/model-properties.json` when that cites the paper, otherwise the one the rotation in `observer-cameras.json` states with its source and table (a DAMIT-shaped body carries the survey's Table A.1 pole there). It refuses when neither reading is that close, or when the two readings are within 2° of each other. A record that states a pole a few degrees past the pole is folded to the same axis, with half a turn added to its phase so the body frame stays the record's own; Elektra's is the case. `loadOrientation` refuses a record that states the other order. Of the survey releases in the repository, only Eleonora's and Nemesis's cannot be read this way; their ledgers record it, and `spin-record-reading.test.mts` checks that they do.

Two rules came out of measuring the route on Vesta, where a Dawn mosaic exists to measure against. The epoch is the exposure midpoint, from the frame's own `ESO DET SEQ1 EXPTIME`: an 81 s ZIMPOL exposure of a body turning 1600 degrees a day moves the longitude by 0.75 degrees between start and midpoint, and the start was wrong by that much. The disc centre is the limb, not the brightness centroid: the centroid sits toward the Sun at any phase angle, so `limbCentre` in `terrestrial-layers/registration-sweeps.mts` aligns the outline the lens mesh projects to the outline the frame shows and takes the first harmonic of the residual as the centre error.

The same module holds `registrationSweep`, the check a silhouette cannot make. The frame is cast through the mesh, a surface reference is sampled where each pixel lands, and the correlation of prediction and photograph is swept over a turn about the pole and over both mirrors; a correct model peaks at zero and beats its mirrors, and the peak's offset is the measured longitude error. The reference is a mapped surface where one exists (`shading: 'radial'`, because a photographic mosaic carries its own relief shading) or the body's other frames (`framesReference`, shaded by the mesh's face normals so the body's own relief does not pass for markings). Vesta is the measurement: 30 SPHERE frames against the Dawn mosaic peak at +0.5 degrees (median, 28 of 30 within 3 degrees) with the model 2.5 times ahead of the better mirror, and the IAU 2015 pole model, whose prime meridian is 210 degrees from Dawn's, peaks 210 degrees away (`tests/objects/unit/vesta/sphere-registration.test.mts`). A turn about the pole and a shift of the disc centre move the markings alike near the disc centre, so the offset is only as certain as the centre: about one degree per pixel on a 180 pixel disc.

What the frame-to-frame reference can and cannot decide was measured across the survey. Held against its own other frames, a body's frames must carry markings the deconvolution resolves; on 34 bodies with 5 to 80 frames each, including the five photographed ones, the peak correlation stays between 0.07 and 0.3 and the model does not separate from its mirror, because these discs show shape and shading rather than markings. The test therefore adds nothing for them: the five photographed bodies stand on their silhouette registration and on the route's measurement against Vesta, and the rounder bodies, which no silhouette can judge either, stay unresolved in their ledgers with the numbers, until a map or resolved markings exist for them. A constant phase error moves every frame together and is invisible to a frame-to-frame reference by construction; only a map catches it.

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

## Registration stage

Every camera route is measured after it loads, the same way, by `registration.mts`, and the numbers go into the lens report instead of a body's prose. The stage never fails a build; the one hard rule stays where it was, on lit shape over sky in the format that loads the frame.

Two measurements. The **silhouette** compares the limb the mesh projects (its vertices lit at least the edge fraction) with the contour the frame shows above that fraction of its peak, frame by frame, and reports the position-angle residual over the frames whose outline is elongated enough to define one, the floor set by exposures within fifteen minutes of each other, and the systematic remainder after the floor is removed in quadrature. A disc that runs off the detector is reported as partial, not scored. The **reference sweep** turns the body under each frame against a surface reference through `../terrestrial-layers/registration-sweeps.mts` and reports the exact peak, both mirrors, and whether the frame is decisive (a peak of at least 0.15 that clears the better mirror by ratio 1.5 or by 0.25, or a peak of at least 0.05 that stands four times above both mirrors, which is how a relief-shaded mosaic seen under other lighting places a frame); a median offset is stated only over three or more decisive frames. The reference is the observation the lens names in `reference.observation`, a map of the same body lit as a smooth disc because a photographic mosaic carries its own relief shading, or otherwise the lens's other frames more than an hour away, lit by the mesh's face normals; a constant phase error moves every frame together and is invisible to a frame reference, which only a map catches. A third sweep, **relief**, needs neither: the body's own shape lit by its face normals is the reference, so an irregular mesh places a frame by its shading alone, and a smooth mesh says nothing and says so. The silhouette applies only within 30 degrees of phase angle; past that the contour is a crescent's and the frame is left to the sweeps. Large detectors are reduced by a whole factor to a ray budget before the sweep, so the cost is bounded and the result is a measurement in degrees.

**Every camera is lit.** `ObservationCamera.sunDirection` is required: a label, a kernel set or an ephemeris states it, and a backplane route recovers it from the archive's own phase plane (`fitBackplaneSun` in `cameras.mts`), since at every surface point the phase angle is the angle between the direction to the camera and the direction to the Sun and the Sun is one direction for the whole frame; a disjoint holdout must agree to a quarter degree. Itokawa's fitted Sun agrees with the Gaskell SUM file's stated one to under 0.1°, and 67P, Itokawa and the DART pair, which the stage could not judge before, are judged now.

**Refinement, by agreement, kept by measurement.** A lens may name `refinement: { by?: 'relief' | 'frames' | 'map', tilt?: 'silhouette', agreementDegrees?: number }` (a route's own limb fit is a separate key, `limbRefinement`, which its format applies before any geometry is derived). `by` turns every camera about the pole by the named reference's decisive median; `tilt` rolls every camera about its line of sight by the silhouette's median residual when at least three frames scored and the median stands above the frames' floor. Both are decided on the untouched measurement and applied once, and the corrected lens is measured again: a turn is kept only if the reference it came from moves toward zero, a tilt only if the limb residual falls, and a correction that fails that test is reverted, with the reason in the report. Psyche keeps a 5° tilt that took its residual from 4.5° to 3.2°. A turn needs at least the rule's three decisive frames and applies only when every other decisive reference agrees within the stated degrees (three by default); a conflict is reported and the provider's camera stands. The provider's camera and the turn stay side by side in each frame's report. Nothing is fitted quietly.

**A ground-based lens ships on its paper's comparison.** The asteroid survey papers register a model the way the field does: ADAM fits shape, spin and a per-image offset together against every frame and light curve (Viikinkoski, Kaasalainen and Ďurech 2015), and each paper shows the fit as a figure of images beside model projections, with no independent check. That standard, not this stage, decides a computed-camera lens. Two records name the evidence. `source/preparation/published-comparison.json` names the figure: the paper by DOI and by its manifest input, the figure's image object in that PDF with its size and pixel digest, which rows of the figure's dark band hold the photographs and the model the lens rides, and which lens frame each column shows, in which band. The observer-cameras record's `publishedComparison: { ledgerEntry }` names the included ledger entry that reports the result.

`node tools/objects/published-comparison.mts <object> --write` measures the figure through the pipeline's own cameras and writes `evidence/published-comparison.json`, with an image of the paper's photographs carrying its model's outline and ours, and the README section between `<!-- published-comparison:begin -->` and `<!-- published-comparison:end -->`, whose numbers are read from the evidence. For each column it reports the outline overlap with the paper's model at our phase and over a full turn in 10° steps, the overlap with the paper's photograph, how far our outline must turn in the picture to meet each, and the spin axis we project against the figure's arrows. The arrows and a photograph's printed labels are left out of the outlines. It also reports the score our own outline gets against itself drawn at the paper's pixel scale. That is what the measure gives one shape at those two pixel sizes, so read the other overlaps against it; for Iris it is 0.985 to 0.988. For the lens as a whole it reports the outline residual in native pixels over a ±30° phase sweep. None of these numbers is a gate. When a paper publishes feature identifications, casting them through our cameras is a further check for the ledger. The stage verdict is reported beside the lens and is not a gate either. `report-registration.test.mts` refuses a conflict on every other lens, and checks that a comparison's evidence matches its record and that its ledger entry cites the paper. Iris is why. With its rotation record read correctly the stage reports a conflict, because the outline scores 9 of 23 frames at 6.5°, while the paper's own model and images differ by up to 13° on the same measure. Read wrongly, with the pole 9° off, every outline is too round to score and the relief sweep registers it, since relief lit by the survey's own mesh placed both readings within a degree.

The body README carries the stage's table between `<!-- registration-report:begin -->` and `<!-- registration-report:end -->`, written by `node tools/objects/report-registration.mts <object> --write` from `prepared/surfaces.json`; `report-registration.test.mts` refuses a README whose block differs from its report. `node tools/objects/registration-stage.mts <object> --write` runs the stage alone, through the same loaders, and rewrites only the registration in the prepared report and the README block: a changed rule or a re-derived camera is re-measured in seconds, without packing an atlas, and `--all --write` does it for every body with a camera lens in a few minutes. Every camera kind reaches the stage through one interface, a caster that can be turned about the pole, so a computed observer camera and a spacecraft kernel camera are judged alike.

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
| `selection`, `blending`, `levelMatching` | How frames were chosen or averaged, and for a mosaic the fitted gains, every pair's samples, spread and precision, and any unconnected groups |
| `registration` | The registration stage for every lens whose frames carry a camera: `silhouette` (limb position-angle residual per frame, the noise floor from exposures minutes apart, the systematic remainder) and `reference` (each frame turned about the pole against the named map observation or the lens's other frames: exact peak, both mirrors, the decisive count and median offset). A controlled colour lens keeps its band check under `bands` |
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
- The browser views of ten lenses at 1440 × 1000 and DPR 2 were never
  committed: the repository ignores `captures/` folders, and no copy remains.
  The sheets above are the kept visual evidence.

`tools/investigations/compare-visual-evidence.mts` made each diff from the exact committed
bytes, with threshold 0.1 and anti-aliasing included. A mismatch count only
locates change. The sheets were inspected against `main` at native resolution,
and the body READMEs record what that found.
