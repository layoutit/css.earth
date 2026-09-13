# Hyperion

## Sources

**Filter color** combines original Cassini ISS IR3, IR1 and UV3 observations from September 26, 2005, displayed as red, green and blue. Both red and green display channels are infrared; this is false color. The complete FULL-resolution, losslessly compressed CISSCAL 4.0beta products are `N1506388324_2_CALIB`, `N1506388291_2_CALIB` and `N1506388236_2_CALIB`, at about 205–208 m per detector pixel near the centre.

- **Monochrome** uses 12 clear-filter Cassini ISS observations, calibrated to I/F by CISSCAL 4.0beta and distributed by the [PDS Ring-Moon Systems Node](https://pds-rings.seti.org/cassini/iss/access.html).

- The [PDS Saturn Small Moon Shape Models release](https://sbn.psi.edu/pds/resource/saturnsatshapes.html) provides Thomas's Hyperion model: 14,636 vertices and 29,268 triangular plates, with Cartesian coordinates in kilometers.

- **Elevation** is radial height above a 135 km reference sphere, sampled from the released shape.

## Evidence

The new filtered-camera registration passes disjoint holdouts and a second published clear image: 0.875–0.933 detector-pixel RMS and maximum 1.689 pixels for that second image. [Original correspondences and residuals](source/validation/filter-color-independent.json) retain all accepted matches.

**Filter color:** The intersecting detector footprints reveal a detailed regional crater field with photographed shadows and straight coverage edges. Existing IAU names remain available in this lens. The [browser record](evidence/filter-color/capture.json) pins the loaded image responses, camera, settings and inspected views at DPR 1 and 2. The original unshaded image bytes, body leaves and picking triangles are unchanged. Dragging, Shadows and the mobile selector passed without page errors or replaced scene DOM. Scientific qualification comes from the original camera/shape release and the registration evidence described here; these screenshots document the mounted result.

[Filter color](evidence/filter-color/color-dpr1.png) · [DPR 2](evidence/filter-color/color-dpr2.png) · [Oblique with Shadows](evidence/filter-color/oblique-shadows-dpr1.png) · [Mobile](evidence/filter-color/mobile.png). Captures correspond to the implementation and source inputs at `78feb6ad9`; the record retains its acquisition-tool and prepared-file hashes.

- The prepared 4096 × 2048 Monochrome map contains 6,836,406 valid output samples out of 8,388,608 (81.5% of equirectangular pixels). This is raster coverage, not an equal-area surface fraction.

- Recorded B3 source-mesh reprojection gives held-out correlations 0.99169 and 0.99276, with displacement magnitudes 1.62 and 5.70 detector pixels. The correction is source-relative; it does not override the mesh's published uncertainty or establish absolute 100 m accuracy. Exact pins, fit regions and independent checks are in [source/validation/n1506391424-registration.json](source/validation/n1506391424-registration.json).

## Known problems

**Filter color:** Coverage is regional and the photographs retain acquisition shadows. The three filters were acquired at different times, approximately 00:42:08–00:43:36 UTC. They are not a simultaneous true-color view or a composition map. The camera fit is relative to the published 2005 control frame; it cannot improve the shape’s documented sub-kilometre uncertainty in this observed region. One UV3 fitting patch has a 4.88-pixel residual near a dark crater boundary; it is retained in the report rather than pruned. The disjoint validation points and the second clear-image check pass the stated criteria.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Hyperion (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. This export publishes no diameters, so every name is labelled without a rim, ranked after sized features, and the sidebar shows its size as unpublished.

Feature notes: 1 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

Named features run of 2026-09-12 (this version): the catalogue labels 5 IAU names on the hit mesh (nothing skipped; 5 of them without a published diameter); `tests/objects/unit/surface-features.test.mts` verifies the pinned bytes, the body-frame anchors and the hit-mesh radius band, and a headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page, selected every lens and pinned Bahloo from the sidebar search with no console errors or failed requests.

The label-discovery update restores the current Gazetteer ZIP and records its
new byte pin. Its prepared names, coordinates, notes and mesh anchors match the
previous catalogue exactly. All five names become eligible while the whole moon
fits on screen; facing and overlap still control display.

- The well-observed 2005 sector has reported relative uncertainty below 1 km; relative errors on the opposite side reach 6 km. Small craters are not reliably represented in the shape itself. Missing or unstable observation geometry remains visibly unavailable rather than filled with invented terrain.

- The model uses the spin frame observed during Cassini's September 26, 2005 flyby and retains Bahloo at 196°W. Hyperion has no IAU-approved modern rotation solution. Its source record therefore requests an explicitly arbitrary display orientation with no simulated constant spin. Orbital position comes from the shared astronomy package; the surface attitude is not a prediction for that epoch.

- **Unresolved:** Zubarev and Nadezhdina's 2025 paper, [Shape, mosaic and control point network](https://doi.org/10.1016/j.icarus.2024.116440), reports a newer 50 m/pixel mosaic and DEM in a new reference frame. Its public downloadable pixel/model release was not located from the paper and linked 2025 LPSC abstract. The research exists; this package does not claim to include it.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)


## Filter camera registration

<details>
<summary>Source products, processing and qualification</summary>

Thomas’s [model documentation](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/hyperion_document.pdf) explicitly says ordinary geometry for other images does not share this model’s body frame. Its Table 1 supplies controlled clear images, rather than a filtered-image solution. The published camera for `N1506388174` anchors this fit. Initial range, observer/Sun directions and roll were interpolated between the bracketing controlled `N1506388174` and `N1506388518` records. These are search seeds only: the accepted cameras add detector translation and roll measured from spatially distributed interior features through the full source mesh.

The shared preparation tool [register-camera-bands.mts](../../../tools/objects/terrestrial-layers/register-camera-bands.mts) uses a 27-pixel patch and a 5-minus-31-pixel detail filter for correspondence only. Original I/F values are never sharpened or replaced. Every patch retains the full convolution footprint inside the detector; all projected samples must be visible on the original mesh. A checkerboard grid separates fitting and held-out coordinates. Correlation, peak separation and curvature reject ambiguous matches before fitting; no residual pruning is applied.

Acceptance requires at least six fit and six held-out patches, held-out RMS at most one source pixel and maximum residual at most two. A second published clear image, `N1506388518`, validates the frozen color cameras without contributing to their fit. Its own published pointing is used for the primary second-image result below.

| Filter | Fit / holdout patches | Fit RMS / max (px) | Holdout RMS / max (px) | Second-image holdouts | Second-image RMS / max (px) |
| --- | ---: | ---: | ---: | ---: | ---: |
| IR3 | 53 / 49 | 0.333 / 0.860 | 0.281 / 0.700 | 37 | 0.907 / 1.355 |
| IR1 | 53 / 49 | 0.304 / 0.867 | 0.261 / 0.803 | 37 | 0.933 / 1.342 |
| UV3 | 52 / 49 | 0.798 / 4.880 | 0.396 / 0.884 | 37 | 0.875 / 1.689 |

[Camera fit and all correspondences](source/validation/filter-color-registration.json) · [Second-image validation](source/validation/filter-color-independent.json). The [clear-to-clear diagnostic](source/validation/clear-camera-registration.json) measures the two anchors’ small pointing difference. Using that independently fitted clear reference gives [0.19–0.38-pixel held-out RMS](source/validation/filter-color-independent-aligned.json); this is consistency within the same control network, not independent absolute accuracy. No existing Monochrome camera is changed.

The seed and validation jobs are retained under `source/preparation/filter-color-*.json` and `clear-camera-registration.json`. Restore the body’s source inputs, then run, for example:

```sh
node tools/objects/terrestrial-layers/register-camera-bands.mts \
  src/planets/hyperion/source/preparation/filter-color-registration.json \
  output/hyperion-color-fit.json
node tools/objects/terrestrial-layers/register-camera-bands.mts \
  src/planets/hyperion/source/preparation/filter-color-validation.json \
  output/hyperion-color-validation.json --check-only
```

The delivered [recipe](source/preparation/terrestrial.json) uses the accepted cameras and untouched calibrated pixels. It withholds non-common coverage, samples beyond 75° incidence or emission, and a three-pixel detector coverage margin. The existing edge-connected 0.003 I/F background exclusion is an approximate background mask, not a detector-quality flag; interior dark samples remain. All channels share a linear display scale of 0.5 I/F to 255, gamma 1 and unit gains. No per-filter equalization, clear-filter detail injection or photometric model alters their ratios. Existing geometry and the shared Shadows control are retained.

</details>

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="hyperion-sources-and-preparation"></a>

## Included views

The exact IMG/LBL URLs and byte pins are in `source/manifest.json`. Original 1024 × 1024 samples remain the preparation inputs; no display-catalog texture is substituted. Selected camera resolutions range from approximately 100 m to 1.8 km per pixel. The best 2005 mosaic sector retains finer detail than the sparser reverse side.

Frames are projected through the measured shape, using the sub-spacecraft and sub-solar latitude/west longitude, range, north azimuth and image-center positions in Table 1 of the [Hyperion model documentation](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/hyperion_document.pdf). The source table's `_1` names identify observations; the archive currently serves updated `_2_CALIB` products with the same image clocks. Cassini NAC's published 2003.44 mm focal length and 12 micrometer pixel pitch in the pinned [NAIF instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti) set a 5.9896977199 microradian pixel scale. Preparation converts west longitude to east longitude, rather than assuming the source is east-positive.

The selected full-resolution calibrated files contain a 4096-byte VICAR label followed by a 4096-byte binary telemetry header. Actual float pixels start at byte 8192. The detached PDS `^IMAGE` pointer is stale in these files; the VICAR `LBLSIZE`, `NLB` and `RECSIZE` fields and exact file length determine the decoder offset. Reading at 4096 would turn telemetry into a false image row and omit the last real row.

A bounded Lunar-Lambert disk normalization and overlap exposure match reduce illumination differences before composition. They do not recover data from cast shadows, establish absolute surface albedo or remove all illumination from small crater walls. These remaining photographed details are explicitly part of the observational lens. The application's separate Shadows setting remains available through prepared shape-aware illumination banks.

The scale spans −50 to +60 km and includes the moon's global elongation. It is a shape-derived scientific view, not a fine-resolution stereo DEM or a gravity-referenced altitude. Fixed cartographic relief makes slopes legible without fabricating measurements.

## Shape and orientation

The release is credited to Thomas, Joseph and Ansty (2018), DOI [10.26033/ewy3-jy61](https://doi.org/10.26033/ewy3-jy61). The checked-in XML and PDF document its frame and limitations. The longest shape axis is not inferred from the NASA overview's approximate diameters.

The shared meshoptimizer path simplifies the released connectivity before texture baking, targeting 1,200 leaves within the 2,000-leaf ceiling. Native PolyCSS raster triangles carry prepared texels and normal-interpolated directional lighting. A spherical detached lighting overlay is not used on this irregular silhouette.

The navigation image comes from the same prepared shape and Monochrome map. The dedicated Surface Lens preview is a small map, not the HD atlas.

## Source survey

- **Included:** Cassini calibrated clear-filter frames and the PDS controlled shape/camera release. They provide restorable imagery with an explicit common registration frame and a conceptually distinct global-relief view.

- **Excluded:** The [USGS Voyager control network](https://astrogeology.usgs.gov/search/map/hyperion_image_control_network) has a four-frame high-pass-filtered Voyager map. It is much coarser than the selected Cassini data and uses an older frame; it is not an extra lens.

- **Excluded:** NASA's [Hyperion 3D model](https://science.nasa.gov/resource/hyperion-3d-model/) is a useful visualization but its small UV atlas has no delivered per-pixel observational coverage or controlled frame. It is not relabeled as an observation or used to fill gaps in measured imagery.

- **Excluded:** NASA press mosaics provide excellent regional images but do not publish a single projection/camera model for the composited pixels. The original controlled ISS frames are used instead. Available enhanced-color press views are not treated as a registered global color dataset.

Facts and context follow [NASA's Hyperion overview](https://science.nasa.gov/saturn/moons/hyperion/) and the vendored JPL physical/orbital data. The stars and title retain the common ESO/S. Brunier and Inter credits documented beside the source inputs.

Three additional published control rows (N1497116847, N1550270298 and N1550320098) produced grossly mismatched source-image silhouettes and were excluded. Four SUM2 close-up frames were also excluded: their full-resolution center convention was ambiguous and their binned resolution did not improve on the retained full-resolution mosaic images.

The 1,200-leaf approximation was compared with the released 29,268-plate model using 2,048 equal-area Fibonacci radial rays. Mean radial difference was 371 m, 95th percentile 945 m, 99th percentile 1.34 km and maximum sampled difference 1.94 km. These are sampled approximation errors, not exhaustive bounds or a claim that the observational shape itself is accurate to those values.

The remaining pixels use the shared missing-data presentation.

The initial camera uses the prepared ecliptic presentation basis and the radial mesh’s CSS X/Y transport to face the source portrait direction; geographic longitude/latitude are not copied into scene yaw/pitch.

## B3 close-encounter registration

The additional FULL, 1024×1024 clear I/F observation `N1506391424_2_CALIB` was acquired on 26 September 2005 at 01:35:17.096 UTC, at a controlled range of 16,782.2 km (nominal 100.52 m/pixel). It uses the native 8192-byte VICAR image offset. It is not one of the ambiguous SUM2 controls.

PDS Table 1 gives north azimuth 328.60° and centre (73.0,388.2). Two disjoint image regions against four existing controlled frames constrain a +0.79495545° detector roll and centre change to (72.10596577,374.01763246). Range, focal scale, observer/solar geometry and the original I/F pixels are unchanged.

The shared preparer withholds a 16-pixel source border and applies its existing geometric, occlusion, incidence/emission and bounded photometry rules. The new input supplies finer regional observations; it does not create global 100 m coverage or remove photographed crater shadows. The completed twelve-frame preparation retains 6,836,406 valid map pixels (81.5%): the close frame improves detail inside existing coverage rather than expanding the observed footprint. Its accepted contribution is 215,732 corrected pixels, with overlap level 1.2430004332473796, as recorded in `prepared/surfaces.json`.

</details>
