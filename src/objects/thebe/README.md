# Thebe

Thebe is shown as a coarse Galileo monochrome mosaic and an elevation map on Philip Stooke's shape model.

## Sources

- **Monochrome:** original Galileo SSI clear-filter REDR frames C0368591600R, C0401759200R, C0401787200R, C0420691700R and C0532888400R. Original `.IMG` and detached `.LBL` pairs are pinned in [source/manifest.json](source/manifest.json) and restored by [source/preparation/acquisition.json](source/preparation/acquisition.json).

- **Elevation:** Philip Stooke's [PDS radius table](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/j14thebe.tab), DOI [10.26033/yt84-5y91](https://doi.org/10.26033/yt84-5y91). Heights are radius minus a 49.3 km reference sphere, displayed over −15 to +15 km.

- **Named features:** the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Thebe (public domain per its FGDC metadata), pinned under `source/features/`.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

The archived 5° grid uses planetocentric latitude, west-positive longitude, and radii in kilometres. Shared preparation simplifies its 5,040 source triangles to 268 PolyCSS raster triangles, with a 1.2 km error allowance. Hillshade is derived from the same radius grid.

`source/geometry/registration.json` records the OPUS observer and Sun geometry for each frame. Earlier original labels have stale Sun longitude/range values inconsistent with their phase angles, so these quantities come from the recalculated OPUS geometry. Only a two-dimensional camera-centre translation is fitted to the observed illuminated outline ([SSI archive specification](https://pds.nasa.gov/data/go-j_jsa-ssi-2-redr-v1.0/go_0018/document/cdvolsis.pdf)).

Preparation subtracts the recorded sky background and applies bounded lunar-Lambert illumination normalization (weight 0.5, maximum gain 1.75, incidence limit 75°, emission limit 70°). The gain cap removes a saturated white patch, and the emission limit removes feathered strips along a frame edge. Area coverage is 56.0%. Overlap level matching reduces brightness jumps while keeping the original image detail. Hidden and shadowed samples are withheld.

Gazetteer anchors are cast onto the prepared shape, not a reference sphere. Craters and faculae trace a rim circle, other types their published extent box.

## Evidence

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 4 | 2 | 2.24° | — | — | its other 4 frames | 0 of 4 | — | 1 of 4 | — | ×1.09 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The closest frame is 1.96 km/pixel (about 50–60 pixels across Thebe); other contributors are 5–9 km/pixel. The source is visibly soft/noisy and contains spacecraft compression artifacts.
- **Elevation:** This is the broad shape inferred from Galileo images, including modeled unseen terrain, not a local altimetry survey. The Stooke source itself may exaggerate depressions.
- **Photometry:** The original data are 8-bit digital numbers, not calibrated radiance or I/F. These operations are empirical display correction, not calibrated albedo recovery; detector flat fields, exposure/gain calibration and a measured phase function are absent.
- The gray grid marks absent observation coverage, rather than treating all dark pixels as missing. A cast shadow cannot be inverted to recover terrain.
- **Faithfulness status:** The Monochrome dataset is retained as a coarse observation, but its two-dimensional center translation and illuminated-outline fit do not establish surface-feature registration. Elevation remains the supported shape-derived view.
- Feature outlines are not published nomenclature boundaries.
