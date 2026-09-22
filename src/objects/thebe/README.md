# Thebe

## Sources

- **Monochrome:** original Galileo SSI clear-filter REDR frames C0368591600R, C0401759200R, C0401787200R, C0420691700R and C0532888400R.

- **Elevation:** Philip Stooke’s [PDS radius table](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/j14thebe.tab), DOI [10.26033/yt84-5y91](https://doi.org/10.26033/yt84-5y91). Heights are radius minus a 49.3 km reference sphere, displayed over −15 to +15 km.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

- Original `.IMG` and detached `.LBL` pairs are pinned in [source/manifest.json](source/manifest.json) and restored by [source/preparation/acquisition.json](source/preparation/acquisition.json).

- Earlier original labels have stale Sun longitude/range values inconsistent with their phase angles, so these quantities come from the recalculated OPUS geometry.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 4 | 2 | 2.24° | — | — | its other 4 frames | 0 of 4 | — | 1 of 4 | — | ×1.09 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Thebe (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

- The closest frame is 1.96 km/pixel (about 50–60 pixels across Thebe); other contributors are 5–9 km/pixel. The source is visibly soft/noisy and contains spacecraft compression artifacts.

- **Elevation:** This is the broad shape inferred from Galileo images, including modeled unseen terrain, not a local altimetry survey. The Stooke source itself may exaggerate depressions; its scientific uncertainty exceeds a rendering approximation's numerical precision.

- **Photometry:** The original data are 8-bit **digital numbers**, not calibrated radiance or I/F. These operations are empirical display correction, not calibrated albedo recovery; detector flat fields, exposure/gain calibration and a measured phase function are absent.

- The gray grid marks absent observation coverage, rather than treating all dark pixels as missing. A cast shadow cannot be inverted to recover terrain.

- **Faithfulness status:** The Monochrome lens is retained as a coarse observation, but its two-dimensional center translation and illuminated-outline fit do not establish surface-feature registration. Elevation remains the supported shape-derived view.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="thebe-sources-and-preparation"></a>

## Selected presentation

- Increasing atlas size does not add observations.

- Hillshade is derived from that same radius grid; the legend is unshaded.

The archived 5° grid uses planetocentric latitude, **west-positive longitude**, and radii in kilometres. The source coordinate origin is retained. The shared preparation welds poles/seams and simplifies 5,040 source triangles to 700 native PolyCSS raster triangles, with a 1.2 km meshoptimizer error allowance.

## Observation geometry and photographed shading

`source/geometry/registration.json` records OPUS target-centered observer and Sun coordinates, distance and native pixel scale. Galileo SSI azimuth increases clockwise from image right ([SSI archive specification](https://pds.nasa.gov/data/go-j_jsa-ssi-2-redr-v1.0/go_0018/document/cdvolsis.pdf)); camera north-from-up is `(NORTH_AZIMUTH + 90) % 360`. OPUS center and pole clock values do not align with the original REDR rasters and are not used. Only two-dimensional camera-center translation is fitted to the observed illuminated shape outline. Shape radii, scale, latitude/longitude and camera roll are unchanged.

Shared preparation skips VICAR telemetry and per-line prefixes, subtracts the recorded constant sky-background estimate, and applies bounded lunar-Lambert illumination normalization (weight 0.5, maximum gain 1.75, incidence limit 75°, emission limit 70°). At a 2.5 cap, the 5,606 samples of C0532888400 normalized by more than 1.75 held 627 of the view's 629 saturated display samples, a white patch. The 1.75 cap withholds them and 3,617 more from C0401759200 and C0420691700; other frames fill most of those points, and area coverage stays at 65.1% (65.2% before). Samples beyond 70° of emission smeared single pixels into feathered strips along the edge of C0532888400, as on Calypso; limiting emission to 70° removes them, and area coverage is 56.0%. Overlap level matching, fitted where both frames see the surface within 70° of incidence and emission (widest gain 1.69), reduces brightness jumps while keeping the original image detail.

Source-aware visibility and shadow tests withhold geometrically unreliable or hidden samples. Normalized coverage is reused by the surface, poles, minimap and prepared context portrait. The shared flood lighting and directional Shadows remain enabled; no photographed terminator is substituted for application lighting.

## Preparation and credits

The shared authored preparation consumes `source/preparation/terrestrial.json`; no private runtime or preparation controller exists. Font and background credits are retained in `NOTICE.md` and source records.

</details>
