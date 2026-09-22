# Tethys

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| View | Source and interpretation |
| --- | --- |
| Monochrome | [USGS Cassini mosaic](https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m), 2012, about 293 m/pixel. Exactly zero marks gaps; other dark pixels remain observed. |
| Enhanced color | [PIA18439](https://www.jpl.nasa.gov/images/pia18439-color-maps-of-tethys-2014/), 2014. Ultraviolet/infrared colors extend beyond human vision; producer calibration, registration and photometric correction are retained. |
| ISS photograph | Cassini ISS narrow-angle frame [N1807429484](source/observations/N1807429484_1_CALIB.LBL), 11 April 2015, clear filters, about 1.1 km/pixel from 190,000 km. CISSCAL-calibrated I/F from the [PDS Ring-Moon Systems Node](https://opus.pds-rings.seti.org/opus/#/detail/co-iss-n1807429484). Camera from Cassini SPICE kernels in the shared [Cassini kernel bank](../../spice/cassini/manifest.json), refined to the limb. Empirical Lommel-Seeliger brightness; not measured albedo. |
| Shape and Elevation | [Weirich et al. 2025 SPC V1.0](https://doi.org/10.26033/hpv0-eh61); Elevation is radius minus 531 km, colored over −12.5 to +12.5 km. |
| Relative albedo | The same SPC release’s dimensionless brightness field, less validated than topography; not geometric albedo or calibrated reflectance. Its 0.5–1.5 display clips above 1.5. |
| Infrared and Ice absorption | [Nantes Cassini VIMS archive](https://vims.univ-nantes.fr/), 2007–2015. All 9 selected observations supply near-2.02 µm continuum-relative absorption; 7 supply near-2.02/1.59/1.28 µm false-color infrared after clipping exclusions. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/TETHYS/target) Tethys centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 11520 × 5760 | 11.13 → 15.20 MB |
| enhanced | 13467 × 6734 | 13.56 → 19.02 MB |

Each atlas remains 2048 × 16000 pixels, with 2000 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/tethys/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

The [B9 qualification report](https://github.com/layoutit/cssEarth/blob/8666462797772dc50bbebecd8618014f5e7bd16c/docs/moons/b9-cassini-ice-surfaces/QUALIFICATION.md) records exact source-map replay and selected package and interaction checks.

The [Tethys visual review](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/VISUAL-REVIEW-TETHYS.md#final-main-integration-review) covers six serial captures of the normal, infrared and ice views at DPR 1 and 2, reviewed on 2026-09-10. [Reports and images](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/evidence/README.md) identify capture base `80e19c51349f713c9a9a64b8ef1cbb78917f0fc7` plus the then-modified source, prepared and served-file pins. The same qualification report records failed broader suites and an incomplete full build.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `iss` | 1 | 0 | — | — | — | the `normal` map | 1 of 1 | — | 1 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The ISS photograph is one frame with an empirical Lommel-Seeliger law, and its reconstructed pointing needed a 9.5 px limb correction.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Tethys (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 6 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- **VIMS coverage and registration:** Infrared covers about 14.8% and Ice absorption about 22.6% of reference-sphere solid angle, not physical mesh area. Native gaps remain missing. The separate USGS brightness comparison is non-diagnostic for absolute alignment; no resolved Odysseus-center registration is claimed.
- VIMS has no photometric correction or cross-observation level matching. Illumination, viewing angle, grain size, noise and archive filtering affect the signal; neither view measures ice abundance. Infrared bilinear/WebP packing can soften mask edges, and directional lighting exposes facets in the fixed terrain.
- Photographic seams, coarse inserts, residual shading and local control-network differences remain. Enhanced-color hemisphere differences can reflect real dust/radiation alteration. The display does not inpaint gaps, repeat polar data or synthesize color.
- The approximately 1.5 km SPC map spacing and the source's one-to-two-grid-spacing error estimate do not provide independently measured per-cell uncertainty. SPC sigma measures internal maplet agreement, not absolute height uncertainty; Tethys used uncalibrated ISS images. Numeric height datums, photographic projection radii and simplified geometry remain separate.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="tethys-sources-and-preparation"></a>
<a id="photographic-lenses"></a>
<a id="elevation"></a>
<a id="geometry-delivery-and-scope"></a>
<a id="b2-source-shape-and-relative-albedo"></a>

<details>
<summary>Methods and source notes</summary>

**Photographic lenses**

Odysseus lies near 30° N, 230° E; [Ithaca Chasma](https://planetarynames.wr.usgs.gov/Feature/2751) is centered near 14° S, 353.9° E. These provide independent checks of orientation and longitude registration. These photographic landmarks do not independently register the VIMS maps.

Native detail varies across both mosaics. Published image seams, coarse inserts and residual photographed shading remain. In particular, enhanced-color hemisphere differences can represent real surface alteration by dust and radiation, and are not removed as artificial shadows. No inpainting, polar repetition or color synthesis is applied. Different source control networks can leave local registration differences.

**Elevation**

The global model is supplied as three grids: a 2222 × 679 equirectangular map spanning 55° S–55° N and two 444 × 444 polar stereographic maps. Preparation samples each original geotransform and uses the polar grids at higher latitudes. It honors actual raster bounds and no-data values; the equatorial map is never stretched over the poles and gaps are not extrapolated. The polar rectangles fall slightly short of their nominal 55° limit near cardinal longitudes, leaving narrow source gaps that use the shared gray grid.

The source model spacing is about 1.5 km. The product description’s one-to-two-grid-spacing error estimate is extrapolated from simulation experience; it is not an independent per-cell uncertainty measurement for Tethys. A larger prepared texture adds no measured terrain detail. Elevation colors include broad departures from the reference sphere; rendered geometry follows the simplified source mesh.

**Geometry, delivery and scope**

The astronomy package provides the Saturn-relative orbit and IAU orientation. The old spherical display reference is retained only as the package’s scale normalization; the native model now supplies vertex positions. Numeric height datums and factsheet mean radii remain independent quantities. [NASA](https://science.nasa.gov/saturn/moons/tethys/) describes a mildly nonspherical body; the newly selected source model supplies a finite-resolution approximation to silhouette and topography.

Photographic and SPC map preparation retains the shared 8192 × 4096 latitude-band layout and 1024-pixel pole products. The normal and enhanced photographic atlases sample their pinned original grids directly with a 2 × 2 footprint into the fixed per-triangle layout and use WebP quality 95. SPC products and latitude bands retain their existing preparation and encoding. Sources remain distinct from the prepared files that reach runtime. No visible atmosphere or cutaway is added.

Pinned files, URLs and hashes are in `source/manifest.json`; acquisition and preparation use the shared authored-object pipeline.

**B2 source shape and relative albedo**

The native global Q128 OBJ is 98,306 vertices and 196,608 triangles in kilometres, north along +Z and longitude zero along +X. Exact source topology is retained before simplification. Preparation uses the measured candidate of 2,000 faces with regularize:false, under a 5,310 m display approximation ceiling (1% of the model reference radius). This is a display approximation budget, not scientific uncertainty. The closed candidate has Euler characteristic 2, one component and 2,000 faces. Its 8,000 one-way barycentric source-distance samples have maximum 3974.44 m, 95th percentile 2023.05 m and RMS 1036.86 m. These samples do not establish a full Hausdorff bound or qualify geographic registration, silhouette or individual features. The original photographic-map projection radii remain separate from shape geometry and the numeric elevation datum.

The Shape lens uses the shared neutral gray over the source mesh to distinguish geometry from imagery. The Photographic views retain pre-existing image seams, shadows and local control differences. Source reference radii and projections do not become spherical geometry constraints. The original Q128 spacing is about 5.96 km; finer numeric maps do not imply the simplified silhouette retains that full detail.

- [USGS / Cassini 2012 monochrome mosaic](https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m): 11520 × 5760, about 293 m per pixel on a 536.3 km reference sphere. The GeoTIFF is north-up, equirectangular with center longitude 0°. Preparation rolls its 180° E left edge by half a width into the shared 0–360° E map. GeoTIFF no-data is exactly zero; missing observations use the shared gray grid. All nonzero values are retained.
- [NASA/JPL 2014 enhanced-color map, PIA18439](https://www.jpl.nasa.gov/images/pia18439-color-maps-of-tethys-2014/): the full 13467 × 6734 JPEG, approximately 250 m per source pixel. Infrared, green and ultraviolet observations make this enhanced color, beyond human vision. The producer calibrated, registered and photometrically corrected the observations. The map starts at 0° E, north-up, and is not rolled. The published display mosaic has no separate validity mask: dark terrain is not classified as missing coverage.

[Weirich, Gaskell, Palmer and Domingue (2025), Tethys SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichtethysshape.html), NASA PDS, DOI [10.26033/hpv0-eh61](https://doi.org/10.26033/hpv0-eh61). The original product description and XML labels are retained alongside the numeric GeoTIFFs.

Global values are center-relative radius in meters, unlike the archive's regional height products. The displayed quantity is `radius * 0.001 - 531`, height in kilometers above the source's 531 km reference sphere. Color spans −12.5 to +12.5 km. Brightness shows northwest cartographic relief at true height scale. The shared curvature overlay and optional directional Shadows remain active on this lens too.

New relative albedo uses the published 2025 GeoTIFFs and their original equatorial/polar projections. Values are dimensionless and normalized around 1; the archive gives a nominal 0–2 domain. The visible 0.5–1.5 scale saturates above 1.5. No height conversion or relief shading is applied to this quantity. It is a secondary SPC brightness product, less validated than topography, and is neither geometric albedo nor calibrated reflectance. Tethys used uncalibrated ISS inputs; Dione and Rhea used calibrated frames. Source sigma is internal maplet agreement, not absolute height uncertainty.

The B2 intake originally recorded mesh selection and prepared visual checks as pending. Its selected 2,000-face mesh is now the existing geometry, preserved byte for byte by B9. Its numerical approximation checks do not establish absolute cartographic accuracy; the later B9 source and mounted-view records are linked above.

</details>

<details>
<summary>Methods: Cassini VIMS calibration, masking and registration</summary>

## Cassini VIMS infrared and water-ice maps (B9)

The original calibrated RC19 C cubes, matched navigation N cubes and original PDS QUB detector/background data are retained beside the body. The [recipe](source/cassini-ice/prepare.json) and [manifest](source/manifest.json) pin exact wavelengths, source masks, calibration arithmetic, observer timing and prepared source maps.

Infrared assigns native channels near 2.02, 1.59 and 1.28 µm to red, green and blue, with a common per-body stretch and gamma 2.2. Ice absorption is `1 - R(near 2.02 µm) / continuum(near 1.82 µm, near 2.20 µm)` using a linear continuum at the exact per-cube wavelengths. Calibrated float32 I/F and derived depth values retain valid negative measurements; only display colors saturate at the authored legend/stretch limits.

Native detector apertures and sampled exposure geometry define support. Original saturation, special values, missing background and their archive-filter dependencies are excluded per band; finite calibrated values alone do not establish detector validity. Numerical maps do not interpolate gaps into measured coverage. The 1024 × 512 output grid adds no native resolution. Exact observation/source-pixel companion TIFFs preserve ownership. Infrared uses the existing photographic bilinear/WebP packing; ice absorption uses nearest scalar sampling. The maps use the existing preparation and unchanged mesh and retained scene.

Native source-camera reconstruction and dense independent aperture checks test detector support and between-pose boundary motion. Selected regions retain the released native navigation. These sampled physical-support checks do not establish an integrated detector PSF or exact absolute pointing; independent registration to the separate photographic normal map is not established.

The [body registration record](source/cassini-ice/evidence/registration.md), [preparation receipt](source/cassini-ice/preparation-receipt.json) and [B9 source review](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/source-review/tethys.md) contain source-selection and independent-check evidence. The [B9 report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b9-cassini-ice-surfaces/README.md) gives reproduction commands and the shared measurement definitions.

</details>

## Cassini ISS photograph

The lens projects one Cassini ISS narrow-angle frame onto the SPC shape model. The archive ships the calibrated image without geometry, so the camera comes from SPICE kernels. The spacecraft clock, frame, instrument, ephemeris and pointing kernels are pinned once in the [Cassini kernel bank](../../spice/cassini/manifest.json) for every Saturnian body; restore them with `node tools/spice/kernel-bank.mts acquire cassini`. The camera is evaluated at mid-exposure, halfway between the start and stop clock counts in the PDS3 label.

| Check | Result |
| --- | --- |
| Range and phase against OPUS's geometry for this frame | Within 0.3 km and 0.001° |
| Limb residual before and after refinement, holdout edges | 6.7 px → 0.89 px RMS |
| Refinement rotation | 0.0061°, a 9.5 px boresight shift |
| Surface showing the photograph | 29.7% of the displayed surface area; 3,769,832 of 13,174,380 atlas texels |
| Largest distance from the displayed mesh to the source surface | 4.39 km, within the 5.31 km limit |

A texel keeps the photograph only when four conditions hold. Its four image contributors lie within two diagonal pixel footprints of the closest source-mesh point; a footprint is about 1.1 km at nadir and grows with emission. The surface is seen at less than 75° emission. That point lies within 5.31 km of the displayed mesh, and the camera can see it. The far side, the night side and surface seen beyond 75° keep the grid. Brightness uses the empirical Lommel-Seeliger law, with incidence limited to 80° and emission to 75°. No published Tethys photometric model has been checked yet. A fixed 3 km separation used to leave a stippled fringe where it cut foreshortened pixels. Stating it in footprints removed that fringe, and coverage rose from 27.1% to 28.5% of the displayed surface area.

Preparing Tethys again on 14 September 2026 refined the same frame differently. The limb fit used 152 fit and 147 holdout edges instead of 89 and 93, and its rotation fell from 0.012° to 0.0061°. The limb refinement module had not changed since before the previous images were committed, and two preparation runs on 14 September produced identical images. Why the fit found a different edge set is not identified.

A [Pixelmatch comparison](evidence/iss-re-preparation/comparison.webp) renders both image sets in one page with Chrome 153.0.8010.37, 1440 × 1000, DPR 2 and an unchanged 1480 × 1560 crop. The previous capture swaps in the three earlier ISS images; every other file is unchanged. [Capture settings and byte pins](evidence/iss-re-preparation/capture.json) identify both image sets. Pixelmatch 7.2.0 uses threshold **0.1**, including anti-aliasing, without masks. Differences follow the limb and the edge of the photograph.

| Comparison | Mismatched pixels / 2,308,800 |
| --- | ---: |
| Repeat capture of the re-prepared lens, both views | 0; identical bytes |
| [Previous → re-prepared, facing the photograph](evidence/iss-re-preparation/pose-1-change.json) | 141,030 |
| [Previous → re-prepared, photograph edge at the limb](evidence/iss-re-preparation/pose-2-change.json) | 215,631 |

[In the images themselves](evidence/iss-re-preparation/assets.json), 8.0% of the surface texture's 32,768,000 pixels differ, as do 0.12% of the shadow texture, 2 of the thumbnail's 4,608 pixels and 3.4% of the [minimap](evidence/iss-re-preparation/minimap.webp).
