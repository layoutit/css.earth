# Itokawa

## Sources

| View or property | Source and interpretation |
| --- | --- |
| AMICA mosaic | Ten v-band observations from September–October 2005, with [Gaskell-controlled AMICA records](https://data.darts.isas.jaxa.jp/pub/pds3/hay-a-amica-3-amicageom-v1.0/), original FITS and preflight flat. The October close-ups take priority over distant September images where their qualified coverage overlaps. Relative detector brightness, not absolute radiance or albedo. |
| Shape and Elevation | [Gaskell ver128q](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-itokawa.shape-model/data/vertex/ver128q.tab), derived from 775 AMICA images. Elevation is source radius minus 165 m; the original black-rock prime meridian is retained. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/ITOKAWA/target) Itokawa centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

### Native SBMT comparison, 14 September 2026

The [shared SBMT oracle](../../../tools/oracles/sbmt/README.md) independently
reads the full Gaskell ver128q shape, the 1024×1024 ST_2402987304 v-band FITS
image and its [archived SUM pointing](source/observations/N2402987304.SUM).
Pointing, sampled FITS values and visible surface intersections agree with the
repository's numerical code. **UV projection differs by up to 1.0021 pixels**
across the tested orientations, beyond the fixed 0.25-pixel criterion. That
result is retained as a difference in the oracle's report and regression test.
It is consistent with SBMT's angular UV approximation differing from a pinhole
camera; it is not a solved registration or a measured ground-truth error.

The [fixture](../../../tests/oracles/sbmt/projection.json) pins the inputs,
generator and native software. The existing AMICA mosaic continues to use its
controlled DDR route described below. This test does not replace that route or
change its published texture. The SUM download uses SBMT's published public
access pair (`public` / `wide-open`) and its manifest byte pin.

### Close-up priority, 14 September 2026

The AMICA view adds two controlled October photographs and uses the existing
`recipe-order` selection. Frame `2481672682` stays first to preserve the established
brightness reference. The other frames follow in increasing measured median
pixel footprint: October close-ups precede the more distant September images.
This is a fixed source-backed preference, not a per-pixel optimum. All existing
visibility, incidence, emission, transfer and brightness limits still apply.
The 794 triangles, hit mesh and other datasets are retained.

| Added observation | UTC, 26 October 2005 | Median nadir pixel footprint | Disjoint camera holdouts | Sampled maximum distance to source mesh |
| --- | --- | --- | --- | --- |
| [2492225173](source/observations/st_2492225173_v_ddr.lbl) | 08:31:17 | 0.394 m | 511,490; maximum 0.0000249 px | 1.711 m over 39,565 points |
| [2493031594](source/observations/st_2493031594_v_ddr.lbl) | 15:31:19 | 0.376 m | 540,000; maximum 0.0000373 px | 1.555 m over 41,769 points |

Every detector value in both 1,048,576-pixel originals matches the reversed DDR
image band. The unchanged reader applies the archived flat and exposure, rejects
defective flat pixels and checks the supported paired-exposure acquisition.
Camera holdouts measure consistency with archived backplanes, not independent
absolute navigation accuracy. The separate mesh check samples every thirteenth
valid archived XYZ point against the complete ver128q surface; its sampled maxima
are below the unchanged 5 m contributor limit, not exhaustive accuracy bounds.

At the same 24 area-weighted samples per retained triangle, current-main coverage
is **83.24%**, increasing to **84.26%**. More significantly, distant September
images supply **36.58% → 5.36%** of the display mesh; qualified October close-ups
replace most of that area. These estimates describe the simplified display mesh,
not exact photographed area. The old 73.41% result below belongs to an earlier
transfer implementation and is not this change's baseline.

Two other paired-exposure candidates, `2495806075` and `2506694595`, were decoded
and tested but exceeded the existing overlap-gain bound in the tested mosaics.
Single-exposure products `2532629277` and `2516129281` were inspected as raw
previews only; their calibration remains unqualified. No detector correction or
brightness-bound relaxation was introduced to include them.

[Matched comparison](evidence/close-up-priority/comparison.webp) ·
[Before](evidence/close-up-priority/before.webp) ·
[After](evidence/close-up-priority/after.webp) ·
[Pixelmatch diff](evidence/close-up-priority/diff.webp) ·
[Capture settings](evidence/close-up-priority/browser.json) ·
[Source-transfer checks](evidence/close-up-priority/source-transfer.json) ·
[Preparation and restoration measurements](evidence/close-up-priority/preparation.json).

The comparison swaps the previous eight-image bank and the new ten-image bank
in the same Chrome 153 application at `b7e797027`, with the same scene, camera,
1440×1000 viewport and DPR 1. Identical unscaled body crops exclude the current
UI text. Pixelmatch 7.2.0 at threshold 0.1 finds 26,682 changed pixels among
353,280; this locates texture changes, not sharpness or scientific accuracy.
The inspected views show additional small terrain detail while preserving the
silhouette. Three orientations, real mouse dragging, AMICA/Elevation switching
and optional lighting were checked. Dragging retains all 794 triangle nodes.
Shadows defaults off and returns off after the lighting check. Inspected
[DPR 2](evidence/close-up-priority/dpr2.webp),
[390×844 mobile layout](evidence/close-up-priority/mobile.webp) and
[lighting](evidence/close-up-priority/shadows.webp) captures accompany the record.
DPR 1 and 2 request the same body assets; the mobile check is viewport emulation,
not physical-device performance evidence.

The partial refresh took 542.8 s, peaking at 1,670 MiB RSS. It replaced three
runtime images and retained 33 assets. All six added native files restored into
an empty directory; all 36 runtime files (11.85 MB) independently installed into
another empty directory with exact byte/hash agreement. Twelve focused
profile/package tests, preparation typechecking, the post-bake package check and
all 54 source-file checks pass. The source suite reports 74 passes, one existing
missing-PDF skip and one failure in Europa's unchanged tracked preparation
receipt: its content hash differs from current `main` content. That unrelated
failure remains outside this change. Full repository suites were not run.

### Eight-image expansion, 13 September 2026

This historical record predates the current transfer implementation. The same
eight inputs are the baseline at `e609e66d66ea2d701253de4a3681a354324927ff`, but
their current coverage is reported above.

The new southern view `2473604354` fills additional coverage while retaining the same 794 triangles, camera and hit mesh. At the same 64 stratified samples per triangle, area-weighted coverage is **61.88% → 73.41%** across this PR (72.66% before the final southern addition). The eighth frame contributes 5.60% of displayed area, mostly replacing more foreshortened views.

Its controlled camera has 375,607 withheld pixels, maximum residual 0.00002713 px. Every thirteenth valid archive XYZ pixel gives 29,053 source-mesh comparisons, maximum separation 2.218 m, below the unchanged 5 m contributor limit. [Source-transfer evidence](evidence/photographic-expansion/source-transfer.json) records the sampled checks. The final overlap gains span 0.759–1.030; these are relative display adjustments, not recovered albedo.

[Before](evidence/photographic-expansion/before.webp) · [After](evidence/photographic-expansion/after.webp) · [Diff and validation](evidence/photographic-expansion/evidence.json).
The eight-image refresh took 412.6 s and peaked at 2,283 MiB RSS, compared with 683 s for the earlier seven-image full preparation. It replaces three runtime assets and retains 33. Geometry and other lenses are retained; source and output hashes identify the run. See the [observation refresh guide](../../../docs/surface-preparation.md).

Four additional southern frames were decoded in the same batch; the selected frame gave the largest extra supported area. A subsequent header survey examined all 31 controlled v-band products dated 26 October onward: 24 have headers compatible with the existing paired-exposure reader, while the later single-exposure/subwindow formats remain withheld. Header compatibility does not qualify their imagery. No new detector calibration was inferred for them.

### Initial seven-image qualification

The following record describes the earlier seven-image outputs at commit `55fe2579fa741da71a0bd5498712d0f3d7e5fe25`. Its photographs and source checks remain relevant because those native inputs and camera fitting are unchanged; the new capture and eight-frame measurements above supersede its displayed-area and pixel-difference results.

[Before](evidence/photographic-coverage/before.webp) ·
[After](evidence/photographic-coverage/after.webp) ·
[Pixelmatch diff](evidence/photographic-coverage/diff.webp) ·
[Measured evidence](evidence/photographic-coverage/evidence.json) ·
[Native XYZ/source-mesh checks](evidence/photographic-coverage/source-transfer.json)

The matched Chrome 152 captures use 1440×1000, DPR 1, the AMICA view, motion
paused and Shadows off. Before is `d4330c6c1`; after is `0ff39d3bc` plus this
change, with exact input/output pins in the evidence. Camera, retained tree
and hit mesh are byte-equivalent. Pixelmatch 7.2.0 at threshold 0.1 reports
303,866 changed pixels out of 1,440,000; independent unchanged captures differ
by zero pixels. These counts locate change, not sharpness or scientific accuracy.
The new photograph shows boulders across terrain that was previously mostly grid.

Focused source/photometry tests pass (19), source catalogue checks pass (9;
one unrelated missing-PDF case skipped), and the package has 36 verified
delivered assets. All 12 new native input files restored from the archive into
an empty directory with exact byte/hash agreement. Headless checks cover four
poses, DPR 1/2, mobile, lighting and retained-DOM dragging. Shadows defaults
off. The changed capture/test roots pass strict TypeScript checking; full
repository suites were not run. The additional inspected screenshots are
[DPR 2](evidence/photographic-coverage/dpr2.webp),
[mobile](evidence/photographic-coverage/mobile.webp) and
[directional lighting](evidence/photographic-coverage/shadows.webp).

The September 2026 expansion keeps the same 794 display triangles and transfer
limits. Sampling the same 64 stratified points per triangle, weighted by its
area, increases accepted coverage from **61.9% to 72.7%**. This estimates the
display mesh's supported surface, not the exact area photographed on Itokawa.

| Added observation | UTC in 2005 | Controlled camera range | Camera holdout maximum |
| --- | --- | --- | --- |
| 2480981469 | October 22, 07:00:19 | 4.118 km | 0.0000392 px |
| 2481672682 | October 22, 13:00:19 | 4.434 km | 0.0000360 px |
| 2492513077 | October 26, 11:01:16 | 4.017 km | 0.0000216 px |
| 2495230070 | October 27, 10:36:18 | 3.354 km | 0.0000356 px |

All 1,048,576 detector values in each added image match the reversed DDR image
plane exactly. The existing flat correction removes the response band visible
in their raw detector previews. Disjoint camera holdouts contain 333,562–618,210
points per added frame. These check the archive's internal registration; they
do not establish independent absolute navigation accuracy. The overlap graph
connects all seven frames with display gains 0.752–1.021. Frame 2481672682
supplies the common percentile stretch: its broader brightness range preserves
detail that the earlier September reference clipped in these close-ups. Phase and shadow
differences are still visible; this is not a calibrated albedo map.

A separate source-mesh check samples every thirteenth valid Cartesian pixel
against the complete ver128q surface. The four added frames have sampled maximum
distances of 1.885, 2.173, 1.335 and 1.606 m respectively, below the unchanged
5 m contributor limit. These are sampled maxima, not exhaustive error bounds.

The archive survey found 712 controlled v-band products. It sampled dates and
then inspected eleven original October/November camera products. Single-exposure
and 16-bit subwindow products fall outside the existing qualified reader and
were not added. The selected four use its supported paired-exposure format.

The controlled-camera holdouts reached maximum residuals of 0.00000842/0.00000876/0.00002017 px, testing agreement with archived Cartesian coordinates rather than absolute navigation. Source-mesh checks and independent image/flat/brightness anchors are retained below. Earlier Chrome 152 DPR 1/2 checks covered the then-selected lenses; that record does not establish qualification of the later three-image mosaic.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/itokawa/amica.test.mts).

- **Reader oracle, 2026-09-12:** `tools/oracles/pds3/amica-ddr.py` reads the pinned DDR cube `st_2402987304_v_ddr.img.gz`, its detector FITS and the V flat with pvl, numpy and astropy. `tools/objects/terrestrial-layers/amica-geo.oracle.test.mts` requires the geometry planes to match exactly, angles within 10⁻⁴° after conversion; the DDR image band to equal the vertically reversed detector DN; and the image to equal DN over flat over exposure at 64 sampled pixels.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `amica` | 10 | 0 | — | — | — | its other 10 frames | 0 of 10 | — | 1 of 10 | — | ×1.13 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Itokawa (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (this export ships no projection file, so the metadata datum is recorded and the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Coverage is partial; the grid marks unavailable terrain. The lossy detector images lack a per-pixel quality plane. Disk normalization is approximate and does not restore stray light, temporal flat changes or shadowed terrain. Residual seams remain. Earlier browser checks found fine triangle-edge artifacts, particularly in Elevation; these are rendering defects, not terrain.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="itokawa-source-record"></a>
<a id="selected-data-and-survey"></a>
<a id="preparation-and-interpretation"></a>
<a id="reproduction"></a>
<a id="qualification-limits"></a>
<a id="amica-spacecraft-mosaic-2026-09-08"></a>

<details>
<summary>Methods and source notes</summary>

**Preparation and interpretation**

The source shape uses kilometers, right-handed body-fixed axes and east longitude. The shared preparer converts positions to meters and scales them by the independently sourced 0.165 km radius. Original connectivity is welded at exact position duplicates and simplified by meshoptimizer 1.2.0 before texture and lighting baking. The target is 800 native PolyCSS u triangles with 128 px raster cells and a 6 m library error allowance. A regularized error estimate is not a guaranteed maximum surface deviation. The output has 794 faces; meshoptimizer reports 4.512 m estimated error. Exact coincident, oppositely wound pairs left by collapses are removed (2 faces), then every edge must have two opposite incidents. The result has one connected component and Euler characteristic two.

The shared frame is fixed at 2026-09-03 TT. Horizons osculating elements approximate TDB as TT; these conics are not long-term perturbation models. Rotation follows the pinned PDS bundle description. Shadows use prepared diffuse lighting in that body frame, not runtime physics. Elevation is radial height above the 165 m sphere, not height above a gravitational equipotential. No geometry or image is synthesized at runtime.

**Reproduction**

Elevation atlas colors use the nearest point on the full source triangle surface in three dimensions, with a maximum source-to-display distance of 6 m. The radius, barycentric position and facet normal belong to that same source surface; the height subtracts the stated reference-sphere radius. The distance allowance is enforced per prepared atlas texel, independently of meshoptimizer’s estimated error. Equidistant distinct surfaces or projections beyond the bound are withheld with the shared gray grid. No orientation heuristic substitutes a farther source branch. Raster bleed clamps to its retained triangle edge before projection.

The flat longitude/latitude preview cannot represent more than one source surface on a center ray, so ambiguous sample cells and their interpolation footprints are withheld. The three-dimensional Elevation atlas is baked directly from source-surface correspondence and does not paint this preview onto the body. Cartographic relief uses the matched source facet normal in a local east/north/up frame; optional Sun lighting uses that same normal. Full source connectivity is retained before simplification. Photographic/albedo datasets keep their original mapping and are not recalibrated by this scalar correction.

`node --test tools/objects/terrestrial-layers/source-surface.test.mjs` checks exact pinned-source facet regressions for Itokawa, Ryugu, Eros and Bennu. `python3 tools/objects/terrestrial-layers/verify-source-surface.py itokawa` (NumPy required) independently verifies the fixture against every triangle of the full original source using planar projection plus closest edges. These numerical checks establish scalar correspondence; they do not replace browser visual qualification.

**Qualification limits**

The navigation context image uses the same three-dimensional source-surface sampler as the Elevation atlas. Its regeneration procedure and byte identities are in [the navigation recipe](source/preparation/navigation.json), [source manifest](source/manifest.json) and [object definition](object.json).

**Historical three-image AMICA qualification (2026-09-08)**

The following measurements describe the earlier three-image version. The
seven-image expansion and its changed display reference are reported above.

The atlas uses the existing closest-source-point sampler with the existing 6 m display-transfer allowance. All four interpolation contributors must be within 5 m of the same source point; full-source ray tests check camera visibility to 0.05 m. The lowest-emission eligible observation wins, with deterministic ties. Existing overlap matching yields gains 1, 1.006847 and 0.941577. Accepted overlap log-MAD values are below 0.048, and the accepted overlaps connect all three images. Invalid or ambiguous coverage remains the ordinary grid. The source observation-index raster, companion maps and reported sampled area coverage are produced by the existing shared preparer. Geometry remains the existing 794 native PolyCSS raster triangles.

Included: the Gaskell shape derived from 775 Hayabusa AMICA images, using its documented black-rock prime meridian and released connectivity. The Aizu 5.04 shape was also considered; the selected PDS model supplies explicit body-frame and source-image documentation. The package includes a partial, controlled three-image AMICA mosaic and the existing Elevation view. This is not a global photographic/albedo mosaic: the original observations and Gaskell Cartesian backplanes support only the qualified coverage described below. Unobserved terrain remains a grid.

- [Mapping release](https://sbn.psi.edu/pds/resource/doi/itokawashape_1.1.html)
- [Shape](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-itokawa.shape-model/data/vertex/ver128q.tab)
- [Mission facts](https://science.nasa.gov/solar-system/asteroids/25143-itokawa/)
- Pole and spin: source/reference/bundle_description.txt

Three v-band observations from 24, 26 and 29 September 2005 use the original Gaskell-controlled AMICA DDR Cartesian backplanes, original image FITS companions and preflight v-band flat. Exact URLs, hashes and acquisition operations are in the source manifest. The archived detector frames are lossy 8-bit products with quality flag 0, no binning and paired SUM/near-zero-exposure DIFF images. Per Ishiguro et al. (2010), that onboard pairing removes bias, dark current and frame-transfer smear. Preparation verifies every DDR image sample against the vertically reversed original FITS array, then applies the identically oriented preflight flat and exposure normalization. Zero detector brightness remains eligible; clipped 255 values and defective flat pixels are withheld. No per-pixel detector-quality plane exists in this release.

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 0.888 / 2.345 / 5.937 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

The earlier source notes report Headless Chrome 152 checks of the then-selected lenses with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom.

Each controlled projective camera is fit using every 179th eligible XYZ pixel; all remaining eligible geometry pixels form a disjoint holdout. The three maximum pixel residuals are 0.00000842, 0.00000876 and 0.00002017 pixels. These establish consistency with the archived controlled coordinates, not independent absolute navigation accuracy. A separate every-13th-pixel source-mesh check finds maximum nearest-source distances of 1.07167, 1.30572 and 1.54820 m. The fitted Gaskell camera positions differ from the nominal SPICE-derived summary positions in the detached labels; the product's Cartesian backplanes own registration, as its catalog specifies.

The first usable views were inspected in 192 px source-surface snapshots before the full bake. The original-image / XYZ / flat-field correspondence and an independent Astropy-calculated brightness anchor at DDR pixel (563,498) are retained in the focused tests. That pixel contains DN 137, flat response 1.0011287927627563 and exposure-normalized brightness 1572.937123636729 before disk normalization.

Fine triangle-edge artifacts remain visible in smooth areas, particularly Itokawa elevation. They persisted in a flat-color diagnostic and existing PolyCSS overlap variants; they are a rendering limitation, not source terrain.

The view is relative detector brightness, not calibrated absolute radiance, measured albedo, natural color or a space-weathering abundance map. It does not restore lossy detail, stray light or temporal flat-field changes. A bounded Lommel–Seeliger disk correction follows the AMICA-specific use described by Li, Le Corre and Reddy, LPSC 2018 abstract 1957; it is an approximation, not their fitted Hapke solution. Incidence and emission are limited to 70 degrees and gain to 1.5. Photographed terrain shadows and residual seams remain. Shadows defaults off.

</details>
