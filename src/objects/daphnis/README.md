# Daphnis

## Sources

**False color** adds three original Cassini ISS NAC filter observations displayed as RGB (RED / GRN / BL1), calibrated by CISSCAL 4.0beta into linear I/F. This is false color. Each frame uses its own measured camera row in the [Thomas 2018 daphnis document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/daphnis_document.pdf), registered to the matching original plate model.

- **Monochrome:** 3 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying this moon’s PDS shape. Clear-filter images supply the base and the best 2017 green-filter photograph supplies the fine detail.

- **Elevation:** radial height above a 3.8 km reference sphere from the same measured shape.

- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61).

## Evidence

The 2026-09-13 [color-encoding capture](evidence/filter-color/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/filter-color/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

**False color:** The 2010 color view is coarse (roughly 18 detector pixels across the moon). The sharper 2017 Monochrome view remains available. The [browser record](evidence/filter-color/capture.json) pins the loaded image responses, camera, settings and inspected views at DPR 1 and 2. The existing Monochrome images, body leaves and picking triangles are unchanged; the selected false-color assets use the revised display encoding. Dragging, Shadows and the mobile selector passed without page errors or replaced scene DOM. Scientific qualification comes from the original camera/shape release and the registration evidence described here; these screenshots document the mounted result.

[False color](evidence/filter-color/color-dpr1.png) · [DPR 2](evidence/filter-color/color-dpr2.png) · [Oblique with Shadows](evidence/filter-color/oblique-shadows-dpr1.png) · [Mobile](evidence/filter-color/mobile.png). These captures were refreshed on 2026-09-13 after integrating main at `0636327ba`. The record pins the tested recipe, runtime, display transfer and loaded image bytes, and compares retained geometry with `8cc1a2fae`.

- The exact observations, source URLs and restoration pins are in [source/manifest.json](source/manifest.json) and [source/preparation/acquisition.json](source/preparation/acquisition.json). The simplified surface remains closed and outward wound.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 3 | 0 | — | — | — | its other 3 frames | 0 of 3 | — | 0 of 3 | — | ×1.06 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

**False color:** Three filters were acquired sequentially, and are not a simultaneous true-color photograph or a composition map. Source shadows and phase-dependent brightness remain. The common footprint is smaller than Monochrome coverage; gray grid marks gaps. Small color fringes can remain at sharp relief because the shape and camera solutions have finite accuracy. These 2010 observations resolve only about 18 pixels across the moon; the sharper 2017 Monochrome photograph remains the detail view.

- **Monochrome:** This is a grayscale visualization across these bandpasses, not a uniform-band albedo product. Frame N1863267232_1 samples beyond 70° of incidence carry photometric gains of 1.8–2.1 and read a median 0.38–0.41 against 0.31–0.33 below 70°; they draw strips along the northern edge of the map. N1656997950_1 reads a median 0.03–0.07 between 40° and 75° of incidence against 0.26–0.41 in the other two frames, which draws a dark crescent in the south. Limiting incidence and emission to 70° shrank the crescent but kept the strips and cut coverage from 39.3% to 29.4%, so the lens keeps its 80° incidence and 78° emission limits.

- **Elevation and gaps:** Includes the broad irregular figure; it is not local altitude above a geoid. Published regional radius uncertainty is 0.2–0.7 km. Small crater morphology is not reliably represented. Missing samples remain gray grid.

- **Orbit:** Its model is fitted only to 2005–2018; the 2026 scene extrapolates that fit and has no validated current-epoch position accuracy. Its display uses an approximate Saturn-equatorial pole and explicitly arbitrary meridian because this package does not include the binary Cassini attitude kernel.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## False color preparation

<details>
<summary>Source products, processing and qualification</summary>

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | RED | n1656999219 | 2010-07-05T04:48:08.995 | 436 |
| green | GRN | n1656999274 | 2010-07-05T04:49:03.955 | 436 |
| blue | BL1 | n1656999330 | 2010-07-05T04:49:59.192 | 435 |

Original floating-point IMG products and detached labels are pinned in [the input manifest](source/manifest.json). All three products are unbinned FULL resolution, use lossless spacecraft compression and report zero missing lines. The [recipe](source/preparation/terrestrial.json) records the zero-based detector centres, west-positive observer and solar longitudes, and 2003.44 mm / 12 μm Cassini NAC focal scale. Camera rays and occlusion are evaluated on the original shape; the existing simplified display mesh is retained.

Only common, visible three-filter samples are colored. The maximum incidence and emission angles are 75° to avoid the most foreshortened limb and terminator; detector coverage is inset by two source pixels. The existing edge-connected 0.003 I/F background exclusion retains interior dark patches. This signal-based background rule is an approximate coverage mask, not a detector-quality flag.

The observed I/F samples remain floating point through registration and overlap composition. One common range, 0–0.8 I/F, maps them to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). Clipping and 8-bit quantization happen only at that final boundary. No per-band brightness equalization, clear-filter sharpening or single-band photometric model changes their ratios. No colorimetric transform has been applied; even visible-filter RGB is labelled false color. Prepared source illumination and the app's Shadows control remain separate.

</details>

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="daphnis-source-and-interpretation"></a>

## Selected datasets

- The shared shaded-relief palette shows model slopes, not invented small craters.

- Original plate table and camera document are retained under `source/shape`. Kilometres, zero-based plate indices, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north.

## Preparation and display

The shared controlled-shape camera preparer uses source perspective, west-positive sub-spacecraft and sub-solar coordinates, north azimuth and image-center pixels. Camera registration is taken from the release, not fitted by eye. The NAC pixel angle is 12 µm / 2003.44 mm from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). The attached VICAR label owns pixel offset and record size; these calibrated products retain a telemetry record before the raster.

Preparation applies bounded Lunar-Lambert illumination correction (maximum gain 2.5), source-mesh visibility and cast-shadow rejection, and overlap level matching fitted where both frames see the surface within 70° of incidence and emission (widest gain 1.02). Edge-connected sky below 0.003 I/F is excluded before interpolation; isolated dark features are retained. Corrected values are displayed linearly over 0–0.528 I/F, the 99.5th percentile of displayed samples. Source files remain unchanged. Illumination correction does not recover unobserved or truly shadowed terrain. Resolution varies with the source views; this is a visualization mosaic, not a new scientific global albedo measurement.

The original connected shape is simplified before atlas baking to 400 native PolyCSS `u` leaves (maximum estimated simplifier error 200 m), under the 2,000-leaf budget. Textures use 2,048 × 1,024 intermediate maps and prepared triangle atlases; WebP quality 94 is a delivery choice, not added source resolution. Flood and directional lighting use the same shared mesh-normal preparation and Shadows control. No detached spherical overlay, atmosphere, ring mesh or private controller is added.

Navigation portraits and small dedicated minimaps are derived from the prepared surface. Initial view looks toward 245.82°E, 13.81°N, transformed through the ecliptic presentation basis and CSS X/Y transport.

## Dataset survey

Recorded source selections, alternatives and failed trials are in the [investigation ledger](investigations.json).

## Orbit and orientation limits

The shared astronomy package owns Saturn-relative position, scale and orbit. Its compact precessing ellipse is compared against six independent JPL vector samples; the reported differences are measured fit residuals, not bounded accuracy. Source URLs and intervals travel with the generated orbit and fixtures. Daphnis Horizons data ends on 2018-01-17.

## Source restoration

The shared acquisition plan restores the pinned scientific inputs for preparation. Runtime users do not download the source plate models or floating-point camera frames. See NOTICE.md for credits.

</details>
