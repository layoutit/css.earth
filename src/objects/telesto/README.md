# Telesto

## Sources

- **Monochrome:** 6 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying this moon’s PDS shape. Clear-filter images calibrated to I/F by CISSCAL.

- **False color:** Cassini ISS NAC IR3, green and UV3 photographs, encoded as red, green and blue after each frame is projected with its released PDS shape-camera record. This is false color, not natural color or a calibrated albedo map.

- **Elevation:** radial height above a 12.35 km reference sphere from the same measured shape.

- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61).

## Evidence

- The exact observations, source URLs and restoration pins are in [source/manifest.json](source/manifest.json) and [source/preparation/acquisition.json](source/preparation/acquisition.json). The simplified surface remains closed and outward wound.

- [Source/package qualification](evidence/close-encounters/qualification.json) verifies every delivered asset and source input and preserves the geometry recipe and retained scene geometry from main (ebd16155a). The fixed 2,048 × 1,024 preparation grid accepts 1,268,390 → 1,275,448 Monochrome cells and 137,013 False color cells. These are preparation-grid counts, not physical surface-area percentages.

- [Delivery](evidence/close-encounters/delivery.json) verifies the changed immutable HTTPS assets by length and SHA-256. [Elevation reproduction](evidence/close-encounters/elevation-reproduction.json) confirms that the current unchanged main preparer reproduces the existing elevation dataset; the refreshed shadow bank is unrelated to the added photographs.

- [Browser capture](evidence/close-encounters/capture.json): Chrome 152, DPR 1/2, Shadows off/on, drag with retained DOM, and a 390-pixel mobile selector passed. Inspect the [False color product view](evidence/close-encounters/product.png), [rotated lighting](evidence/close-encounters/oblique-shadows-dpr1.png), [mobile view](evidence/close-encounters/mobile.png) and [Monochrome close-up](evidence/close-encounters/monochrome.png). These captures identify the uncommitted moon changes over ebd16155a by recipe, runtime and served-image hashes. The later main merge 3b40e0723 leaves these inputs and the shared browser code unchanged; the [Monochrome capture](evidence/close-encounters/monochrome.json) also mounts successfully after that merge.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 6 | 1 | 2.00° | — | — | its other 6 frames | 0 of 6 | — | 4 of 6, -0.50° | — | ×1.03, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **Elevation:** Includes the broad irregular figure; it is not local altitude above a geoid. Published regional radius uncertainty is 0.2–0.35 km. Small crater morphology is not reliably represented.

- **Monochrome:** Illumination correction does not recover unobserved or truly shadowed terrain. Missing samples remain gray grid. Resolution varies with the source views; this is a visualization mosaic, not a new scientific global albedo measurement.

- **False color:** The three source frames have different times and camera positions. The filters span 14 minutes and phase angles of 66–78 degrees. Hue can reflect changing illumination as well as filter response; it does not establish composition. Only their common reliable footprint may carry color; gray grid and cast-shadow exclusions remain. A fixed-camera diagnostic did not yield the six independent feature patches needed to refine or independently validate these small, smooth targets. That result does not remove the released PDS camera-table registration and no camera was fitted or tuned here.

  Green edging is visible near parts of the footprint. The three-band product does not separate illumination differences from residual camera/shape alignment errors at these edges; it must not be interpreted as a compositional boundary.

- The IAU secular rotation in [source/preparation/rotation.json](source/preparation/rotation.json) is an approximate display orientation. It is not the binary Cassini libration model used to control the source shape; the archived camera records independently own photograph registration.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="telesto-source-and-interpretation"></a>

## Selected datasets

- The shared shaded-relief palette shows model slopes, not invented small craters.

- Original plate table and camera document are retained under `source/shape`. Kilometres, zero-based plate indices, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north.

## Preparation and display

The shared controlled-shape camera preparer uses source perspective, west-positive sub-spacecraft and sub-solar coordinates, north azimuth and image-center pixels. Camera registration is taken from the release, not fitted by eye. The NAC pixel angle is 12 µm / 2003.44 mm from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). The attached VICAR label owns pixel offset and record size; these calibrated products retain a telemetry record before the raster.

Preparation applies bounded Lunar-Lambert illumination correction (maximum gain 2.5), source-mesh visibility and cast-shadow rejection, and overlap level matching fitted where both frames see the surface within 70° of incidence and emission (widest gain 3.00). Samples beyond 70° of incidence or emission put dark spikes along frame seams and stepped bands at the south: N1630076968_1 reads a median 0.565 below 60° of incidence but 0.33 above 70°. Both angles are limited to 70°, where the spikes and bands are gone, and area coverage is 54.3% (70.0% before). Edge-connected sky below 0.003 I/F is excluded before interpolation; isolated dark features are retained. Monochrome corrected values are displayed linearly over 0–1.2 I/F, the 99.5th percentile of displayed samples. False color keeps floating-point I/F in its band set, colors a point only where all three bands qualify, uses the same range for all channels, then applies one final sRGB display transfer. Source files remain unchanged.

The original connected shape is simplified before atlas baking to 600 native PolyCSS `u` leaves (maximum estimated simplifier error 350 m), under the 2,000-leaf budget. Textures use 2,048 × 1,024 intermediate maps and prepared triangle atlases; WebP quality 94 is a delivery choice, not added source resolution. Flood and directional lighting use the same shared mesh-normal preparation and Shadows control. No detached spherical overlay, atmosphere, ring mesh or private controller is added.

Navigation portraits and small dedicated minimaps are derived from the prepared surface. Initial view looks toward 67.17°E, -3.84°N, transformed through the ecliptic presentation basis and CSS X/Y transport.

## Dataset survey

Recorded source selections, alternatives and failed trials are in the [investigation ledger](investigations.json).

## Orbit and orientation limits

The shared astronomy package owns Saturn-relative position, scale and orbit. Its compact precessing ellipse is compared against six independent JPL vector samples; the reported differences are measured fit residuals, not bounded accuracy. Source URLs and intervals travel with the generated orbit and fixtures.

## Source restoration

The shared acquisition plan restores the pinned scientific inputs for preparation. Runtime users do not download the source plate models or floating-point camera frames. See NOTICE.md for credits.

</details>
