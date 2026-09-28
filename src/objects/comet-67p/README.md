# 67P/Churyumov–Gerasimenko

`/comet-67p/` — Rosetta’s two-lobed comet, shown with a measured shape and mission data.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Shape | ESA/RMOC MTP019 NAVCAM model | Reduced to 1,000 triangles. Default gray is an authored material, not measured color. |
| OSIRIS | Eleven calibrated orange-filter photographs: August 2014, October–November 2015 and April 2016 | Grayscale composite with solar-distance, disk and approximate phase correction; not measured albedo. |
| Albedo, spectral slope, absorption and ice | [Rosetta VIRTIS maps](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-virtis-5-67p-maps-v1.0/) | Reflectivity, its change with wavelength, infrared absorption and modeled ice. Registration near the neck is uncertain. |
| Surface places | [Thomas et al. (2018)](https://doi.org/10.1016/j.pss.2018.05.019) and the [released SHAP7 regional map, v1](https://doi.org/10.17632/2845znt54k.1) | 26 named regional labels, plus the existing Agilkia and Abydos Philae sites. |
| Geology | [ESA OSIRIS geological map, v1.0](https://doi.org/10.5270/esa-kokoti7) | Lines and dots mark mapped features; their display widths are not measured sizes. |

The displayed rotation phase is arbitrary. Grid marks missing or rejected imagery.
Each dataset uses its own source-backed shape: RMOC for the neutral model,
SHAP7 for OSIRIS, regions and geology, and SPC SHAP5 for the four VIRTIS maps.
The shared camera and scene select one prepared mesh at a time.

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. The September 2026 audit checked newer OSIRIS images, later VIRTIS maps, public shape releases and the producer’s geometry-cube route. Unresolved access remains recorded separately from excluded data.

## Evidence

The September 2026 upgrade is measured in [dataset-upgrade.json](evidence/dataset-upgrade.json).
The [independent shape comparison](evidence/source-shape-comparison.json) uses the
original GEO coordinates, before display tessellation. Across eleven frames,
median distance to the old RMOC source is 3.17–8.80 m; to the released SHAP7
source it is 0.31–0.34 m. Each SHAP7 95th percentile is below 1.38 m. These are
model disagreements on sampled detector pixels, not uncertainty estimates.

At 64 samples per retained triangle, weighted by triangle area, the eight existing
images cover 88.85% of the SHAP7 display surface. The final eleven-image
preparation uses 128 samples per triangle and covers 90.81%. The old installed
RMOC preparation reports 80.89% on its different display mesh. The three new
images supply the selected photograph over 17.67% of the SHAP7 surface, with
measured nadir pixel scales 0.62, 0.73 and 1.01 m. Atlas density and mesh reduction
still limit the displayed detail; those source scales do not describe every
displayed texel.

### Delivery, cost and browser checks

All 71 published runtime files were installed into an empty destination and
verified by byte count and SHA-256. The six new original image products were
also restored without local reuse. Against the integrated main revision, the
runtime inventory grows from 28,163,769 to 52,416,035 bytes (28.16 to 52.42 MB).
This is the complete install, including optional lighting assets, not a measured
cold page download. The [integration record](evidence/integration.json) verifies
that main added only its two existing arrival files to the earlier 69-file
audit; all 69 audited files remain byte-identical. The 53 affected tests and five
bake boundary tests, package builds and typechecking passed again after integration.

| Prepared mesh | Visible triangles | Atlas pixels | One decoded RGBA atlas |
| --- | ---: | --- | ---: |
| RMOC neutral model | 1,000 | 1,957 × 2,092 | 16.38 MB |
| SHAP7 OSIRIS, regions and geology | 1,992 | 3,921 × 4,158 | 65.21 MB |
| SPC SHAP5 VIRTIS maps | 1,498 | 2,399 × 2,557 | 24.54 MB |

The mounted scene retains 4,490 `u` leaves across the three banks; exactly one
bank is displayed for every dataset. Decoded atlas figures are width × height ×
4, not measured GPU residency. OSIRIS mean surface area per interior texel
corresponds to 2.61 m, compared with 5.06 m before; it is not uniform resolution.

The [browser record](evidence/dataset-upgrade.json) covers all eight dataset
buttons, rotation and zoom, Shadows through Settings, and the Hapi feature card.
The inspected images come from the restored package in the Codex in-app browser,
1280 × 720. They prove those flows and reveal remaining visual defects; Chrome
DPR 1/2 captures and a matched drag-cadence comparison remain unmeasured. The PR
stays draft pending that visual and performance qualification.

[Whole-body view](evidence/upgrade-osiris.png) ·
[Close-up defects](evidence/upgrade-close.png) ·
[Prepared shadows](evidence/upgrade-shadows.png) ·
[Hapi on SHAP7](evidence/upgrade-hapi.png)

Source, preparation and independent decoder checks passed 40 tests; retained
runtime, URL, text and source-record checks passed 13; bake boundary checks
passed five. Typechecking, affected TypeScript lint, package builds and the
preparation bundle passed. No full site production build was run. The evidence
binds these results to the base commit and hashes of the changed inputs, code
and delivered inventory; documentation-only commits do not change that scope.

### Earlier versions

The records below apply to their stated revisions, not to the new meshes or
eleven-image selection.

- **Label discovery, 2026-09-12:** the [whole-body discovery check](../../../tests/objects/unit/surface-feature-discovery.test.mts) verifies earlier eligibility for the broad surface places. Only the prepared zoom thresholds changed; coordinates, captions, mesh and imagery match the preceding version.

Recorded results for the southern coverage update:

- **Coverage:** estimated accepted area rose from 56.25% to 71.26%, using 24
  deterministic samples per triangle, weighted by area. This measures the displayed
  mesh, not exact coverage of the nucleus. Coverage record.
- **Browser:** 15 conformance cases passed before integration.
  Later production captures at DPR 1 and 2 are recorded separately.
  Conformance · Integration results.
- **Delivery:** a fresh installation verified all 56 runtime assets (21,933,880
  bytes) against their hashes, with no reused local files.
  Delivery record.
- **Surface places, 2026-09-12:** preparation and the runtime parser accepted 28
  places (26 regions and two existing Philae sites). Three focused unit tests
  passed. With this addition, browser checks covered searching
  for Hapi, clicking Seth on the surface, and the Regions dataset.
  [Captured Hapi card](evidence/surface-places.png). The published catalog was
  downloaded and its byte count and SHA-256 verified; surface assets are unchanged.

The wider recorded runs include two missing Europa originals, three Earth fixture
failures and two registry-audit failures. The report
separates those results from the comet checks. Earlier runs are retained below.

- **Reader oracle, 2026-09-12:** [`tools/oracles/pds3/osiris-geo.py`](../../../tests/oracles/pds3/osiris-geo.py) (now [`tests/oracles/pds3/osiris-geo.py`](../../../tests/oracles/pds3/osiris-geo.py)) reads the pinned geometry product `n20140805t194314611id50f22.IMG` and its quality companion with pvl and numpy, not with the pipeline. [`tools/objects/terrestrial-layers/osiris-geo.oracle.test.mts`](../../../tests/objects/terrestrial/osiris-geo.oracle.test.mts) (now [`tests/objects/terrestrial/osiris-geo.oracle.test.mts`](../../../tests/objects/terrestrial/osiris-geo.oracle.test.mts)) requires the decoder to reproduce 48 sampled values from each of the nine geometry planes and from the quality planes exactly, the quality-flag histogram of all 4,194,304 pixels, and the count of finite sigma values.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `osiris` | 11 | 0 | — | — | — | its other 11 frames | 2 of 11 | — | 11 of 11, 0.00° | — | ×1.20 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Surface places use the native, released SHAP7 regional map and Thomas et al.'s
Table 1 names. The 26 regional points are representative on-region locations,
not published centres or boundaries. They are projected within 100 m onto the
matching SHAP7 display mesh and appear only on OSIRIS, regions and geology. The two
Philae sites remain unsized coordinates from their cited ESA release or paper.
Neither set supplies IAU feature nomenclature.

- Photographed shadows, seams and real seasonal differences remain. The composite
  spans a perihelion passage; it cannot measure surface change.
- Phase correction extends the published 1.3–54° fit to the older observations reaching 64°. The new frames are at 41–51°.
  It omits roughness and multiple scattering.
- Close zoom exposes stretched texture, triangle-edge seams and abrupt gray
  rejected patches, especially around the neck. The 1,992-face display remains
  much coarser than the 124,938-face source. Its largest reported closest-point
  displacement is 68.70 m; the simplifier's 46.48 m estimate is not a distance
  bound. These defects remain visible in the retained close-up evidence.
- Browser views compare rendered datasets; they do not establish pixel
  matching with native photographs.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, coordinates and rotation</summary>

The shape archive is `RO-C-MULTI-5-67P-SHAPE-V2.0`. `source/shape/mtp019.lbl` is the original archive label, and
[ESA_MODEL_INFO.ASC](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/DOCUMENT/ESA_MODEL_INFO.ASC) describes the model. The OBJ is restored
from the direct PSA URL in `source/preparation/acquisition.json` and decoded in **kilometres to
metres**.

The Cheops frame has +Z along the pole, +X defined through the Cheops landmark convention, and
a right-handed +Y.

The equivalent reference sphere has diameter 3.3 km (radius 1.65 km), following the selected
MTP019 documentation. This is a camera/unit reference, not replacement sphere geometry. The
source bounds are approximately 5.060 × 3.715 × 3.311 km.

The generic astronomy record uses the Rosetta mass estimate 9.982×10¹² kg ([Pätzold et al.,
2016](https://doi.org/10.1038/nature16535)); surface gravity and dust trajectories are not
simulated.

The released pole RA 69.4°, Dec +64.1° and pre-perihelion rotation period 12.4041 hours are
retained. The display meridian is explicitly arbitrary. The shared scene epoch is JD 2461286.5
(3 September 2026 TT); no extrapolation of Rosetta rotational phase is asserted.

`packages/astronomy/tools/generate-comets.mts` records the exact JPL Horizons elements and
independent vector query URLs. Its single-epoch conic supplies prepared placement and an
osculating orbit; it is not a long-term perturbation or nongravitational outgassing model.

A connected triangle mesh preserves overhangs at the neck. The `radial-terrain` recipe uses
`source-meshoptimizer` mode; a longitude/latitude radius field would lose those overhangs.

#### Shape

meshoptimizer 1.2.0 retains the original connectivity before simplifying each
source separately: 1,000 RMOC triangles, 1,992 SHAP7 triangles and 1,498 SHAP5
triangles. Each remains closed and consistently wound, preserving both lobes,
the neck and recessed surfaces without a radial resample.
The upgrade evidence records each mesh’s topology and simplifier error;
[`evidence/terrain.json`](evidence/terrain.json) preserves the earlier RMOC preparation; that estimate is
not a Hausdorff bound or the source measurement uncertainty.

#### Shape model material

`source/material/neutral.png` is an authored solid gray image, every pixel #b8b6b2. It carries
no observed albedo, color or geographic coverage. This remains the default lens; its uniform
input is omitted from the surface-map panel.

</details>

<details>
<summary>OSIRIS quality flags, registration and lighting</summary>

#### OSIRIS mosaic

Eleven calibrated exposures span 2014-08-05T19:44:22.918 UTC to
2016-04-10T11:50:16.568 UTC: four August 2014, four October–November 2015,
and three April 2016 photographs. The later close-ups improve selected detail
without displacing useful broader coverage.
The single orange filter supplies grayscale only.

The 2015 inputs come from the [MTP022 GEO archive](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-esc4-67p-m22-geo-v1.0/)
and its [L4 radiance and quality archive](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-4-esc4-67pchuryumov-m22-v2.0/).
The April inputs come from the [MTP028 GEO archive](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-osinac-5-ext2-67p-m28-geo-v1.0/)
and its [L4 quality collection](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-osinac-4-ext2-67pchuryumov-m28-v2.0/).
[Feller et al. (2019)](https://doi.org/10.1051/0004-6361/201833807), Table 6,
identifies this observing sequence. Actual acquisition times, filters and
backplane versions come from each selected product’s attached label.
The [ten-header candidate survey](evidence/osiris-april-candidates.json) separates
the three complete image trials from phase-incompatible and deferred products.
The GEO inputs are level 5 DDR, with level 4 RDR companions. Each exposure
retains its original attached label. The companion L4 image must match every GEO
radiance pixel and its observation identity
before its quality flags are used. Positive VALID is required, LOSSY is explicitly
permitted for visual use, and every other quality flag is rejected before bilinear
interpolation. Finite positive, zero and negative radiance remain eligible when
quality, geometry and photometry permit.

#### OSIRIS transfer

The corrected GEO shape identifier is required by the archive errata. A projective
camera fitted from archived XYZ/pixel correspondences must predict the remaining
pixels within 0.01 source pixel. Each retained texel samples the closest full
125K SHAP7 source point. Each bilinear contributor must be within 20 m of that
point, with emission ≤80° and independent visibility on the same full SHAP7
mesh agreeing within 0.5 m. The archive uses the denser 4M SHAP7 release; the
source-shape comparison above measures their disagreement. Camera-fit residuals
check the archived projection, not transfer accuracy. The source-distance
report records display simplification separately; there is no 50 m cutoff on
the photographic closest-point query.

Atlas bleed stays on its own retained face. Grid denotes rejected or absent
photography, not uncertainty in the underlying shape.

#### OSIRIS compositing

At every accepted point, select the qualified observation with the finest
projected surface resolution, accounting for its pixel scale and emission angle.
Brightness never chooses an image. Residual brightness gains use only co-located positive samples
with incidence and emission ≤65°. This restriction applies to the brightness fit;
display pixels retain the 80° limits. The fit requires at least 128 overlap samples,
a median level error ≤0.07 and gains within a 1.35× budget.
The first image is the reference; the eleven-frame trial gains span
0.881–1.044, within the unchanged budget. The fit uses 128 samples per triangle;
an independent 127-sample grid changes every fitted gain by less than 0.54%.
The former 64/63 grids differed by up to 6.01%; denser sampling resolves
that sensitivity without loosening any quality gate.
These residual adjustments follow the disk and phase corrections below.

Preparation emits a lossless source-index raster binding atlas texels to their
selected exposure, with zero for no accepted observation. It is an inspection
output, not a browser asset. [`evidence/osiris-source-index.json`](evidence/osiris-source-index.json)
preserves the earlier mosaic; current per-image selection areas and rejection
counts are in the upgrade evidence.

#### OSIRIS illumination

The [OSIRIS calibration pipeline, §3.13](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/document/calib/osiris_cal_pipeline_v06.pdf)
defines `I/F = π d² radiance / solarFlux`. Solar distance, flux and their units come
from each original calibration HISTORY. Already-normalized inputs are rejected.
This conversion accounts for the different solar distances of the 2014, 2015 and 2016
observations.

[Fornasier et al. (2015)](https://doi.org/10.1051/0004-6361/201525901) provides the
Lommel–Seeliger disk law. Divide by `2 cos(i)/(cos(i)+cos(e))`, referenced to zero
incidence/emission, with both angles ≤80° and gain ≤3. The single-particle
Henyey–Greenstein and shadow-hiding terms in [equations 6 and 8 and Table 4](https://arxiv.org/abs/1505.06888)
use `g = −0.37`, `B0 = 2.5` and `h = 0.079`, normalized to 50°. The phase correction
accepts only 40–70° and at most a 1.5× adjustment in either direction. Corrections
operate on linear source pixels before interpolation.

This single-scattering approximation omits roughness and multiple scattering;
it is not the full Hapke model or measured albedo. Photographed cast shadows and
surface changes remain. All selected surface samples supply the authored 1.9–99.3 percentile range
after residual brightness adjustments. The linear quantity is then sRGB-encoded
once for display.

Shadows off displays the corrected image uniformly lit and remains the default.
Shadows on adds the prepared Sun lighting. Residual photographed shadows are
disclosed beside the lens.

#### Relief and lighting

Per-texel rays project nearby simplified surface positions onto the original mesh
along the local interpolated normal. Original vertex normals and original-mesh
shadow rays prepare the modeled lighting. The 150 m search limit is a projection
cutoff; fallback texels retain the coarse normal.

Reported lighting raster counts include triangle padding, not only visible surface
samples. Shadows use the shared epoch and arbitrary rotation phase. In Shape
model, Shadows off uses three authored fill lights to inspect the shape.

#### Runtime

Three prepared mesh banks share one scene; only the selected bank is visible.
Geometry, atlas pixels, light/shadow computation and
transforms are prepared. Runtime switches prepared resources through the existing
object contract. No tails or dust simulation are included.

The checked context thumbnail is reproducible with the manifest's
`radial-snapshot.mjs` recipe and the same prepared faces. Preparation checks its
exact bytes. Original photographs and browser images can be compared visually,
but their camera poses, dates and optical models differ.

The OSIRIS thumbnail samples the same normalized observation on the same retained
mesh, viewed toward its acquisition camera. Its dedicated flat minimap withholds
ambiguous radial intersections; runtime never uses that map to choose a surface
sheet. [OSIRIS provenance](source/reference/osiris-georeference.json) records the
manuals, quality-bit interpretation and correction limits.

#### September registration results

The retired six-image mosaic included September 13 and 20, 2014 exposures. Maximum
errors on source pixels withheld from camera fitting were 0.00190 and 0.00161
pixels. Their original [September 13](source/reference/n20140913-200612-geo.lbl)
and [September 20](source/reference/n20140920-133916-geo.lbl) labels remain available.
Numerical results.

#### Earlier runs

The six-image report recorded coverage
rising from 56.04% to 56.25%; the September pair supplied an estimated 1.76% of the
displayed area. At that point,
60 comet browser cases passed; the renderer suite had 367 passes and nine failures.
Browser results · Conformance · Suite results.

That four-comet run downloaded 16 new source files and installed 167 runtime files;
sizes and hashes matched, while older inputs were copied.
Restoration · Installation.
Its matched comparisons
include local-only screenshot links. Its Shadows test used a hidden input, so it
did not prove a user could open Settings.

The initial photographic trial retains
its original unnormalized camera comparison. First integration,
four-image mosaic and original tests
retain their earlier versions and results.

</details>

<details>
<summary>Region, geology and VIRTIS interpretation</summary>

Regions uses Thomas et al. (2018), SHAP7 categorical region cells, version 1, DOI
[10.17632/2845znt54k.1](https://doi.org/10.17632/2845znt54k.1), CC BY 4.0. The 124,938 source
triangles carry 26 region IDs. Their own Cartesian geometry now supplies the
1,992-triangle display for regions, geology and OSIRIS. Region transfer returns
to the same source mesh, with a 1 mm identity tolerance rather than the old
50 m registration allowance between different models.

Geology uses European Space Agency (2021), ESA-AURORA_67P-GEOMAP_OSIRIS_V1.0, DOI
[10.5270/esa-kokoti7](https://doi.org/10.5270/esa-kokoti7), and Leon-Dasi, Besse, Grieger and
Küppers (2021), A&A 652 A52,
[10.1051/0004-6361/202140497](https://doi.org/10.1051/0004-6361/202140497). The Product User
Guide §2.1 requests those acknowledgments. The archive's 843 paths and 2,265 feature centres
are map symbols in 17 studied regions, mostly north; their display widths are not measured
feature sizes.

Missing or unreliable surface correspondence remains gridded.

See the geology report for the projection checks and
symbol rules.

The Rosetta archive `RO-C-VIRTIS-5-67P-MAPS-V1.0` supplies albedo, spectral slope, 3.2 µm
absorption and modeled ice maps from August–September 2014. These are separate quantities with
separate legends. Modeled ice is a model result.

The four scalar datasets now use their own 96,834-facet SPC SHAP5 source,
reduced to 1,498 display triangles. The later archived release is not established
as the original VIRTIS pipeline’s SHAP5 v1.1, so angular registration remains
approximate. Missing values, physically rejected values and ambiguous radial
cells remain gridded; the 3×3 cell-footprint and individual-ray checks remain.

A measured alternative confirms that later does not mean better coverage:
the MTP006 albedo table has 166,159 valid cells (64.10%); MTP009 has 45,878
(17.70%), adding only 662 cells while losing 120,943. These are grid-cell counts,
not surface areas or a valid seasonal-change analysis. The current four maps
remain selected. [Original-table comparison](evidence/virtis-albedo-comparison.json). The VIRTIS report contains the decoding and
registration method.

</details>
