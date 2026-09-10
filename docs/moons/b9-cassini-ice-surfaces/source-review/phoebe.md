# B9 Phoebe source qualification

Reviewed 2026-09-09. **Source qualification and preparation are complete** for
regional infrared RGB and water-ice absorption on the **existing 2023 Phoebe
surface**. No geometry, retained scene, renderer, camera, navigation or shell
changes. The final 1440 × 720 maps use 41 native pixels from IR 1465671822_1,
covering about 1.84% of reference-sphere solid angle. The
[independent final mapping review](iapetus/phoebe-fixed-map-review.md) checks
all 13,325 owned output cells, source values and geographic ambiguity, plus
dense sampled physical support. Coarse absolute registration and exposure/PSF
limits remain explicit; this source review does not itself qualify mounted UI
or delivery. See the [B9 README](../README.md).

The sections below preserve the chronological intake, rejected unfitted
registration and subsequent qualification evidence. Initial candidate budgets
and pending checks are historical, not the final product disposition.

## Decision

Original calibrated spectral cubes and their numerical navigation are publicly available. Directly draping Nantes latitude/longitude onto the existing Phoebe surface is unqualified: the cubes use a different pole and an ellipsoid, while the mounted shape uses a revised center of figure. A compact independent reconstruction of three native rays reproduces the source lighting angles to float32 precision. This supports an offline ray-transfer implementation, with explicit frame conversion and registration checks, without changing the existing scene geometry.

The original frame conversion and a coarse old-to-2023 origin estimate are
explicit. IR 1465671822_1 has a separate two-offset fit with untouched
source-image holdouts and a reproducible 41-pixel interior region. The final
mapper intersects qualified native apertures with the unchanged fixed mesh,
preserving gaps and excluding visibility, illumination and geographic
ambiguities. This qualifies nominal regional source mapping, not exact absolute
pixel positions or global coverage. IR 1465670650_1 has useful independent
top/bottom edge families, but its separate fit leaves a systematic holdout bias
and remains withheld; it must not inherit another observation's correction.

## The fixed target surface

The body currently retains [Weirich et al. 2023, DOI 10.26033/3k3c-5713](https://doi.org/10.26033/3k3c-5713), bundle `urn:nasa:pds:satellite-phoebe.cassini.shape-models-maps::1.0`. Its paired original OBJ has 99,846 vertices and 196,608 triangles; the existing display has 3500 faces. Coordinates are km, +X is 0° longitude, and +Z is the positive pole. The mounted paired albedo is modeled relative brightness, not a color photograph.

The release describes reused images/kernels, some height changes, and an origin shift of **1.03 km to the center of figure**. Its inspected description gives the magnitude, not an XYZ translation vector. The retained Gaskell orientation is RA **356.90°**, Dec **77.88°**, W **178.58° + 931.639°/day** from J2000. The older monochrome mosaic is already excluded from the mounted views because its registration to this revised shape is unproven. The same standard applies to VIMS.

Local authority: `src/planets/phoebe/README.md`, `source/science/2023/productdescription.txt`, `source/science/2023/phoebekernellist.txt`, `source/shape/README.txt`, and `source/preparation/rotation.json`. The original source products, rotation and all surface geometry remain unchanged; `README.md` now also documents B9.

## Historical numerical-source intake and candidate cohort

The [Nantes PH encounter inventory](https://vims.univ-nantes.fr/flyby/PH) lists 397 cubes from the 2004-06-11 flyby. C products contain calibrated IR values; N products contain native, per-pixel navigation. Every inspected IR core is little-endian float32, 256 bands, one tile per band, starting at byte 65537. Each paired N core has the same spatial dimensions and six bands.

At the initial header-only stage, the following sizes were **declared layout
ends**, calculated from ISIS object offsets and lengths. Only the completed N
product marked below had a verified full-download size at that point. The server
ignored byte-range requests for cubes, returned chunked HTTP 200 without
Content-Length, and a HEAD check supplied no length. Header reads explicitly
stopped at 65,536 bytes and closed the connection. Later complete-file receipts
and the final body manifest provide actual lengths and full hashes for selected
inputs; the table is not an inventory of the final delivered cohort.

| Observation and original products | IR samples × lines | Portal resolution; phase | C / N declared bytes | Selection purpose |
| --- | --- | --- | --- | --- |
| [1465670650_1](https://vims.univ-nantes.fr/cube/1465670650_1): [C](https://vims.univ-nantes.fr/cube/C1465670650_1_ir.cub), [N](https://vims.univ-nantes.fr/cube/N1465670650_1_ir.cub) | 48 × 24 | 13 km/pixel; 83° | 1,384,521 / **232,454 verified** | Fraser–Brown successful-registration example; limb and both channels available. First reconstruction target. |
| [1465671822_1](https://vims.univ-nantes.fr/cube/1465671822_1): [C](https://vims.univ-nantes.fr/cube/C1465671822_1_ir.cub), [N](https://vims.univ-nantes.fr/cube/N1465671822_1_ir.cub) | 36 × 24 | 9 km/pixel; 82° | 1,090,377 / 226,310 | Author repository contains an earlier fitted-geometry file for this observation; limb and both channels available. |
| [1465673806_6](https://vims.univ-nantes.fr/cube/1465673806_6): [C](https://vims.univ-nantes.fr/cube/C1465673806_6_ir.cub), [N](https://vims.univ-nantes.fr/cube/N1465673806_6_ir.cub) | 24 × 40 | 3 km/pixel; 72° | 1,254,879 / 294,812 | Approaching, limb visible, normal sampling in both channels. More resolved regional candidate after registration. |
| [1465674952_1](https://vims.univ-nantes.fr/cube/1465674952_1): [C](https://vims.univ-nantes.fr/cube/C1465674952_1_ir.cub), [N](https://vims.univ-nantes.fr/cube/N1465674952_1_ir.cub) | 30 × 18 | 1 km/pixel; 25° | 731,021 / 190,954 | Near-encounter, favorable incidence/emission, but **no limb**. Cannot independently establish absolute registration from silhouette. |
| [1465679932_1](https://vims.univ-nantes.fr/cube/1465679932_1): [C](https://vims.univ-nantes.fr/cube/C1465679932_1_ir.cub), [N](https://vims.univ-nantes.fr/cube/N1465679932_1_ir.cub) | 48 × 48 | 16 km/pixel; 89° | 2,677,389 / 373,322 | Receding partial disk and a previously studied spectral cube; VIS unavailable. Lowest initial priority. |

The five IR C/N pairs total 8,456,039 declared bytes. This was a candidate-cohort
budget, **not bytes acquired**. Portal resolutions summarize each observation;
they are not measured coverage, equal-area resolution, or independently verified
pointing accuracy. The last observation scans for about 936 seconds, so one
mid-time orientation is inadequate. Headers and page metadata are pinned in
[intake-pins.json](phoebe/intake-pins.json); decoded label dimensions, timestamps
and table offsets are in [label-summary.json](phoebe/label-summary.json). Final
mapping selects only 1465671822_1. Its complete C/N/QUB inputs, mask and measured
coverage are pinned in the body's `source/cassini-ice` package; the full
five-observation cohort was not qualified.

## Calibration, wavelengths and masks

The [Nantes pipeline](https://vims.univ-nantes.fr/info/isis-calibration) documents
ISIS 3.5.2.0 and RC19 radiometric calibration to I/F. It also documents
source-owned spatial processing: a 5 × 5, 2.5-sigma noise filter and replacement
of nulls from a local 3 × 3 neighborhood for qualifying image sizes. These are
archived, calibrated and filtered measurements, not untouched detector samples.
The initial header-only intake could not inspect calibration history after the
core; final qualification checks the complete C history and original-detector
dependencies, as recorded in the [quality review](tethys/DETECTOR-QUALITY.md).

The initial 3.1/2.0/1.8 µm RGB candidate was not selected. The final RGB uses
one-based IR bands **70/44/25**: **2.01788/1.58965/1.27803 µm**. The ice index
uses bands **58/70/81**, with continuum anchors **1.82022/2.19970 µm** and
measurement **2.01788 µm**. It is `1 − R70 / linear(R58, R81)` at those exact
wavelengths. These identities and the fixed false-color stretch are pinned in
the final recipe. No natural-color, temperature, grain-size or
composition-percentage claim follows from either view.

The absorption map uses the defined continuum-relative index and retains valid
native support; no scientific values come from figure colors. The author source
discussed below provides method details but uses an earlier calibration.
Independently applying a formula to RC19 is a new derived product, not
reproduction of the paper's final map. Viewing geometry, photometry, particle
properties, noise and archive filtering remain relevant; no photometric or
thermal correction is applied.

N band order is phase, emission, incidence, latitude, longitude, pixel resolution. [ISIS phocube](https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/phocube/phocube.html) specifies default camera coordinates as planetocentric, positive east, 0–360°, and resolution in meters. A native pixel with valid coordinates can still be on the night side: sampled N pixels include incidence above 90°. One directly sampled no-data bit pattern decoded as −3.4028226550889045e38 in all six bands. Geometry-valid, illuminated, scientifically valid, and registered support must remain separate masks. No filling across gaps or uncertain limbs is qualified.

## Exact native frame and cached geometry

All inspected C/N labels declare:

- Target `PHOEBE`, body frame code **10047**, instrument frame **−82371**, `ShapeModel = Null`, and `BODY609_RADII = (115,110,105)` km.
- Cached BodyRotation pole RA **355°**, Dec **68.7°**, W **178.58° + 931.639°/day**. The two pole directions differ from the fixed source pole by **9.195046832°**. Equal prime-meridian coefficients do not eliminate that frame mismatch.
- PCK: `pck00009.tpc` and `cpck15Dec2017.tpc`; pointing: `04161_04164ra.bc` with `cas_v40_usgs.tf`; position: `041014R_SCPSE_01066_04199.bsp`; target/Sun ephemeris: `de405.bsp`; timing: `naif0012.tls`, `cas00172.tsc`; addendum: `vimsAddendum03.ti`.
- InstrumentPosition: three records of J2000 XYZ, velocity XYZ, ET; declared Hermite interpolation. BodyRotation: two records of quaternion, angular velocity, ET. SunPosition: two position/velocity/ET records with linear cache. Pointing records vary by observation; 52 for 1465670650_1. Sideplane IR/VIS tables also exist, but are not a per-pixel timestamp band.

The native position/rotation caches carry enough numerical information to
recover observer rays without fetching the full kernel inventory. Their
convention and time coupling are supported by
[ISIS Spice.cpp](https://isis.astrogeology.usgs.gov/3.5.0/Object/Programmer/_spice_8cpp_source.html)
and [VimsGroundMap.cpp](https://isis.astrogeology.usgs.gov/3.5.0/Object/Programmer/_vims_ground_map_8cpp_source.html).
The 3.5.0 code supplied the initial reconstruction reference; final source-camera
qualification additionally checks actual archived centers and timing. This is
evidence for the used camera path, not blanket equivalence of every ISIS version.

For zero-based IR line `l`, sample `s`, sample count `n`, native-start fractional digits `f`, and stored integer-clock conversion `t_integer`:

```
t0 = t_integer + f / 15959
e  = exposure_IR_ms * 1.01725 / 1000
d  = interline_delay_ms * 1.01725 / 1000
t(l,s) = t0 + l*(n*e+d) + (s+0.5)*e
```

The header's `CLOCK_ET_*_COMPUTED` stores the integer-clock result as an eight-byte little-endian value encoded in hex. Do not use the displayed UTC midpoint, or interpret the fractional clock digits as decimal seconds.

### Initial bounded reconstruction result

At this initial stage, only one full nav cube, N1465670650_1, was downloaded.
Plain Python `struct` read cached geometry and a few native centers; NumPy and
author code were not imported. For this observation:

- Native start ET: **140250070.81583986**; IR exposure **0.16276 s**; interline delay **0.42215875 s**.
- First/last pixel-center ET: **140250070.89721987 / 140250267.9436311**, inside position/rotation cache times **140250068.81583986–140250269.81455535**.
- Three center anchors, zero-based `(line,sample)` **(11,12), (17,12), (15,14)**, reproduce all nine native phase/emission/incidence values within **2.336 × 10⁻⁶ degrees**.

The reconstruction uses ellipsoid radial intersections from native latitude/longitude, Hermite position interpolation, quaternion interpolation and ellipsoid normals. [The numerical receipt](phoebe/nav-anchor-qualification.json) retains source and computed values; [raw table samples](phoebe/nav-static-inspection.json) retain the independent byte-derived inputs. Run the checked-in [stdlib reconstruction script](phoebe/qualify-nav-anchors.py) from the worktree root with `python3 docs/moons/b9-cassini-ice-surfaces/source-review/phoebe/qualify-nav-anchors.py --intake output/b9-source-intake/phoebe`. It checks the complete nav file against its pinned receipt before calculation.

This is **internal source-navigation consistency**, not an independent spacecraft pointing check. It does not prove correct placement on the 2023 model, exact detector footprints, or spectral validity.

## Published corrected-map alternatives

[Fraser & Brown 2018, final DOI 10.3847/1538-3881/aac213](https://doi.org/10.3847/1538-3881/aac213), describes 46 matched observations, using RC17, joint VIS/IR silhouette fitting, observation geometry/tracking corrections and spectral assignment to Gaskell facets. Its successful-fit example is 1465670650_1. The reported systematic adjustments are not universal constants to apply blindly to Nantes RC19. The earlier [arXiv version](https://arxiv.org/html/1803.04979) has 40 observations and offers processed products on request; do not mistake it for the final cohort. The final paper's continuum-relative band-depth method uses 1.5/2 µm ice features and continuum anchors near 1.35, 1.78, 2.23 and 3.6 µm. It supplies method evidence for independent derivation, not a qualified 2023 registration.

The author's [public Cassini repository](https://github.com/fraserw/Cassini/tree/bb3da0363ae1b65708d46f6e73bedda67d8dcbb8), pinned at `bb3da0363ae1b65708d46f6e73bedda67d8dcbb8`, last pushed 2018-02-20, contains:

| Original numerical candidate | Size / identity | Qualification |
| --- | --- | --- |
| [waterDepths.pickle](https://raw.githubusercontent.com/fraserw/Cassini/bb3da0363ae1b65708d46f6e73bedda67d8dcbb8/waterDepths.pickle) | 8,556,349 bytes; Git blob `b4619b224df857cc82da1875453da576772e8e59` | Not downloaded. Filename alone does not establish schema, final-paper version or fixed-frame registration. |
| [cv1465671822_1_ir.fit_pickle](https://raw.githubusercontent.com/fraserw/Cassini/bb3da0363ae1b65708d46f6e73bedda67d8dcbb8/shapeScripts/cv1465671822_1_ir.fit_pickle) | 753,676 bytes; SHA-256 `52d53bc36f3b858c5392414aaa8fbdada58b06b2bceed64eb749256e8c1129e4` | Complete file inspected using `pickletools.genops`; never unpickled. Declares arrays (36,100,9) and (36,100), float64 little-endian. |

The small fit is consistent with a nine-parameter single-channel sampler and scores. Source parameter order is observer longitude/latitude/azimuth, solar longitude/latitude/azimuth, distance, and two image offsets; tracking speed/angle are fixed in that script. It is not the final joint-channel/tracking solution. The [static inspection receipt](phoebe/fit-static-inspection.json) records the format without executing reconstruction opcodes. Source inspection identifies old `CO_SA_ISSNA_5_PHOEBESHAPE_V2_0` Q64 facets as the analysis mesh, not the current 2023 surface. The numerical map's relation to final results remains to be established.

The repository has no explicit software license. Author code is kept only in local research output, not vendored into product or documentation. This is distinct from independently implementing a published method and citing factual fitted parameters; absence of a software license is not evidence that those activities are barred. Repackaging an original complete data release still needs its own documented reuse basis, version and provenance.

[Buratti et al. 2008](https://pubs.usgs.gov/publication/70033556), DOI 10.1016/j.icarus.2007.09.014, describes infrared photometry and normal-reflectance maps, but the inspected USGS record marks additional online files absent. A reusable numeric map was not located there. [Clark et al. 2005](https://www.nature.com/articles/nature03558), DOI 10.1038/nature03558, and [Coradini et al. 2008](https://doi.org/10.1016/j.icarus.2007.07.023) are relevant compositional mapping references; this bounded survey did not establish an original registered numerical download from them. That is a search disposition, not proof that no such release exists. Press figures are not numerical replacements. The newer five-inner-moon Filacchione products do not supply a Phoebe map.

## Historical implementation plan

This plan preceded the image fits and final detector mapper. The later sections
record its completed regional qualification and the rejected second observation;
the list is retained to explain the original acceptance criteria.

1. Start with 1465670650_1 and optionally 1465671822_1. Fetch their selected spectral and VIS registration inputs serially after confirming each bounded size; retain native validity and illumination masks. Use exact RC19 channel centers and a separately specified derived formula.
2. Recover each retained native ray: find the old ellipsoid intersection from its planetocentric coordinate, interpolate the source observer at the exact pixel time, and subtract observer from intersection. Transform the ray and observer through J2000 into the retained Gaskell orientation. This preserves the archived measurement direction rather than asserting identical latitude/longitude grids.
3. Establish the 2023 origin displacement as a vector or a verified bounded uncertainty model. The published 1.03 km magnitude alone does not authorize an assumed vector or a zero shift. Existing old/new source meshes and common source imagery provide material for registration, but similar vertex indices or a best visual fit are not proof of identical physical points. A translation uncertainty envelope may be investigated for coarse, strictly interior support; it must demonstrate invariance of accepted assignments across that envelope.
4. Intersect only the existing fixed surface. Use the published fitted geometry as a starting reference and independently implement any required correction. Hold out native silhouette/terminator segments and identifiable surface landmarks from fitting; also hold out separate observations where overlap exists. Record residuals in native pixels and surface distance, compare with source sampling, and withhold ambiguous limbs and frame-sensitive pixels. A low silhouette fitting error alone does not establish internal landmark registration.
5. Establish source-to-target footprint ownership and masks before preparation. Pixel-center ray agreement does not prove detector-corner footprints. Preserve gaps and label approximate support honestly; never stretch a partial measurement into global chemistry. Record which measured pixels support each accepted region and show a source-bound diagnostic separately from the product palette.

At this stage, the pole conversion was explicit and numerically reconstructible,
while observation-to-fixed-surface registration remained unresolved. The later
fit and holdout evidence qualify coarse regional placement for IR 1465671822_1
only. Exact absolute registration and general VIMS tracking correction remain
unproven. This route requires no new renderer or geometry.

### Bounded old/new source-model comparison

The existing manifest pins both source models; restore the exact local inputs through the existing acquisition/cache route if needed. This is source registration research, never a change to the mounted mesh:

| Model | Original bytes | SHA-256 |
| --- | --- | --- |
| `shape/phoebe_ver128q.tab`, 2012 model archived in 2013; PDS4 migrated from `CO-SA-ISSNA-5-PHOEBESHAPE-V2.0` | 16,897,992 | `92550ba0625255a2f91cd5d9a7b52e020fc4ba76c7ef3fd76a9728a66df697c2` |
| `shape/2023/phoebe_128_o.obj`, 2023 paired source model | 17,787,240 | `4393bd9343a00b03f407bfa4e841178ca07787e176a6b2ebef820ed410ab87b9` |

Both labels declare 99,846 vertices and 196,608 triangles. The old vertex table starts at byte offset 57 with 57-byte records; the new OBJ vertex block starts at offset 0 with 60-byte records. [Extracted label metadata](phoebe/model-label-summary.json) supported the initial bounded record inspection. The subsequently authorized comparison below decoded both vertex blocks and the original 2023 triangles.

`shape/icqmodel.asc` documents the old model's six ICQ faces, with I varying fastest, then J, then face. Boundary vertices are duplicated; triangulation chooses diagonals from geometry. The new release is also Q128 but does not explicitly promise unchanged physical correspondence at equal record indices. Equal ordering can propose correspondences; it cannot prove them. Recentering and resampling can move the sampled surface point even when a grid index remains identical.

A scheduled qualification can read only the vertex blocks initially, inspect ordering with sparse records, and fit translation on a stratified set of well-constrained surface patches. Validate correspondences by local geometry, not index alone. Use geographically disjoint patches for holdout, exclude weakly imaged poles and report residual distributions by terrain. Compare an identity transform and the fitted translation using independent surface-to-surface distances, and test whether the inferred vector remains stable across different fitting patches. A magnitude near the documented 1.03 km is a consistency check; do not constrain a fit to that value and then call the agreement independent evidence.

Stable held-out residuals could qualify an **estimated registration with measured uncertainty**, including real height changes. They would not recover the source author's exact undocumented transform by assertion. Large, structured or patch-sensitive residuals would reject a global translation approximation. The independent VIMS silhouette/landmark checks remain necessary even if the old/new shape registration passes. A later converter should propagate the accepted translation uncertainty into conservative native-footprint masks.

### First source-model comparison result

The scheduled [comparison script](phoebe/compare-source-models.py) verifies full original input hashes, reads the two vertex blocks and original 2023 triangles, and uses source quality maps to select interior records with `numimg >= 5`, `0 < bestmap <= 1500 m`, and latitude within ±60°. It samples 72 geographic patches of 30° longitude × 20° latitude, separated by 2° guard strips. Twenty-four patches train the fit; two disjoint sets of 24 patches are held out. Each partition contains 4800 original vertices. The [machine-readable result](phoebe/source-model-comparison.json) retains the exact selection and full statistics.

The candidate robust translation is **old XYZ + (0.208622, −0.476787, −0.858670) km**, with magnitude **1.004073 km**. It was fitted from candidate same-record displacements, then independently checked against spatial nearest vertices, local neighborhoods, and closest points on original 2023 source triangles. Every sampled nearest-triangle result is certified by a geometric bound on unqueried triangles; no mesh-to-mesh full distance matrix was allocated.

| Metric | Training | Geographic holdout 1 | Geographic holdout 2 |
| --- | --- | --- | --- |
| Same record is also spatial nearest vertex after translation | 4284/4800 | 4188/4800 | 4190/4800 |
| Translated same-record residual, median / P95 | 0.317 / 0.898 km | 0.297 / 1.135 km | 0.316 / 1.166 km |
| Nearest source-surface residual before translation, median | 0.433 km | 0.542 km | 0.518 km |
| Nearest source-surface residual after translation, median / P95 | 0.115 / 0.480 km | 0.137 / 0.680 km | 0.108 / 0.683 km |
| Maximum sampled translated surface residual | 1.083 km | 2.775 km | 1.753 km |

This improves registration substantially but does **not** establish exact physical correspondence at equal ICQ indices. Tangential residual P95 remains 0.84–0.95 km; independent patch estimates vary from the training translation by median about 0.20 km and as much as 1.61 km. The weak northern patches contribute large discrepancies. A diagnostic rigid fit adds 0.0602° rotation and changes translation by only 3.8 m; it worsens both held-out point residual distributions. It is not applied.

**Disposition at this stage:** a single exact translation, or an unrestricted
fine-resolution operational transform, remained unqualified. The estimate
initialized the subsequent coarse registration investigation with explicit
spatial uncertainty. The next check, recorded below, refined training-only
translation against actual triangle surfaces while retaining geographic
holdouts. Source-model agreement alone does not qualify absolute VIMS pointing
or detector footprints.

This comparison ran serially with BLAS/OMP limited to one thread, wall time about 6.8 s and observed peak RSS 157.7 MB. It changed only the review script and JSON evidence. All original and mounted geometry remained unchanged.

### One independent surface refinement

One additional scheduled calculation refitted **translation only** against actual original 2023 triangle surfaces, starting from the candidate-record result. It used the same training patches and robust point-to-plane residuals with refreshed certified closest triangles. Neither geographic holdout affected the fit. Twelve bounded iterations ended with a 0.048 m update; no further optimization was performed.

The refined estimate is **old XYZ + (0.196038, −0.489158, −0.788669) km**, magnitude **0.948528 km**. It differs from the record-based estimate by **72 m**, and its magnitude is **81 m below** the documented 1.03 km. Linearized omission of each training patch changes the estimate by median 9.9 m and maximum 24.9 m. This measures fit stability under those omissions; it is not an absolute uncertainty bound or proof of the source author's exact translation. The normal-equation condition number is about 1.11, so gross directional degeneracy does not explain the discrepancy.

| Refined closest-source-surface residual | Training | Geographic holdout 1 | Geographic holdout 2 |
| --- | --- | --- | --- |
| Median | 0.119 km | 0.133 km | 0.105 km |
| P95 | 0.454 km | 0.694 km | 0.650 km |
| P99 | 0.644 km | 1.781 km | 1.304 km |
| Maximum sampled | 1.109 km | 2.711 km | 1.700 km |

All 3600 sampled nearest-triangle distances are certified. Actual shape changes and correspondence differences remain; the refinement does not turn them into translation. The 72 m estimator difference is substantially smaller than the spatially varying residuals, and a near-kilometer shift is supported operationally. The original 1.03 km vector is **not recovered exactly**.

For the two then-recommended coarse VIMS observations, 1465670650_1 and 1465671822_1, the held-out P95 source-surface residual corresponds to roughly 0.05–0.08 of the portal's 13/9 km sampling, while the largest observed residual is roughly 0.21–0.30 sample. These ratios are only scale comparisons: shortest-axis sampling, projection, detector support and acquisition motion must be evaluated from the native camera. Same-record tangential residuals also remain larger than nearest-surface distances and must not be treated as zero registration error.

**Operational decision at this stage:** this supplied a nominal starting
alignment for the following coarse registration experiment, not acceptance of
final mapped views. The 1 km 1465674952_1 close-up cannot inherit it as qualified
registration: residuals can exceed multiple samples there. The 3 km candidate
also lacks its own stronger regional evidence. The later independent image and
detector checks admit only the stated coarse IR 1465671822_1 region; there is
no single global accuracy number.

This final calculation took about 2.43 s wall time, with 145.3 MB observed peak RSS. The [same script and receipt](phoebe/source-model-comparison.json) preserve both the candidate-record and refined results, model pins, patch definitions, omitted-patch sensitivity and all residual distributions. No source or mounted geometry changed.

## Historical unfitted native-image check on the fixed terrain

The two coarse candidates now have complete original IR and VIS C/N pairs, acquired by the parent lane and pinned in [the forward receipt](phoebe/native-registration-unfitted.json). [Native continuum-band panels](phoebe/native-calibrated-panels.png) display actual original calibrated byte bands, with a linear min/max stretch per band and nearest-neighbor enlargement. They show substantial crescent structure, but the first infrared observation is clipped at the left frame edge and the second at the top/right. VIS includes visible detector-column artifacts. These are RC19 archive-processed values, including the documented archive noise filtering and local replacement; they are not raw, unfiltered detector measurements.

The [unfitted prediction script](phoebe/check-native-registration.py) uses the shared archived-camera reconstruction in explicit `ray_only` mode and intersects **the existing 3500 prepared terrain faces**, after inverting their uniform display scale by `106.5/230` km per display unit. The OBJ reader preserves source XYZ and the preparation path scales it uniformly. The exact terrain SHA-256 is `a6eb3c92075986288ddfc6e59d85391891ca0d96dc0f2c427ea7fbab2e576178`; all original inputs and this terrain were hash-verified before and after the check.

The nominal transfer uses each pixel's source acquisition time and cached body/pointing/observer tables, the documented Gaskell pole/prime-meridian coefficients, and the previous estimated translation `(0.196038, -0.489158, -0.788669)` km. It independently implements the [NAIF PCK coordinate-rotation formula](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html): `[W]3 [90-Dec]1 [90+RA]3`. The old pole formula agrees with the native cached body rotation to a maximum axis error of **3.33e-10 degrees**. Across the four IR/VIS pairs, reconstructed rays agree with archived valid N centers to at most **5.85e-6 native sampling pixels**. These establish source-camera/frame implementation consistency; they do not establish absolute pointing.

[The predicted image panel](phoebe/native-registration-unfitted.png) shows original bands, a per-pixel Lambert illumination diagnostic with source Sun tables and fixed-terrain self-shadow checks, and predicted boundaries overlaid on native pixels. It does not fit photometry, albedo, offsets, tracking or point-spread function. The nominal crescent falls in the correct general image region, but this coarse visual agreement is insufficient for surface registration. The predicted boundaries are center-cell diagnostics, not actual detector footprints.

The separate [source-gradient script](phoebe/check-native-edges.py) measures image features without using the prediction to select or fit them. In each original continuum band, it obtains an empirical background-value and positive-difference envelope from the two visibly dark final rows. A candidate row must start below that background envelope, have a unique strongest positive horizontal difference above the empirical background differences, and place that strongest difference at exactly the same sample pair in both bands. Every rejection and candidate, including terrain-feature outliers, remains in [the gradient receipt](phoebe/native-gradient-holdouts.json). This is an empirical source-image diagnostic, not a calibrated noise model, physical-limb classifier or confidence interval.

**The unfitted nominal registration does not pass.** In IR **1465671822_1**, the 1.80374 and 2.23295 micrometer bands independently select 15 gradient candidates. Visual review of [the candidate overlay](phoebe/native-gradient-holdouts.png) identifies 13 coherent outer bright-limb candidates at rows 0, 1, 2, 4, 5, 6, 7, 8, 10, 11, 12, 14 and 15. All lie **3–4 native fast-axis samples left** of the predicted first surface hit. The other two candidates are internal surface gradients, with residuals +15 and +2 samples; they are retained explicitly and cannot be silently treated as limb registration evidence. The coherent outer-edge displacement is larger than a center-cell rounding discrepancy. No correction was inferred or applied from its median; the later fit reserves separate holdouts.

IR **1465670650_1** yields only three selected gradients because much of its illuminated left limb leaves the frame; those residuals are -6, +1 and -4 fast-axis samples and do not qualify a full silhouette. VIS 0.90032 micrometer background artifacts exceed 0.011–0.015 I/F and its strongest gradients do not consistently match the cleaner 0.70288 micrometer band, so this particular two-band method admits no VIS candidates. That is a source-quality limitation of this check, not proof that all visible-wavelength registration is impossible.

This failure established the need for an observation-specific solution with
disjoint native image holdouts, the documented frame conversion and unchanged
terrain. The following two-offset fit satisfies the stated coarse regional
standard for IR 1465671822_1; its offsets are not universal corrections. The
separate final detector mapper supplies sampled time-dependent aperture masks.
The final Fraser–Brown matched-image solution remains an original-product
alternative. This unfitted check did not justify further refinement of the
old/new model translation, whose uncertainty is much smaller than the observed
fast-axis mismatch.

The single scheduled array calculation processed 4032 center rays in about **1.00 s**, with peak RSS **71.7 MB**. The edge check is a small stdlib/Pillow calculation; no optimizer ran. Only source-review evidence was generated, and all fixed/source bytes remained unchanged.

### Coarse IR 1822 correction and untouched holdouts

[The bounded fit](phoebe/fit-native-limb.py) uses only the native continuum limb, with training rows **0–2 and 10–12**. Rows **4–8 and 14–15** remain untouched; intervening rows are unused. It fits two constant IR angular-look offsets and holds the source pole, origin estimate, range, shape, albedo, tracking and spectral values fixed. The fitted parameters add **0.000851639949 rad** in the native fast direction and **0.000100166329 rad** in the slow direction, equivalent to **3.44097 / 0.20236 native sampling steps**. These are observation/channel-specific acquisition corrections, not revised SPICE kernels or corrections for VIS.

The [fit receipt](phoebe/native-registration-fit.json) reports six training residuals with RMS **0.106 fast sample** and a two-parameter Jacobian condition number of **2.81**. The seven untouched limb rows have maximum absolute residual **0.704 fast sample**; the other six remain within **0.459**. Independent exact ray/triangle crossings reproduce the fitted projected boundary within **4.98e-7 sample**, confirming numerical implementation rather than absolute pointing accuracy. A fast-offset-only baseline leaves a maximum held-out residual of **0.947 sample**. [The train/holdout overlay](phoebe/native-registration-fit.png) shows every source point and predicted boundary without post-fit rejection.

Leaving out one training row changes the fitted fast offset from 3.408 to 3.484 samples and slow offset from 0.152 to 0.219. Separate upper/lower training-patch fits are less constrained, especially the upper three-row patch (condition number 11.9). Independent ±0.5-fast-sample perturbations of training edge locations imply a linearized worst-case parameter sensitivity of **±0.541 fast / ±0.272 slow sample**. This is a sampling sensitivity experiment, not a confidence interval, point-spread-function model or absolute error bound. Substituting the previous 72 m-different origin estimator changes the two offsets by only **0.0042 / 0.0062 sample**. No new source-model fit was performed.

At these acquisitions the source center ranges span about 19,710–20,640 km. The minimum native angular sampling scales correspond to **4.88 km fast / 9.76 km slow** at the body-center range. The unchanged display's 0.890 km estimated simplification error is about 0.18 of that fast scale, but this estimator is not a physical silhouette/pointing uncertainty bound. The fitted held-out errors justify a **coarse regional alignment at about a native fast sample**, not global or subpixel precision.

[Secondary source-only gradient candidates](phoebe/secondary-image-candidates.png) did not participate in fitting. [The frozen candidate prediction](phoebe/native-registration-candidate.png) places five right/lower illuminated-boundary gradients within 0–1 fast sample, while two differ by 2 and one by 5; two additional strongest falling gradients are internal crater/shadow features. A falling-gradient mismatch is not by itself a pointing error because this prediction uses simple Lambert illumination, no fitted albedo or PSF. These features do not qualify the near-terminator region. The cleaner VIS 0.70288 micrometer upper/left limb is mostly within 0–1 of its own normal sampling step under its unmodified native camera, further showing why the IR correction cannot be copied to VIS. Exact comparisons are retained in [the regional summary](phoebe/regional-summary.json).

### Reproducible interior acceptance for IR 1822

The [regional qualification script](phoebe/qualify-regional-mask.py) evaluates original source rows **4–15**, bounded by the independently checked image interval. Each retained center must hit the unchanged 3500-face surface, have corrected incidence and emission **at most 60 degrees**, and remain free of terrain self-shadow. There is **no brightness or spectral-index mask**. Native detector/background/filter-dependency checks are separate: the [independent raw-source audit](tethys/1465671822_1-detector-quality.json) finds all 864 pixels valid in continuum bands 57/83 and B9 bands 25/44/58/70/81. Original QUB SHA-256 is `df43d42c42ab29cf00eee62c6f22796d85631b60f6c8b4da56ba590cb01f3030`; this check does not undo the archive's existing filtering or prove all noise absent.

There are **108 nominal midpoint** candidates. **107** remain physically acceptable at five exposure fractions (0, 0.25, 0.5, 0.75, 1), or **12.38% of the 864-pixel native frame**. Applying the same geometry cuts to those poses at the center and four corners of the fitted-offset sampling-sensitivity box leaves **41 pixels**, **4.75% of the native frame**. This stricter set is the qualified initial map region. The [mask receipt](phoebe/regional-mask.json) gives the complete row-major 36×24 boolean mask, exact allowed source columns per row, nominal corrected hits and source times, and sampled motion/geometry extrema. [The native mask panel](phoebe/regional-mask.png) shows its spatial extent. These fractions refer to source image pixels, not Phoebe's surface coverage.

Across those 41 pixels, maximum sampled full-exposure center motion is **0.230 km**, with fixed-frame ray motion **0.151 fast sample**. The offset-sensitivity corners displace a center hit by up to **8.09 km**, consistent with the stated coarse position uncertainty. The five time samples and four parameter corners are sampled sensitivities, not continuous-motion extrema or a guaranteed absolute pointing envelope. Pixel owners identify exact original source measurements under the nominal corrected mapping; they do not promise invariant absolute pixel identity over that sensitivity range.

The [small area-scale calculation](phoebe/summarize-region.py) projects the nominal 0.25×0.5 mrad IR aperture onto each accepted center's tangent plane. Individual scales span about **55–97 km²**, median **76 km²**, with a sum of about **3048 km²**. This is only a native physical-area scale estimate. It neither subtracts overlap nor accounts for curvature, occlusion, motion, pointing uncertainty or finite detector response, and must not be presented as mapped/global surface coverage. The subsequent final mapper intersects actual native apertures and sampled acquisition times with the fixed surface, preserves gaps and reports reference-sphere solid-angle support separately in the [final audit](iapetus/phoebe-fixed-map-review.md).

The fit and frozen prediction required about 0.15 s and 0.27 s of scheduled array work, with peak RSS 104.8 and 59.7 MB respectively. The final region/motion/sensitivity calculation took 0.94 s with peak RSS 57.4 MB. All original and mounted terrain hashes remained unchanged.

### Second observation: IR 0650 vertical-edge feasibility

Left clipping leaves the horizontal-edge check underconstrained, but [source-only vertical gradients](phoebe/0650-vertical-candidates.png) reveal two useful families: a coherent upper illuminated limb over columns 0–14 (excluding an internal peak at 11), and lower outer-edge candidates at columns 6, 9, 10, 12, 13, 14, 15. Other strong gradients lie inside craters or in background and remain visible in [the unfiltered candidate receipt](phoebe/0650-vertical-candidates.json). This justifies a separately fitted two-offset investigation; no IR 1822 correction is copied.

The predeclared IR 0650 training set uses top columns 0/1/2 and bottom 12/13/14. Untouched holdouts use top 5/6/7/8/9/10/12/13/14 and bottom 6/9/10. Because adjacent vertical samples belong to different scan lines separated by several seconds, mean-ET projection can serve only as initialization: final fitting/checking must use the archived pose as the interpolated image-boundary position changes. That interpolation must never create detector coverage between scan lines. The [raw detector audit](tethys/1465670650_1-detector-quality.json) independently admits all 1152 pixels for the B9 and continuum bands, with original QUB SHA-256 `26f97b5fd5cff5b9993b919bbac5aa518939604c766db1955283d2d3fc55d558`.

The separately executed [full-timing fit](phoebe/fit-0650-vertical.py) freezes those partitions and uses exactly two constant angular-look offsets. At zero offset, some training columns do not cross the predicted body, so initialization derives a feasible fast-offset interval directly from the training projected shape extents. It does not copy an offset from another observation. Mean-ET projection initializes the numerical solve; the final training objective and all holdouts locate exact fixed-triangle silhouette crossings with the archived camera pose varying along the fractional native-line parameter. Native same-column line midpoints are separated by **8.23464 s**. At the final solution the mean-ET shortcut differs from the full-timing boundary by as much as **0.234 slow sample**, so it cannot be silently substituted.

The [result](phoebe/0650-registration-fit.json) estimates **2.16213 fast / 1.44184 slow sampling steps**, or **0.000535126228 / 0.000713709679 rad**. Six training points have RMS **0.385 slow sample** and Jacobian condition **1.29**. The sampling-only parameter sensitivity is **±0.524 fast / ±0.592 slow sample** under independent ±0.5-slow-sample training edge perturbations. This is a numerical conditioning/sampling result, not physical pointing precision.

**IR 0650 does not pass the present regional registration standard.** All twelve untouched top/bottom holdouts have the same signed residual: source minus predicted boundary is **+0.313 to +1.324 slow samples**, median **+0.760** and RMS **0.819**. Three exceed one slow sample; a slow sampling step is twice the fast angular step in this HI-RES observation. [The exact train/holdout overlay](phoebe/0650-registration-fit.png) shows the consistent displacement. The problem is therefore not a missing second independent edge family or gross two-parameter degeneracy. It is a systematic out-of-training-patch mismatch under this constant-offset/strongest-gradient boundary model. Clean detector codes and calibrated finite pixels do not resolve it.

The current fit is preserved as evidence and is **not used for a science map or source mask**. A further qualification must distinguish physical silhouette position from the irradiance-gradient maximum and/or establish observation tracking/geometry using independent imagery or the final published matched-image solution, then reserve fresh image evidence for validation. Adding unverified scale/rotation/tracking parameters, shifting by the median held-out residual, copying IR 1822's correction or loosening its guard would not establish that evidence. No such adjustment was made. The completed bounded calculation took about **0.88 s**, peak RSS **106.4 MB**, and left source/terrain bytes unchanged.

## Reuse and historical lane resource receipt

The [Nantes data policy](https://vims.univ-nantes.fr/about) explicitly places distributed data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with credit to NASA/Caltech-JPL/University of Arizona/Osuna-CNRS-Nantes Université and citations to Brown et al. 2004 and Le Mouélic et al. 2019. This applies to source numerical cubes, independently of the author-software question above.

The initial intake retained about 2 MB of research input, including ten 64 KiB headers, five page records, small source text, one 232 KB nav cube and one 754 KB static fit file. Subsequent source-model comparison was explicitly scheduled: root restored the exact source models and supplied the task-local NumPy/SciPy runtime. The parent then acquired the two selected complete IR/VIS C/N cohorts, about 4.52 MB combined. This lane's source-model, prediction, fit and region calculations were individually scheduled and bounded, as documented above. That research lane ran no 8.6 MB map-pickle download, mission-archive acquisition, browser, build or bake, and sent no author contact or external message. It wrote only this review, its evidence, and `output/b9-source-intake/phoebe/`; source and scene files were read-only during those checks. Later product conversion, package preparation and mounted review are separate work recorded by the [B9 README](../README.md).
