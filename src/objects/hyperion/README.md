# Hyperion

Hyperion is shown on Thomas's shape model with a Cassini ISS clear-filter
photograph map, a regional false-color map from three filters, and elevation.

## Sources

- **False color** combines original Cassini ISS IR3, IR1 and UV3 observations from September 26, 2005, displayed as red, green and blue. Both red and green display channels are infrared; this is false color. Fifteen FULL-resolution CISSCAL 4.0beta products cover five neighboring pointings at about 159–208 m per detector pixel near the centre.
- **Monochrome** uses 11 clear-filter Cassini ISS observations, calibrated to I/F by CISSCAL 4.0beta and distributed by the [PDS Ring-Moon Systems Node](https://pds-rings.seti.org/cassini/iss/access.html), plus the close clear observation `N1506391424_2_CALIB`.
- The [PDS Saturn Small Moon Shape Models release](https://sbn.psi.edu/pds/resource/saturnsatshapes.html) provides Thomas's Hyperion model: 14,636 vertices and 29,268 triangular plates. The release is credited to Thomas, Joseph and Ansty (2018), DOI [10.26033/ewy3-jy61](https://doi.org/10.26033/ewy3-jy61).
- **Elevation** is radial height above a 135 km reference sphere, sampled from the released shape.
- Cassini NAC's focal length and pixel pitch come from the pinned [NAIF instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti).
- **Named features:** the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Hyperion (public domain per its FGDC metadata), pinned under `source/features/`.
- **Feature notes:** 1 caption note is the lead summary of its English Wikipedia article (CC BY-SA 4.0), pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia.
- Facts and context follow [NASA's Hyperion overview](https://science.nasa.gov/saturn/moons/hyperion/) and the vendored JPL physical/orbital data.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

Frames are projected through the measured shape, using the camera geometry in
Table 1 of the [Hyperion model documentation](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/hyperion_document.pdf).
Preparation converts west longitude to east longitude. The calibrated files
carry a 4096-byte VICAR label and a 4096-byte telemetry header, so float pixels
start at byte 8192. A bounded Lunar-Lambert disk normalization and overlap
exposure match reduce illumination differences before composition.

The filtered cameras are fitted with
[align-camera-bands.mts](../../../packages/bake/cli/align-camera-bands.mts)
from interior features through the full source mesh, then checked against a
separate clear exposure. Original I/F values are never sharpened or replaced.
A point is colored only where all three bands of a set qualify, and it keeps
the set with the finest resolution. One gain scales a set's three bands, so
their ratios stay. All channels share a 0–0.5 I/F range, followed by the
[shared IEC sRGB output transfer](../../../docs/color-preparation.md).

The mesh is simplified to 1,200 leaves. Against the released model on 2,048
radial rays, the mean radial difference is 371 m and the maximum sampled
difference 1.94 km. Named features are cast through the prepared hit mesh, so
every anchor sits on the shape model.

## Evidence

- **Filter registration:** all fifteen filtered cameras pass disjoint holdouts and checks against a separate clear exposure. Across the five pointings, the second-image held-out RMS is 0.242–0.933 detector pixels, with maximum held-out residual 1.689 pixels. The [camera fit and all correspondences](source/validation/filter-color-registration.json) and [second-image validation](source/validation/filter-color-independent.json) are kept. These are relative registration checks within the published shape frame.
- **False color coverage:** 2,271,627 valid samples out of 8,388,608 (27.1%), 2.50× the single-pointing coverage. These are equirectangular raster counts, not equal-area surface fractions.
- **Monochrome coverage:** the 4096 × 2048 map contains 6,836,406 valid samples (81.5% of equirectangular pixels).
- **Close frame:** B3 source-mesh reprojection gives held-out correlations 0.99169 and 0.99276. The close frame improves detail inside existing coverage rather than expanding it. Exact pins and checks are in [source/validation/n1506391424-registration.json](source/validation/n1506391424-registration.json).
- **Named features:** 5 IAU names are labelled on the hit mesh, nothing skipped.

The regional-frame camera checks and the alternate-row check lacked independent
feature patches and are not promoted. The [investigation ledger](investigations.json)
records them, the rejected control rows and SUM2 trials, and every examined source.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 11 | 2 | 6.96° | — | — | its other 11 frames | 9 of 11 | 0.00° | 0 of 11 | — | ×1.21 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **False color:** coverage is regional and the photographs retain acquisition shadows. The fifteen images span approximately 00:42–01:06 UTC from changing viewpoints; they are not a simultaneous true-color view or a composition map. The camera fit cannot improve the shape's sub-kilometre uncertainty. One UV3 fitting patch has a 4.88-pixel residual near a dark crater boundary, and the fifth pointing has only 7–8 second-image holdouts per filter.
- **Shape:** the well-observed 2005 sector has relative uncertainty below 1 km; relative errors on the opposite side reach 6 km. Small craters are not reliably represented in the shape itself.
- **Orientation:** Hyperion has no IAU-approved modern rotation solution. The model uses the spin frame observed during the 2005 flyby with an explicitly arbitrary display orientation and no simulated spin.
- **Named features:** outlines are not published nomenclature boundaries. The export publishes no diameters, so every name is labelled without a rim.
- **Elevation** spans −50 to +60 km and includes the moon's global elongation. It is not a stereo DEM or a gravity-referenced altitude.
- No public release of the newer 2025 mosaic and DEM was located; see the [investigation ledger](investigations.json).
- The atlas budget is 4,096 texels per face, which reduces display detail but not the source observations.
