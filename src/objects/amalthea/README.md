# Amalthea

## Sources

- **Monochrome:** original Galileo SSI raw REDR images C0420626379 (1997-11-06, green), C0420652501 (1997-11-07, clear), C0512324200 (1999-08-12, clear), C0532888100 (2000-01-04, clear).

- **Geometry / Elevation:** [Stooke Small Body Shape Models](https://sbn.psi.edu/pds/resource/stkshape.html), DOI 10.26033/yt84-5y91, `j5amalthea.tab`: west-positive, planetocentric 5° radius grid in kilometres. Original body origin is preserved.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

- Original .IMG/.LBL files and per-frame [OPUS metadata](https://opus.pds-rings.seti.org/opus/#/target=Amalthea) are pinned. Body Sun/observer coordinates and range use recomputed OPUS geometry, checked against phase and angular scale.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 4 | 2 | 20.10° | — | — | its other 4 frames | 0 of 4 | — | 2 of 4 | — | ×1.57 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Amalthea (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 4 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- The single green frame supplies a monochrome brightness view, not inferred visible color. No flat-field or radiometric calibration is claimed; this is a display of approximate normalized brightness, not measured albedo.

- This is approximate registration, not a new photogrammetric solution. The closest observation withholds five source pixels next to known sky/invalid boundaries to reflect that uncertainty; valid lower-resolution imagery supplies overlap.

- **Faithfulness status:** The Monochrome lens is retained as a coarse observation and pointing aid, not as a feature-registered photographic surface. A saturated white strip remains near the south pole of the map; its source frame is not identified. Limiting incidence and emission to 70° left the strip and cut coverage from 71.0% to 67.5%, so the lens keeps its 72° incidence and 75° emission limits. The existing shape and Elevation view remain the supported measured/model views.

- **Shape and elevation:** It describes overall shape, not altimetry or height above a geoid; unresolved/modelled regions and potentially exaggerated facets/depressions remain source limitations.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="amalthea-sources-and-presentation"></a>

Amalthea is a standalone Jupiter moon using the generic object package, shared lighting, world navigation and retained native PolyCSS triangles.

## Included

- Detector pixels, not enlarged press crops, supply the imagery. Closest image is about 2.4km/pixel; complementary aspects range to 8.3km/pixel.

- Meshoptimizer simplifies the 5040-triangle source to 800 native raster triangles with a 1500m library error setting. The source is Voyager-derived and corrects the historical 315°W bulge; it has no Galileo shape refinement. Elevation is radial distance minus 83.5 km, displayed from −35 to +50 km.

## Preparation

`source/preparation/terrestrial.json` owns the shared recipe. Source observations are original unsigned 8-bit detector DN, decoded after VICAR telemetry headers and row prefixes. Recorded empty/low-signal sky subtraction, a bounded lunar-Lambert approximation(maximum 2× gain; incidence ≤72°, emission ≤75°) and overlap level matching fitted where both frames see the surface within 70° of incidence and emission (the widest gain, 8.6, reconciles raw exposures through different filters) reduce photographed shading. C0532888100 withholds pixels within 10 pixels of its background (sky and unlit surface), twice its 5-pixel limb residual. At its former 5-pixel inset, the next ring of pixels lay where the coarse shape predicts grazing light: normalized, it measured 2.1 times the overlapping C0512324200 at the same points and drew a bright stripe. The wider inset keeps 71.0% of the surface covered (71.1% before) and lowers the log spread between those two frames from 0.158 to 0.131. Cast shadows and absent/unreliable samples are never reconstructed. A neutral gray grid marks gaps.

Some old archived raw labels have inconsistent Sun longitude/range. Conversely, OPUS image center and pole angles disagree with the original raw raster. Camera roll therefore uses the original PDS label NORTH_AZIMUTH+90°, following the [documented clockwise-from-image-right convention](https://pds.nasa.gov/datastandards/documents/dd/all/current/ch33s02.html); only center translation is fitted to illuminated source-shape boundaries. Typical residuals are 0.6–2.1 pixels; the closest image is about 5 pixels because the coarse Voyager shape differs from Galileo’s detailed limb.

Surface/pole atlases, native triangle maps, shared flood/directional lighting, thumbnails, scientific legend, small minimap and complete-silhouette context portrait derive from these same prepared sources. Flood displays the normalized source material without added directional attenuation; Shadows supplies the prepared Sun direction. Context gray areas preserve the known shape without inventing texture.

## Restoration and attribution

`source/preparation/acquisition.json` downloads exact archived camera frames, radius table and font. Authored geometry/source interpretation and the pinned context derivative are checked in; the latter is reproducible with the shared radial snapshot preparer. Physical facts:[NASA Amalthea](https://science.nasa.gov/jupiter/jupiter-moons/amalthea/). Orbit/pole come from the shared vendored JPL astronomy package.

</details>
