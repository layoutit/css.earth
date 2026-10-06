# Amalthea

Amalthea is a standalone Jupiter moon shown on the Stooke shape model with a coarse Galileo monochrome view and an elevation view.

## Sources

- **Monochrome:** original Galileo SSI raw REDR images C0420626379 (1997-11-06, green), C0420652501 (1997-11-07, clear), C0512324200 (1999-08-12, clear), C0532888100 (2000-01-04, clear), with per-frame [OPUS metadata](https://opus.pds-rings.seti.org/opus/#/target=Amalthea).
- **Geometry / Elevation:** [Stooke Small Body Shape Models](https://sbn.psi.edu/pds/resource/stkshape.html), DOI 10.26033/yt84-5y91, `j5amalthea.tab`: west-positive, planetocentric 5° radius grid in kilometres. Original body origin is preserved.
- **Named features:** the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile, retrieved 2026-09-11, public domain. Four names carry the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), credited in the caption.
- Physical facts come from [NASA Amalthea](https://science.nasa.gov/jupiter/jupiter-moons/amalthea/). Orbit and pole come from the shared JPL astronomy package.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

The imagery uses detector pixels, not enlarged press crops. The closest image is about 2.4 km/pixel; the others range to 8.3 km/pixel. `source/preparation/terrestrial.json` owns the recipe. Raw 8-bit DN are decoded, sky is subtracted, and a bounded lunar-Lambert approximation (maximum 2× gain; incidence ≤72°, emission ≤75°) with overlap level matching reduces photographed shading. C0532888100 withholds pixels within 10 pixels of its background, twice its 5-pixel limb residual, to avoid a bright stripe of grazing light. Cast shadows and missing samples are never reconstructed; a neutral gray grid marks gaps.

Some archived labels have inconsistent Sun geometry, and OPUS centre and pole angles disagree with the raw raster. Camera roll therefore uses the PDS label NORTH_AZIMUTH+90°, following the [documented clockwise-from-image-right convention](https://pds.nasa.gov/datastandards/documents/dd/all/current/ch33s02.html). Only centre translation is fitted to illuminated shape boundaries.

Meshoptimizer simplifies the 5040-triangle source to 672 native raster triangles with a 1500 m error setting. Elevation is radial distance minus 83.5 km, displayed from −35 to +50 km. Named features are cast onto the shape model; rim circles and extent boxes are not published boundaries.

## Evidence

- Body Sun/observer coordinates and range use recomputed OPUS geometry, checked against phase and angular scale.
- Typical camera residuals are 0.6–2.1 pixels. The closest image is about 5 pixels off, because the coarse Voyager shape differs from Galileo's detailed limb.
- The wider inset keeps 71.0% of the surface covered and lowers the log spread between C0532888100 and C0512324200 from 0.158 to 0.131.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 4 | 2 | 20.10° | — | — | its other 4 frames | 0 of 4 | — | 2 of 4 | — | ×1.57 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Monochrome is a coarse observation and pointing aid, not a feature-registered photographic surface. It shows approximate normalized brightness, not measured albedo or visible color, and no flat-field or radiometric calibration is claimed.
- Registration is approximate, not a new photogrammetric solution.
- A saturated white strip remains near the south pole of the map, and its source frame is not identified. Limiting incidence and emission to 70° left the strip and cut coverage from 71.0% to 67.5%, so the 72° and 75° limits stay.
- The shape is Voyager-derived, with no Galileo refinement. It describes overall shape, not altimetry; unresolved or modelled regions and possibly exaggerated facets remain source limitations.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)
