# Helene

Helene, a small Trojan moon of Saturn, shows Cassini photographs, false colour and elevation on its measured shape.

## Sources

- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61). The plate table and camera document are kept under `source/shape`.
- **Monochrome:** 13 calibrated Cassini ISS NAC clear-filter photographs, calibrated to I/F by CISSCAL and projected with the camera records that accompany the PDS shape. Frames `N1675163339_1` and `N1519536732_1` add views near 87–96°W at about 166 m and 406 m per pixel.
- **False color:** two Cassini ISS NAC IR3/IR1/UV3 triplets from the June 18, 2011 encounter, with infrared and ultraviolet shown as RGB. This is scientific false colour, not natural colour or measured albedo.
- **Elevation:** radial height above an 18 km reference sphere from the same shape.

Exact observations and restoration pins are in [source/manifest.json](source/manifest.json) and [source/preparation/acquisition.json](source/preparation/acquisition.json). Source selections and failed trials are in the [investigation ledger](investigations.json). See [NOTICE.md](NOTICE.md) for credits.

## Processing

The shared controlled-shape camera preparer uses the release's perspective, sub-spacecraft and sub-solar coordinates, north azimuth and image-centre pixels. The NAC pixel angle is 12 µm / 2003.44 mm from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). For the second colour sequence, detector translation and roll are fitted to image features on the fixed shape, checked on held-out patches ([reference fit](source/validation/close-encounters-reference.json), [filter fits](source/validation/close-encounters-filters.json)).

Preparation applies bounded lunar-Lambert illumination correction (maximum gain 2.5), visibility and cast-shadow rejection, and overlap level matching where both frames see the surface within 70° of incidence and emission. Monochrome is displayed linearly over 0–1.26 I/F, the 99.5th percentile. Colour keeps the finest set whose three bands all qualify, on one common 0–1.05 range with the sRGB transfer applied once and no per-channel stretch or white balance.

The shape is simplified to 800 PolyCSS leaves (maximum estimated simplifier error 300 m). Textures use 2,048 × 1,024 intermediate maps in WebP quality 94. Elevation uses the shared shaded-relief palette, which shows model slopes. The initial view looks toward 177.68°E, -3.98°N.

## Evidence

Monochrome covers 74.4% of the display mesh, measured with 64 area samples per triangle. All seven colour registration checks pass the held-out criteria (RMS ≤1 pixel, maximum ≤2 pixels): RMS 0.27–0.86 pixels, maximum 1.51 pixels. The reference fit includes an 8.4-pixel training outlier, which the report keeps visible. The orbit is compared against six JPL vector samples; the differences are fit residuals, not bounded accuracy.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 13 | 0 | — | — | — | its other 13 frames | 7 of 13 | 0.00° | 13 of 13, 3.50° | — | ×1.03, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **Monochrome:** frames N1646319036_1 and N1646319549_1, at 25–27° phase, overlap only each other, so no level joins them to the rest. Below 40° of incidence they read a median 0.77–0.78 against 0.48–0.51 elsewhere, and the regions they supply, about 35% of displayed area, appear about 1.65 times brighter. Illumination correction does not recover unobserved or shadowed terrain. Missing samples stay gray, and resolution varies with the source views. This is a visualization mosaic, not a new global albedo measurement.
- **False color:** only complete three-filter footprints contribute. Different filter times and illumination still matter, and colours alone do not identify composition. The feature checks do not improve the published 150–300 m shape uncertainty or establish absolute geolocation.
- **Elevation:** includes the broad irregular figure; it is not altitude above a geoid. Published regional radius uncertainty is 0.15–0.3 km. Small crater morphology is not reliably represented.
- The IAU secular rotation in [source/preparation/rotation.json](source/preparation/rotation.json) is an approximate display orientation, not the Cassini libration model used to control the shape.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
