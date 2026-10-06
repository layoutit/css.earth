# Calypso

Saturn's small moon Calypso on the Thomas 2018 shape model, with a Cassini monochrome mosaic, a three-filter false-color
view and an elevation map.

## Sources

- **Monochrome:** 6 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying
  this moon’s PDS shape. Clear-filter images calibrated to I/F by CISSCAL.
- **False color:** Cassini ISS NAC red, green and BL1 photographs, encoded as red, green and blue after each frame is
  projected with its released PDS shape-camera record. This is false color, not natural color or a calibrated albedo
  map.
- **Elevation:** radial height above a 10.7 km reference sphere from the same measured shape.
- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61).

The exact observations and source URLs are in [source/manifest.json](source/manifest.json) and
[source/preparation/acquisition.json](source/preparation/acquisition.json). Source selections, alternatives and failed
trials are in the [investigation ledger](investigations.json).

## Processing

Photographs are projected with the release's camera records, not fitted by eye. The NAC pixel angle is 12 µm /
2003.44 mm from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti).

Preparation applies a bounded Lunar-Lambert illumination correction (maximum gain 2.5), source-mesh visibility and
cast-shadow rejection, and overlap level matching (widest gain 1.59). Samples beyond 70° emission are withheld.
Edge-connected sky below 0.003 I/F is excluded; isolated dark features are kept. Monochrome is displayed linearly over
0–1.13 I/F, the 99.5th percentile. False color colors a point only where all three bands qualify, uses the same range
for all channels, then applies one final sRGB transfer.

The shape is simplified to 176 native PolyCSS leaves (maximum estimated simplifier error 400 m). The shaded-relief
palette shows model slopes, not invented small craters. The initial view looks toward 305.55°E, -8.67°N.

## Evidence

- On the fixed 2,048 × 1,024 preparation grid, Monochrome covers 740,795 cells and False color 347,888. These are grid
  counts, not surface-area percentages.
- The views were inspected in Chrome at DPR 1 and 2, with Shadows off and on, dragging, and a 390-pixel mobile selector.
- A trial with an additional color sequence gained roughly 0.5 percentage points of coverage and was not adopted; see
  the [investigation ledger](investigations.json).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 6 | 0 | — | — | — | its other 6 frames | 3 of 6 | 0.00° | 1 of 6 | — | ×1.01, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **Elevation:** includes the broad irregular figure; it is not altitude above a geoid. Published regional radius
  uncertainty is 0.2–1.4 km. Small crater morphology is not reliably represented.
- **Monochrome:** illumination correction does not recover unobserved or shadowed terrain, and resolution varies with
  the source views. This is a visualization mosaic, not a global albedo measurement. The distant N1506184171_1 view
  supplies the far side; beyond 70° emission its pixels would smear into long strips, so those samples are withheld and
  Monochrome covers 41.5% of the surface instead of 51.8%.
- **False color:** blue was captured almost nine minutes before red, at a phase angle of 43 degrees versus 33 degrees.
  Hue can reflect changing illumination as well as filter response and does not establish composition. A fixed-camera
  diagnostic did not find the six independent feature patches needed to validate registration on this small, smooth
  target.
- The IAU secular rotation in [source/preparation/rotation.json](source/preparation/rotation.json) is an approximate
  display orientation, not the Cassini libration model used to control the source shape.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
