# Telesto

Telesto is shown on its measured PDS shape with a Cassini monochrome mosaic, a
three-filter false-color view and elevation.

## Sources

- **Monochrome:** 6 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying this moon’s PDS shape. Clear-filter images calibrated to I/F by CISSCAL.
- **False color:** Cassini ISS NAC IR3, green and UV3 photographs, encoded as red, green and blue after each frame is projected with its released PDS shape-camera record. This is false color, not natural color or a calibrated albedo map.
- **Elevation:** radial height above a 12.35 km reference sphere from the same measured shape.
- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61).
- The NAC pixel angle comes from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti).

The exact observations, source URLs and restoration pins are in
[source/manifest.json](source/manifest.json) and
[source/preparation/acquisition.json](source/preparation/acquisition.json).
Source selections, alternatives and failed trials are in the
[investigation ledger](investigations.json).

## Processing

The shared controlled-shape camera preparer takes each camera from the release,
not fitted by eye. Preparation applies bounded Lunar-Lambert illumination
correction (maximum gain 2.5), cast-shadow rejection and overlap level matching.
Incidence and emission are limited to 70°: samples beyond that put dark spikes
along frame seams and stepped bands at the south. Monochrome is displayed
linearly over 0–1.2 I/F. False color colors a point only where all three bands
qualify, uses one range for all channels, then applies one sRGB display transfer.
The shape is simplified to 600 native PolyCSS leaves (maximum estimated
simplifier error 350 m).

## Evidence

- Monochrome area coverage is 54.3% with the 70° limits (70.0% before them).
- The 2,048 × 1,024 preparation grid accepts 1,275,448 Monochrome cells and 137,013 False color cells. These are grid counts, not physical surface-area percentages.
- The simplified surface is closed and outward wound.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 6 | 1 | 2.00° | — | — | its other 6 frames | 0 of 6 | — | 4 of 6, -0.50° | — | ×1.03, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **Elevation** includes the broad irregular figure; it is not local altitude above a geoid. Published regional radius uncertainty is 0.2–0.35 km. Small crater morphology is not reliably represented.
- **Monochrome:** illumination correction does not recover unobserved or truly shadowed terrain, and missing samples remain gray grid. This is a visualization mosaic, not a new scientific global albedo measurement.
- **False color:** the three frames span 14 minutes and phase angles of 66–78 degrees, so hue can reflect changing illumination as well as filter response; it does not establish composition. A fixed-camera diagnostic did not yield the six independent feature patches needed to refine or validate the cameras, and no camera was fitted here.
- Green edging is visible near parts of the false-color footprint. It must not be read as a compositional boundary.
- The IAU secular rotation in [source/preparation/rotation.json](source/preparation/rotation.json) is an approximate display orientation, not the Cassini libration model used to control the source shape.
- The compact orbit is compared against six JPL vector samples; the differences are fit residuals, not bounded accuracy.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="telesto-source-and-interpretation"></a>
