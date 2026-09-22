# 67P/Churyumov–Gerasimenko

`/comet-67p/` — Rosetta’s two-lobed comet, shown with a measured shape and mission data.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Shape | ESA/RMOC MTP019 NAVCAM model | Reduced to 1,000 triangles. Default gray is an authored material, not measured color. |
| OSIRIS | Eight calibrated orange-filter photographs: August 2014 and October–November 2015 | Grayscale composite with solar-distance, disk and approximate phase correction; not measured albedo. |
| Albedo, spectral slope, absorption and ice | [Rosetta VIRTIS maps](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-virtis-5-67p-maps-v1.0/) | Reflectivity, its change with wavelength, infrared absorption and modeled ice. Registration near the neck is uncertain. |
| Surface places | [Thomas et al. (2018)](https://doi.org/10.1016/j.pss.2018.05.019) and the [released SHAP7 regional map, v1](https://doi.org/10.17632/2845znt54k.1) | 26 named regional labels, plus the existing Agilkia and Abydos Philae sites. |
| Geology | [ESA OSIRIS geological map, v1.0](https://doi.org/10.5270/esa-kokoti7) | Lines and dots mark mapped features; their display widths are not measured sizes. |

The displayed rotation phase is arbitrary. Grid marks missing or rejected imagery.
The [southern coverage report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/67P-SOUTHERN-OSIRIS.md) describes
the current eight-image selection and its calibration.

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

- **Label discovery, 2026-09-12:** the [whole-body discovery check](../../../tests/objects/unit/surface-feature-discovery.test.mts) verifies earlier eligibility for the broad surface places. Only the prepared zoom thresholds changed; coordinates, captions, mesh and imagery match the preceding version.

Recorded results for the southern coverage update:

- **Coverage:** estimated accepted area rose from 56.25% to 71.26%, using 24
  deterministic samples per triangle, weighted by area. This measures the displayed
  mesh, not exact coverage of the nucleus. [Coverage record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/67p-southern/coverage.json).
- **Browser:** 15 conformance cases passed before integration with `7ae81ba2d`.
  Later production captures at DPR 1 and 2 are recorded separately.
  [Conformance](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/67p-southern/conformance.json) · [Integration results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/67p-southern/integration.json).
- **Delivery:** a fresh installation verified all 56 runtime assets (21,933,880
  bytes) against their hashes, with no reused local files.
  [Delivery record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/67p-southern/runtime-delivery.json).
- **Surface places, 2026-09-12:** preparation and the runtime parser accepted 28
  places (26 regions and two existing Philae sites). Three focused unit tests
  passed. On base `53b262bd` with this addition, browser checks covered searching
  for Hapi, clicking Seth on the surface, and the Regions dataset.
  [Captured Hapi card](evidence/surface-places.png). The published catalog was
  downloaded and its byte count and SHA-256 verified; surface assets are unchanged.

The wider recorded runs include two missing Europa originals, three Earth fixture
failures and two registry-audit failures. The [report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/67P-SOUTHERN-OSIRIS.md#verification-records)
separates those results from the comet checks. Earlier runs are retained below.

- **Reader oracle, 2026-09-12:** `tools/oracles/pds3/osiris-geo.py` reads the pinned geometry product `n20140805t194314611id50f22.IMG` and its quality companion with pvl and numpy, not with the pipeline. `tools/objects/terrestrial-layers/osiris-geo.oracle.test.mts` requires the decoder to reproduce 48 sampled values from each of the nine geometry planes and from the quality planes exactly, the quality-flag histogram of all 4,194,304 pixels, and the count of finite sigma values.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `osiris` | 8 | 0 | — | — | — | its other 8 frames | 2 of 8 | — | 5 of 8, -0.50° | — | ×1.14 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Surface places use the native, released SHAP7 regional map and Thomas et al.'s
Table 1 names. The 26 regional points are representative on-region locations,
not published centres or boundaries. They transfer to the unchanged 1,000-triangle
RMOC display mesh only when the point is within 100 m of that surface. The two
Philae sites remain unsized coordinates from their cited ESA release or paper.
Neither set supplies IAU feature nomenclature.

- Photographed shadows, seams and real seasonal differences remain. The composite
  spans a perihelion passage; it cannot measure surface change.
- Phase correction extends the published 1.3–54° fit to observations at 47–64°.
  It omits roughness and multiple scattering.
- The matched browser crops compare atlas versions; they do not establish pixel
  matching with native photographs.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, coordinates and rotation</summary>

The shape archive is `RO-C-MULTI-5-67P-SHAPE-V2.0`. `source/shape/mtp019.lbl` and
`source/reference/esa-model-info.asc` are the original archive metadata. The OBJ is restored
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

meshoptimizer 1.2.0 reduces the released mesh to 1,000 closed, consistently wound triangles. It
preserves both lobes, the neck and recessed surfaces without a radial resample.
[`evidence/terrain.json`](evidence/terrain.json) records topology and the simplifier's estimated error; that estimate is
not a Hausdorff bound or the source measurement uncertainty.

#### Shape model material

`source/material/neutral.png` is an authored solid gray image, every pixel #b8b6b2. It carries
no observed albedo, color or geographic coverage. This remains the default lens; its uniform
input is omitted from the surface-map panel.

</details>

<details>
<summary>OSIRIS quality flags, registration and lighting</summary>

#### OSIRIS mosaic

Eight calibrated exposures span 2014-08-05T19:44:22.918 UTC to
2015-11-15T05:08:11.274 UTC. Four August 2014 photographs remain; four
October–November 2015 photographs replace the earlier September close-ups.
The single orange filter supplies grayscale only.

The new inputs come from the [MTP022 GEO archive](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-esc4-67p-m22-geo-v1.0/)
and its [L4 radiance and quality archive](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-4-esc4-67pchuryumov-m22-v2.0/).
The southern GEO inputs are level 5 DDR, with level 4 RDR companions. Each exposure
retains its original attached label. The companion L4 image must match every GEO
radiance pixel and its observation identity
before its quality flags are used. Positive VALID is required, LOSSY is explicitly
permitted for visual use, and every other quality flag is rejected before bilinear
interpolation. Finite positive, zero and negative radiance remain eligible when
quality, geometry and photometry permit.

#### OSIRIS transfer

The corrected GEO shape identifier is required by the archive errata. A projective
camera fitted from archived XYZ/pixel correspondences must predict the remaining
pixels within 0.01 source pixel. Retained triangle texels match the closest original
RMOC source triangle within 50 m; every source pixel contributor must lie within
20 m of that point, with emission ≤80° and an independent full-RMOC visibility ray
agreeing within 0.5 m. The largest recorded camera holdout residual is below 0.0025
source pixel. No geometry limit was relaxed for the southern images.

Atlas bleed stays on its own retained face. Grid denotes rejected or absent
photography, not uncertainty in the underlying shape.

#### OSIRIS compositing

At every accepted point, select the observation with the lowest maximum source
emission angle. Residual brightness gains use only co-located positive samples
with incidence and emission ≤65°. This restriction applies to the brightness fit;
display pixels retain the 80° limits. The fit requires at least 128 overlap samples,
a median absolute deviation of log ratios ≤0.25 and gains within a 1.35× budget.
The first image is the reference; final gains range from 0.908 to 1.157.

The fit uses 64 samples per triangle. An independent set of 63 disjoint samples
produces gains within 0.8% of those values. [Calibration check](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/67p-southern/calibration.json).
These residual adjustments follow the disk and phase corrections below.

The lossless source-index raster identified by [`evidence/osiris-source-index.json`](evidence/osiris-source-index.json)
binds every atlas texel to its exposure, with zero for no accepted observation.
It is an inspection output, not a browser asset.

#### OSIRIS illumination

The [OSIRIS calibration pipeline, §3.13](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/document/calib/osiris_cal_pipeline_v06.pdf)
defines `I/F = π d² radiance / solarFlux`. Solar distance, flux and their units come
from each original calibration HISTORY. Already-normalized inputs are rejected.
This conversion accounts for the different solar distances of the 2014 and 2015
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
surface changes remain. The first observation supplies one common 1–99% linear
grayscale stretch after the residual brightness adjustments.

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

1,000 native `u` triangles. Geometry, atlas pixels, light/shadow computation and
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
manual hashes, quality-bit interpretation and correction limits.

#### September registration results

The retired six-image mosaic included September 13 and 20, 2014 exposures. Maximum
errors on source pixels withheld from camera fitting were 0.00190 and 0.00161
pixels. Their original [September 13](source/reference/n20140913-200612-geo.lbl)
and [September 20](source/reference/n20140920-133916-geo.lbl) labels remain available.
[Numerical results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/surface-imagery-qualification.json).

#### Earlier runs

The [six-image report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/SURFACE-IMAGERY.md) recorded coverage
rising from 56.04% to 56.25%; the September pair supplied an estimated 1.76% of the
displayed area. At application commit [87ddd9680f](https://github.com/layoutit/cssEarth/commit/87ddd9680f76082eedd9915e86bda3253311b0f3),
60 comet browser cases passed; the renderer suite had 367 passes and nine failures.
[Browser results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/surface-imagery-browser.json) · [Conformance](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/surface-imagery-conformance.json) · [Suite results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/surface-imagery-validation.json).

That four-comet run downloaded 16 new source files and installed 167 runtime files;
sizes and hashes matched, while older inputs were copied.
[Restoration](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/surface-imagery-source-restore.json) · [Installation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/surface-imagery-delivery.json).
Its [matched comparisons](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/SURFACE-IMAGERY.md#matched-visual-comparisons)
include local-only screenshot links. Its Shadows test used a hidden input, so it
did not prove a user could open Settings.

The [initial photographic trial](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/67P-OSIRIS-TRIAL.md) retains
its original unnormalized camera comparison. [First integration](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/67P-OSIRIS-INTEGRATION.md),
[four-image mosaic](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/67P-OSIRIS-COVERAGE.md) and [original tests](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/QUALIFICATION.md)
retain their earlier versions and results.

</details>

<details>
<summary>Region, geology and VIRTIS interpretation</summary>

Regions uses Thomas et al. (2018), SHAP7 categorical region cells, version 1, DOI
[10.17632/2845znt54k.1](https://doi.org/10.17632/2845znt54k.1), CC BY 4.0. The 124,938 source
triangles carry 26 region IDs; they are sampled onto the existing 1,000-triangle RMOC display
without changing its geometry.

Geology uses European Space Agency (2021), ESA-AURORA_67P-GEOMAP_OSIRIS_V1.0, DOI
[10.5270/esa-kokoti7](https://doi.org/10.5270/esa-kokoti7), and Leon-Dasi, Besse, Grieger and
Küppers (2021), A&A 652 A52,
[10.1051/0004-6361/202140497](https://doi.org/10.1051/0004-6361/202140497). The Product User
Guide §2.1 requests those acknowledgments. The archive's 843 paths and 2,265 feature centres
are map symbols in 17 studied regions, mostly north; their display widths are not measured
feature sizes.

Missing or unreliable surface correspondence remains gridded.

See the [geology report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/67P-GEOLOGY.md) for the projection checks and
symbol rules.

The Rosetta archive `RO-C-VIRTIS-5-67P-MAPS-V1.0` supplies albedo, spectral slope, 3.2 µm
absorption and modeled ice maps from August–September 2014. These are separate quantities with
separate legends. Modeled ice is a model result.

Registration is approximate; missing samples and ambiguous mapping near the neck remain
gridded. The [VIRTIS report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/67P-VIRTIS.md) contains the decoding and
registration method.

</details>
