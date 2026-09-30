# Daphnis

Daphnis is shown on its measured Cassini shape model in three views: Monochrome photographs, False color and Elevation.

## Sources

- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61). The original plate table and camera document are retained under `source/shape`.
- **Monochrome:** 3 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying this moon’s PDS shape. Clear-filter images supply the base and the best 2017 green-filter photograph supplies the fine detail.
- **False color:** three original Cassini ISS NAC filter observations displayed as RGB (RED / GRN / BL1), calibrated by CISSCAL 4.0beta into linear I/F. Each frame uses its own measured camera row in the [Thomas 2018 daphnis document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/daphnis_document.pdf).
- **Elevation:** radial height above a 3.8 km reference sphere from the same measured shape.

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | RED | n1656999219 | 2010-07-05T04:48:08.995 | 436 |
| green | GRN | n1656999274 | 2010-07-05T04:49:03.955 | 436 |
| blue | BL1 | n1656999330 | 2010-07-05T04:49:59.192 | 435 |

The exact observations, source URLs and restoration pins are in [source/manifest.json](source/manifest.json) and [source/preparation/acquisition.json](source/preparation/acquisition.json). Recorded source selections, alternatives and failed trials are in the [investigation ledger](investigations.json).

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

The shared controlled-shape camera preparer uses the release's camera records, not a fit by eye, with the NAC pixel angle from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). The shape is simplified to 400 triangles.

Monochrome applies bounded Lunar-Lambert illumination correction (maximum gain 2.5), cast-shadow rejection and overlap level matching (widest gain 1.02). Corrected values are displayed linearly over 0–0.528 I/F, the 99.5th percentile of displayed samples.

False color colors only common, visible three-filter samples within 75° of incidence and emission. The [recipe](source/preparation/terrestrial.json) records the camera geometry. One common range, 0–0.8 I/F, maps the bands to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). No per-band equalization changes their ratios.

## Evidence

The simplified surface remains closed and outward wound. The orbit's compact precessing ellipse is compared against six independent JPL vector samples; the differences are measured fit residuals, not bounded accuracy.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 3 | 0 | — | — | — | its other 3 frames | 0 of 3 | — | 0 of 3 | — | ×1.06 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **False color:** the three filters were acquired sequentially, so this is not a simultaneous true-color photograph or a composition map. These 2010 observations resolve only about 18 pixels across the moon; the sharper 2017 Monochrome photograph remains the detail view. The common footprint is smaller than Monochrome coverage, and small color fringes can remain at sharp relief.
- **Monochrome:** a grayscale visualization across these bandpasses, not a uniform-band albedo product. Frame N1863267232_1 draws strips along the northern edge of the map, and N1656997950_1 draws a dark crescent in the south. Limiting incidence and emission to 70° cut coverage from 39.3% to 29.4% and kept the strips, so the dataset keeps its 80° incidence and 78° emission limits.
- **Elevation and gaps:** includes the broad irregular figure, not local altitude above a geoid. Published regional radius uncertainty is 0.2–0.7 km. Small crater morphology is not reliably represented. Missing samples remain gray grid.
- **Orbit:** the model is fitted only to 2005–2018; the 2026 scene extrapolates that fit and has no validated current-epoch position accuracy. The display uses an approximate Saturn-equatorial pole and an arbitrary meridian.
