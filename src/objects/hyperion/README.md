# Hyperion

## Sources

**False color** combines original Cassini ISS IR3, IR1 and UV3 observations from September 26, 2005, displayed as red, green and blue. Both red and green display channels are infrared; this is false color. Fifteen FULL-resolution, losslessly compressed CISSCAL 4.0beta products cover five neighboring pointings at about 159–208 m per detector pixel near the centre. Their image IDs and registration records are listed below.

- **Monochrome** uses 11 clear-filter Cassini ISS observations, calibrated to I/F by CISSCAL 4.0beta and distributed by the [PDS Ring-Moon Systems Node](https://pds-rings.seti.org/cassini/iss/access.html).

- The [PDS Saturn Small Moon Shape Models release](https://sbn.psi.edu/pds/resource/saturnsatshapes.html) provides Thomas's Hyperion model: 14,636 vertices and 29,268 triangular plates, with Cartesian coordinates in kilometers.

- **Elevation** is radial height above a 135 km reference sphere, sampled from the released shape.

## Evidence

The new [regional-frame camera checks](evidence/cassini-coverage/hyperion-row-0-check.json) and [alternate-row check](evidence/cassini-coverage/hyperion-row-1-check.json) both lacked independent feature patches. These are unsuccessful fixed-camera investigations against native PDS inputs, recorded with code/shape/image hashes; scratch input paths name the investigated products, not installable new surfaces. Neither published row is promoted. See the [investigation ledger](investigations.json) for the decision and reopening condition.

The 2026-09-13 [color-encoding capture](evidence/filter-color/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/filter-color/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

All fifteen filtered cameras pass disjoint holdouts and checks against a separate clear exposure. Across the five pointings, the second-image held-out RMS is 0.242–0.933 detector pixels, with maximum held-out residual 1.689 pixels. The [registration method and original correspondence reports](#filter-camera-registration) preserve every accepted match, including the larger diagnostic residuals. These are relative registration checks within the published shape frame.

**False color:** Five overlapping pointings extend the photographed crater field beyond the original rectangular detector footprint. Only complete three-filter coverage contributes; photographed shadows remain. Existing IAU names remain available in this lens. The [browser record](evidence/filter-color/capture.json) pins the loaded image responses, camera, settings and inspected views at DPR 1 and 2. The existing Monochrome images, body leaves and picking triangles are unchanged; only the selected false-color assets were re-encoded. Dragging, Shadows and the mobile selector passed without page errors or replaced scene DOM. Scientific qualification comes from the original camera/shape release and the registration evidence described here; these screenshots document the mounted result.

[False color](evidence/filter-color/color-dpr1.png) · [DPR 2](evidence/filter-color/color-dpr2.png) · [Oblique with Shadows](evidence/filter-color/oblique-shadows-dpr1.png) · [Mobile](evidence/filter-color/mobile.png). These captures were refreshed on 2026-09-13 after integrating main’s shared observation pipeline at `0636327ba`. The record pins the tested recipe, runtime, display transfer and loaded image bytes, and compares retained geometry with `8cc1a2fae`.

- The expanded False color map contains 2,271,627 valid samples out of 8,388,608 (27.1%), up from 907,090 (10.8%) with one pointing: 2.50× the mapped coverage. The per-triplet contributions are recorded in `prepared/surfaces.json`. These are equirectangular raster counts, not equal-area surface fractions.

- The prepared 4096 × 2048 Monochrome map contains 6,836,406 valid output samples out of 8,388,608 (81.5% of equirectangular pixels). This is raster coverage, not an equal-area surface fraction.

- Recorded B3 source-mesh reprojection gives held-out correlations 0.99169 and 0.99276, with displacement magnitudes 1.62 and 5.70 detector pixels. The correction is source-relative; it does not override the mesh's published uncertainty or establish absolute 100 m accuracy. Exact pins, fit regions and independent checks are in [source/validation/n1506391424-registration.json](source/validation/n1506391424-registration.json).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 11 | 2 | 6.96° | — | — | its other 11 frames | 9 of 11 | 0.00° | 0 of 11 | — | ×1.21 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

**False color:** Coverage is regional and the photographs retain acquisition shadows. The fifteen images span approximately 00:42–01:06 UTC and include changing viewpoints. They are not a simultaneous true-color view or a composition map. The camera fit is relative to the published 2005 control frame; it cannot improve the shape’s documented sub-kilometre uncertainty in this observed region. One UV3 fitting patch has a 4.88-pixel residual near a dark crater boundary; it is retained in the report rather than pruned. The fifth pointing has only 7–8 second-image holdouts per filter. Its other, diagnostic checkerboard partition includes residuals up to 2.62 pixels. All points remain in the reports; the disjoint holdouts pass the stated criteria.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Hyperion (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. This export publishes no diameters, so every name is labelled without a rim, ranked after sized features, and the sidebar shows its size as unpublished.

Feature notes: 1 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

Named features run of 2026-09-12 (this version): the catalogue labels 5 IAU names on the hit mesh (nothing skipped; 5 of them without a published diameter); `tests/objects/unit/surface-features.test.mts` verifies the pinned bytes, the body-frame anchors and the hit-mesh radius band, and a headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page, selected every lens and pinned Bahloo from the sidebar search with no console errors or failed requests.

The label-discovery update restores the current Gazetteer ZIP and records its
new byte pin. Its prepared names, coordinates, notes and mesh anchors match the
previous catalogue exactly. All five names become eligible while the whole moon
fits on screen; facing and overlap still control display.

- The well-observed 2005 sector has reported relative uncertainty below 1 km; relative errors on the opposite side reach 6 km. Small craters are not reliably represented in the shape itself. Missing or unstable observation geometry remains visibly unavailable rather than filled with invented terrain.

- The model uses the spin frame observed during Cassini's September 26, 2005 flyby and retains Bahloo at 196°W. Hyperion has no IAU-approved modern rotation solution. Its source record therefore requests an explicitly arbitrary display orientation with no simulated constant spin. Orbital position comes from the shared astronomy package; the surface attitude is not a prediction for that epoch.

- No public release of the newer 2025 mosaic and DEM was located; see the [investigation ledger](investigations.json).

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Filter camera registration

<details>
<summary>Source products, processing and qualification</summary>

Thomas’s [model documentation](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/hyperion_document.pdf) explicitly says ordinary geometry for other images does not share this model’s body frame. Its Table 1 supplies controlled clear images, rather than a filtered-image solution. The published camera for `N1506388174` anchors the first pointing. Initial range, observer/Sun directions and roll interpolate the bracketing controlled clear-image records for each pointing. These are search seeds only: the accepted cameras add detector translation and roll measured from spatially distributed interior features through the full source mesh.

The shared preparation tool [align-camera-bands.mts](../../../tools/objects/terrestrial-layers/align-camera-bands.mts) uses a 27-pixel patch and a 5-minus-31-pixel detail filter for correspondence only. Original I/F values are never sharpened or replaced. Every patch retains the full convolution footprint inside the detector; all projected samples must be visible on the original mesh. A checkerboard grid separates fitting and held-out coordinates. Correlation, peak separation and curvature reject ambiguous matches before fitting; no residual pruning is applied.

Acceptance requires at least six fit and six held-out patches, held-out RMS at most one source pixel and maximum residual at most two. A second published clear image, `N1506388518`, validates the frozen color cameras without contributing to their fit. Its own published pointing is used for the primary second-image result below.

| Filter | Fit / holdout patches | Fit RMS / max (px) | Holdout RMS / max (px) | Second-image holdouts | Second-image RMS / max (px) |
| --- | ---: | ---: | ---: | ---: | ---: |
| IR3 | 53 / 49 | 0.333 / 0.860 | 0.281 / 0.700 | 37 | 0.907 / 1.355 |
| IR1 | 53 / 49 | 0.304 / 0.867 | 0.261 / 0.803 | 37 | 0.933 / 1.342 |
| UV3 | 52 / 49 | 0.798 / 4.880 | 0.396 / 0.884 | 37 | 0.875 / 1.689 |

[Camera fit and all correspondences](source/validation/filter-color-registration.json) · [Second-image validation](source/validation/filter-color-independent.json). The [clear-to-clear diagnostic](source/validation/clear-camera-registration.json) measures the two anchors’ small pointing difference. Using that independently fitted clear reference gives [0.19–0.38-pixel held-out RMS](source/validation/filter-color-independent-aligned.json); this is consistency within the same control network, not independent absolute accuracy. No existing Monochrome camera is changed.

The additional pointings use separately registered clear cameras. The existing clear-to-clear fit ties `N1506388518` to `N1506388174`; new clear-only fits tie `N1506388840` to that aligned `N1506388518`, `N1506389178` to aligned `N1506388840`, and `N1506389543` directly to `N1506388174`. Each triplet is fitted against its own clear exposure and checked, without refitting, against the preceding anchor. This aligns the mosaic within the control network and does not improve absolute shape accuracy. Monochrome retains all its original cameras.

| Clear pointing | IR3 / IR1 / UV3 image numbers (all `N…_2_CALIB`) | Second-image holdouts per filter | Second-image RMS range / maximum held-out residual (px) |
| --- | --- | ---: | ---: |
| 1506388174 | 1506388324 / 1506388291 / 1506388236 | 37 | 0.875–0.933 / 1.689 |
| [1506388518](source/validation/filter-color-1506388518-registration.json) | 1506388668 / 1506388635 / 1506388580 | 37 | [0.460–0.531 / 1.339](source/validation/filter-color-1506388518-independent.json) |
| [1506388840](source/validation/filter-color-1506388840-registration.json) | 1506388990 / 1506388957 / 1506388902 | 31 | [0.273–0.328 / 0.599](source/validation/filter-color-1506388840-independent.json) |
| [1506389178](source/validation/filter-color-1506389178-registration.json) | 1506389328 / 1506389295 / 1506389240 | 19 | [0.242–0.350 / 0.556](source/validation/filter-color-1506389178-independent.json) |
| [1506389543](source/validation/filter-color-1506389543-registration.json) | 1506389683 / 1506389650 / 1506389595 | 7–8 | [0.732–0.811 / 1.284](source/validation/filter-color-1506389543-independent.json) |

The published table repeats `N1506389543` with two detector centres. The selected NAC observation uses the first row, (−56.50, −8.10); its [separate clear-frame fit](source/validation/filter-color-1506389543-clear.json) checks the measured features before the filtered-camera fit. The 8840 and 9178 pointings needed approximate −8 and −16-pixel detector-y offsets to centre the search. Those are unqualified search seeds, recorded in their jobs, followed by the same feature fit and holdout criteria.

Preparation measures every delivered camera again. The recipe's `bandAlignment` block names each reference camera once and lists the checks in chain order from the catalog seed `N1506388174`; preparation stops when a held-out budget is exceeded. Measured again this way, the `N1506389543` clear camera exceeds the budget against `N1506388174` (8 held-out patches, 1.105 px RMS, 2.484 px maximum; its fit report passed at 0.997 and 1.963), and the IR1 fit against it reaches 2.194 px. Preparation therefore confirms that pointing's three filter cameras directly against `N1506388174` (7–8 held-out patches, 0.73–0.81 px RMS, at most 1.28 px) rather than through that clear camera. The seed and validation jobs that fitted the cameras are retained under `source/preparation/filter-color-*.json` and `clear-camera-registration.json`. Restore the body’s source inputs, then run, for example:

```sh
node tools/objects/terrestrial-layers/align-camera-bands.mts \
  src/objects/hyperion/source/preparation/filter-color-registration.json \
  output/hyperion-color-fit.json
node tools/objects/terrestrial-layers/align-camera-bands.mts \
  src/objects/hyperion/source/preparation/filter-color-validation.json \
  output/hyperion-color-validation.json --check-only
```

The delivered [recipe](source/preparation/terrestrial.json) uses the accepted cameras and untouched calibrated pixels. Each of its five band sets names one observing triplet’s three photographs. A point is colored only where all three bands of a set qualify, and it keeps the set with the finest resolution; a missing band never borrows another set’s channel. Level matching scales a set’s three bands by one gain, so their measured ratios stay; the widest fitted gain is 1.02. It withholds non-common coverage, samples beyond 75° incidence or emission, and a three-pixel detector coverage margin. The existing edge-connected 0.003 I/F background exclusion is an approximate background mask, not a detector-quality flag; interior dark samples remain. All channels share a 0–0.5 I/F range assigned to linear display channels. The [shared IEC sRGB output transfer](../../../docs/color-preparation.md) follows floating-point surface transfer; only then are values clipped and quantized to 8 bits. No per-filter equalization, clear-filter detail injection or photometric model alters their ratios. Existing geometry and the shared Shadows control are retained.

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

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

Facts and context follow [NASA's Hyperion overview](https://science.nasa.gov/saturn/moons/hyperion/) and the vendored JPL physical/orbital data. The title retains the common Inter credit documented beside its source input.

The [investigation ledger](investigations.json) records the rejected control rows and SUM2 trials, including their unresolved camera conventions.

The 1,200-leaf approximation was compared with the released 29,268-plate model using 2,048 equal-area Fibonacci radial rays. Mean radial difference was 371 m, 95th percentile 945 m, 99th percentile 1.34 km and maximum sampled difference 1.94 km. These are sampled approximation errors, not exhaustive bounds or a claim that the observational shape itself is accurate to those values.

The remaining pixels use the shared missing-data presentation.

The initial camera uses the prepared ecliptic presentation basis and the radial mesh’s CSS X/Y transport to face the source portrait direction; geographic longitude/latitude are not copied into scene yaw/pitch.

## B3 close-encounter registration

The additional FULL, 1024×1024 clear I/F observation `N1506391424_2_CALIB` was acquired on 26 September 2005 at 01:35:17.096 UTC, at a controlled range of 16,782.2 km (nominal 100.52 m/pixel). It uses the native 8192-byte VICAR image offset. It is not one of the ambiguous SUM2 controls.

PDS Table 1 gives north azimuth 328.60° and centre (73.0,388.2). Two disjoint image regions against four existing controlled frames constrain a +0.79495545° detector roll and centre change to (72.10596577,374.01763246). Range, focal scale, observer/solar geometry and the original I/F pixels are unchanged.

The shared preparer withholds a 16-pixel source border and applies its existing geometric, occlusion, incidence/emission and bounded photometry rules. The new input supplies finer regional observations; it does not create global 100 m coverage or remove photographed crater shadows. The completed twelve-frame preparation retains 6,836,406 valid map pixels (81.5%): the close frame improves detail inside existing coverage rather than expanding the observed footprint. Its accepted contribution is 215,732 corrected pixels, with overlap level 1.2430004332473796, as recorded in `prepared/surfaces.json`.

</details>
