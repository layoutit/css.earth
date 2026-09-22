# Helene

## Sources

**Additional Monochrome coverage:** clear-filter frames `N1675163339_1` and `N1519536732_1` add views near 87–96°W, using the camera rows in the same PDS shape release. Their nominal central footprints are about 166 m and 406 m per pixel. The existing close views retain priority wherever their samples qualify.

- **Monochrome:** 13 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying this moon’s PDS shape. Clear-filter images calibrated to I/F by CISSCAL.

- **False color:** two Cassini ISS NAC IR3/IR1/UV3 triplets from the June 18, 2011 encounter. Infrared and ultraviolet are encoded as RGB after projection onto the same published shape. This is a scientific false-color display, not natural color or measured albedo.

- **Elevation:** radial height above an 18 km reference sphere from the same measured shape.

- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61).

## Evidence

The [package check](evidence/cassini-coverage/package-check.json) verifies source/output pins and exact retention of scene and sky geometry against `fc4dfc18e` (main including #187). The [cold installation](evidence/cassini-coverage/delivery.json) downloaded all 38 files for this body from immutable URLs into an empty destination; no source preparation was needed. Nine source-manifest and photographic-recipe tests passed. Shared ownership diagnostics are unchanged from main; this is not a full-suite pass.

[Browser previews](evidence/cassini-coverage/browser.json) show the expanded Monochrome surface and oblique boundaries at DPR 1 on the earlier `e70004dbc` application with the same moon assets. They expose the coarse coverage and brightness seams described below. They are preliminary: the local preview used a different cached M2-9 bank, explicitly recorded in the capture metadata. Current-main application review still requires the six new nebula banks introduced by #187; DPR 2 and responsive checks remain pending.

Monochrome coverage rises from **65.4% to 74.4%** of the fixed display mesh in the shared equal-area measurement. The [display measurement](evidence/cassini-coverage/display-measurement.json) records the sampled brightness range. The [preparation record](evidence/cassini-coverage/refresh.json) pins the recipe, source observations and retained scene. Coverage uses 64 deterministic area samples per display triangle; it is not an image-grid pixel percentage.

<details>
<summary>Earlier evidence, at its recorded revisions</summary>

The following records describe the earlier surfaces. They are retained as historical evidence; the current coverage expansion is measured above. Geometry evidence still applies because the retained scene is unchanged.

- The exact observations, source URLs and restoration pins are in [source/manifest.json](source/manifest.json) and [source/preparation/acquisition.json](source/preparation/acquisition.json). The simplified surface remains closed and outward wound.

- [Source/package qualification](evidence/close-encounters/qualification.json) verifies every delivered asset and source input and preserves the geometry recipe and retained scene geometry from main (ebd16155a). The fixed 2,048 × 1,024 preparation grid accepts 1,066,236 → 1,067,659 Monochrome cells and 241,046 False color cells. These are preparation-grid counts, not physical surface-area percentages.

- [Delivery](evidence/close-encounters/delivery.json) verifies the changed immutable HTTPS assets by length and SHA-256. [Elevation reproduction](evidence/close-encounters/elevation-reproduction.json) confirms that the current unchanged main preparer reproduces the existing elevation dataset; the refreshed shadow bank is unrelated to the added photographs.

- [Browser capture](evidence/close-encounters/capture.json): Chrome 152, DPR 1/2, Shadows off/on, drag with retained DOM, and a 390-pixel mobile selector passed. Inspect the [False color product view](evidence/close-encounters/product.png), [rotated lighting](evidence/close-encounters/oblique-shadows-dpr1.png), [mobile view](evidence/close-encounters/mobile.png) and [Monochrome close-up](evidence/close-encounters/monochrome.png). The captured source, recipe and runtime hashes identify the uncommitted moon changes over ebd16155a; the later main merge 3b40e0723 changes Ryugu and its scientific-raster preparation, leaving these moon inputs and the shared browser code unchanged. The [Monochrome capture](evidence/close-encounters/monochrome.json) also mounts successfully after that merge.

</details>

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 13 | 0 | — | — | — | its other 13 frames | 7 of 13 | 0.00° | 13 of 13, 3.50° | — | ×1.03, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

**New coverage:** the overlap fit reaches 2.498, within the declared 2.5 budget. It does not connect the isolated bright pair to the other observations. The two bright frames still supply about 35% of displayed area; the existing illumination discontinuity remains. The linear 0–1.26 display range is retained.

- **Elevation:** Includes the broad irregular figure; it is not local altitude above a geoid. Published regional radius uncertainty is 0.15–0.3 km. Small crater morphology is not reliably represented.

- **Monochrome:** Illumination correction does not recover unobserved or truly shadowed terrain. Missing samples remain gray grid. Resolution varies with the source views; this is a visualization mosaic, not a new scientific global albedo measurement. Two frames, N1646319036_1 and N1646319549_1 at 25–27° phase, overlap no other frame, so no level joins them to the rest; the regions they supply, about 35% of displayed area, appear about 1.65 times brighter.

- **False color:** only complete three-filter footprints contribute. Different filter times and illumination remain relevant; colors alone do not identify composition. The relative feature checks do not improve the published 150–300 m shape uncertainty or establish independent absolute geolocation.

- The IAU secular rotation in [source/preparation/rotation.json](source/preparation/rotation.json) is an approximate display orientation. It is not the binary Cassini libration model used to control the source shape; the archived camera records independently own photograph registration.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="helene-source-and-interpretation"></a>

## Selected datasets

- The shared shaded-relief palette shows model slopes, not invented small craters.

- Original plate table and camera document are retained under `source/shape`. Kilometres, zero-based plate indices, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north.

## Preparation and display

The shared controlled-shape camera preparer uses source perspective, west-positive sub-spacecraft and sub-solar coordinates, north azimuth and image-center pixels. Clear-filter camera registration is taken from the release. For the second color sequence, detector translation and roll are fitted to source-image features on that fixed shape, with separate held-out patches; range, pointing direction and focal scale remain those of the release. The NAC pixel angle is 12 µm / 2003.44 mm from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). The attached VICAR label owns pixel offset and record size; these calibrated products retain a telemetry record before the raster.

Preparation applies bounded Lunar-Lambert illumination correction (maximum gain 2.5), source-mesh visibility and cast-shadow rejection, and overlap level matching fitted where both frames see the surface within 70° of incidence and emission (widest gain 2.498). Edge-connected sky below 0.003 I/F is excluded before interpolation; isolated dark features are retained. Monochrome corrected values are displayed linearly over 0–1.26 I/F, the 99.5th percentile of displayed samples. Color retains floating-point I/F in each band set; a point keeps the finest set whose three bands all qualify, and one gain scales a set’s three bands (1.30 between the two sets). It uses one common 0–1.05 range, then applies the shared IEC sRGB display transfer once. This is a display range, not a calibration of natural color; there is no independent channel stretch or white balance. Source files remain unchanged. Frames N1646319036_1 and N1646319549_1 overlap only each other (7,687 samples); they share no sample with the other eleven frames, so no overlap can set their level against the rest. Below 40° of incidence they read a median 0.77–0.78, against 0.48–0.51 in the other frames, which shows as a brightness step where the two groups meet.

The original connected shape is simplified before atlas baking to 800 native PolyCSS `u` leaves (maximum estimated simplifier error 300 m), under the 2,000-leaf budget. Textures use 2,048 × 1,024 intermediate maps and prepared triangle atlases; WebP quality 94 is a delivery choice, not added source resolution. Flood and directional lighting use the same shared mesh-normal preparation and Shadows control. No detached spherical overlay, atmosphere, ring mesh or private controller is added.

Navigation portraits and small dedicated minimaps are derived from the prepared surface. Initial view looks toward 177.68°E, -3.98°N, transformed through the ecliptic presentation basis and CSS X/Y transport.

## Dataset survey

Recorded source selections, alternatives and failed trials are in the [investigation ledger](investigations.json).

**Filter registration:** portable [reference](source/preparation/close-encounters-reference.json) and [filter](source/preparation/close-encounters-filters.json) jobs retain the input cameras; their original [reference fit](source/validation/close-encounters-reference.json) and [filter fits](source/validation/close-encounters-filters.json) retain all accepted controls and residuals. The preparer rechecks the final cameras without refitting. All seven checks pass the existing held-out RMS ≤1 pixel and maximum ≤2 pixels criteria: RMS 0.27–0.86 pixels, maximum 1.51 pixels. The reference fit includes an 8.4-pixel training outlier; its independently held-out residuals pass, and the report keeps that outlier visible.

## Orbit and orientation limits

The shared astronomy package owns Saturn-relative position, scale and orbit. Its compact precessing ellipse is compared against six independent JPL vector samples; the reported differences are measured fit residuals, not bounded accuracy. Source URLs and intervals travel with the generated orbit and fixtures.

## Source restoration

The shared acquisition plan restores the pinned scientific inputs for preparation. Runtime users do not download the source plate models or floating-point camera frames. See NOTICE.md for credits.

</details>
