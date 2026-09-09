# 67P/Churyumov–Gerasimenko

`/comet-67p/` — Rosetta’s two-lobed comet, shown with a measured shape and mission data.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Shape | ESA/RMOC MTP019 NAVCAM model | Reduced to 1,000 triangles. Default gray is an authored material, not measured color. |
| OSIRIS | Six calibrated orange-filter photographs, August–September 2014 | Grayscale appearance with approximate illumination correction; not measured albedo. |
| Albedo, spectral slope, absorption and ice | [Rosetta VIRTIS maps](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-virtis-5-67p-maps-v1.0/) | Reflectivity, its change with wavelength, infrared absorption and modeled ice. Registration near the neck is uncertain. |
| Regions | [Thomas et al. (2018), v1](https://doi.org/10.17632/2845znt54k.1) | 26 named regions transferred from SHAP7 to the display mesh. |
| Geology | [ESA OSIRIS geological map, v1.0](https://doi.org/10.5270/esa-kokoti7) | Lines and dots mark mapped features; their display widths are not measured sizes. |

The displayed rotation phase is arbitrary. Photographic shadows and seams remain;
grids mark missing or rejected imagery.

## Evidence

Existing reports; no body tests were rerun for this documentation edit.

- **Coverage:** 56.25% of the displayed mesh has accepted photography, up from 56.04%.
  The two September images supply 1.76% of the area. [Mosaic report](../../../docs/comets/SURFACE-IMAGERY.md).
- **Browser:** 60 comet cases passed; the renderer suite had 367 passes and nine failures.
  Tested application: [87ddd9680f](https://github.com/layoutit/cssEarth/commit/87ddd9680f76082eedd9915e86bda3253311b0f3).
  [Browser results](../../../docs/comets/evidence/surface-imagery-browser.json) · [Conformance](../../../docs/comets/evidence/surface-imagery-conformance.json) · [Suite results](../../../docs/comets/evidence/surface-imagery-validation.json).
- **Files:** the four-comet run downloaded 16 new source files and installed 167 runtime files;
  sizes and hashes matched. Older inputs were copied.
  [Restoration](../../../docs/comets/evidence/surface-imagery-source-restore.json) · [Installation](../../../docs/comets/evidence/surface-imagery-delivery.json).
- **Images:** earlier and new atlases were compared with matching renderer settings.
  [Comparisons and differences](../../../docs/comets/SURFACE-IMAGERY.md#matched-visual-comparisons).
  [VIRTIS checks](../../../docs/comets/67P-VIRTIS.md) · [Geology checks](../../../docs/comets/67P-GEOLOGY.md).

## Known problems

- September 13/20 inputs have August 5 dates in the manifest. The recipe still describes
  four photographs although it lists six. The original labels disagree with those records.
- Some original screenshot links point to local-only files.
- Tests changed Shadows through a hidden input; they did not prove a user could open Settings.
- These comparisons do not establish pixel matching with native photographs.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

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

`packages/astronomy/tools/generate-comets.mjs` records the exact JPL Horizons elements and
independent vector query URLs. Its single-epoch conic supplies prepared placement and an
osculating orbit; it is not a long-term perturbation or nongravitational outgassing model.

A connected triangle mesh preserves overhangs at the neck. The `radial-terrain` recipe uses
`source-meshoptimizer` mode; a longitude/latitude radius field would lose those overhangs.

#### Shape

meshoptimizer 1.2.0 reduces the released mesh to 1,000 closed, consistently wound triangles. It
preserves both lobes, the neck and recessed surfaces without a radial resample.
`prepared/terrain.json` records topology and the simplifier's estimated error; that estimate is
not a Hausdorff bound or the source measurement uncertainty.

#### Shape model material

`source/material/neutral.png` is an authored solid gray image, every pixel #b8b6b2. It carries
no observed albedo, color or geographic coverage. This remains the default lens; its uniform
input is omitted from the surface-map panel.

</details>

<details>
<summary>OSIRIS quality flags, registration and lighting</summary>

#### OSIRIS mosaic

Six calibrated exposures span 2014-08-05T19:44:22.918 UTC to 2014-09-20T13:40:25.993 UTC. The
single orange filter supplies grayscale only. Each exposure retains its original attached label
and matching quality companion.

The September labels identify the GEO inputs as level 5 DDR and their companions as level 4
RDR. The companion L4 image must match every GEO radiance pixel and its observation identity
before its quality flags are used. Positive VALID is required, LOSSY is explicitly permitted
for visual use, and every other quality flag is rejected before bilinear interpolation.

#### OSIRIS transfer

The corrected GEO shape identifier is required by the archive errata. A projective camera
fitted from archived XYZ/pixel correspondences must predict the remaining pixels within 0.01
source pixel. Retained triangle texels match the closest original RMOC source triangle within
50 m; every source pixel contributor must lie within 20 m of that matched point, with emission
≤80° and an independent full-RMOC visibility ray.

Atlas bleed stays on its own retained face. Grid denotes rejected or absent photography, not
uncertainty in the underlying shape.

#### OSIRIS compositing

At every accepted point, select the observation with the lowest maximum source emission angle.
A robust fit of brightness ratios at matching surface points determines one adjustment per
image, within the recipe’s limits, using the first image as the reference. This is a display
adjustment, not phase correction.

The lossless source-index raster identified by `prepared/osiris-source-index.json` binds every
atlas texel to its exposure, with zero for no accepted observation. It is an inspection output,
not a browser asset. See [coverage and source
survey](../../../docs/comets/67P-OSIRIS-COVERAGE.md).

#### OSIRIS illumination

[Fornasier et al. (2015)](https://doi.org/10.1051/0004-6361/201525901) provides the
comet-specific Lommel–Seeliger disk-law basis. Radiance is divided by `2
cos(i)/(cos(i)+cos(e))` before interpolation, referenced to zero incidence/emission, with both
angles ≤80° and gain ≤3. The first observation supplies one common 1–99% linear grayscale
stretch after those brightness adjustments.

There is no phase, roughness or cast-shadow recovery; this is relative observed appearance, not
measured albedo. Shadows off displays the corrected image uniformly lit; Shadows on adds the
prepared Sun lighting. Residual photographed shadows are disclosed beside the lens.

#### Relief and lighting

Per-texel rays project nearby simplified surface positions onto the original mesh along the
local interpolated normal. Original vertex normals and original-mesh shadow rays prepare the
modeled lighting. The 150 m search limit is a projection cutoff; fallback texels retain the
coarse normal.

Reported lighting raster counts include triangle padding, not only visible surface samples.
Shadows use the shared epoch and arbitrary rotation phase. In Shape model, Shadows off uses
three authored fill lights to inspect the shape.

#### Runtime

1,000 native `u` triangles. Geometry, atlas pixels, light/shadow computation and transforms are
prepared. Runtime switches prepared resources through the existing object contract.

No tails or dust simulation are included.

The checked context thumbnail is reproducible with the manifest's `radial-snapshot.mjs` recipe
and the same prepared faces. Preparation checks its exact bytes. Original photographs and
browser images can be compared visually, but their camera poses, dates and optical models
differ.

They cannot establish a pixel-by-pixel match.

The OSIRIS thumbnail samples the same normalized observation on the same retained mesh, viewed
toward its acquisition camera. Its dedicated flat minimap withholds ambiguous radial
intersections; runtime never uses that map to choose a surface sheet. [OSIRIS
provenance](source/reference/osiris-georeference.json) records the manual hashes, quality-bit
interpretation and correction limits.

The [initial photographic trial](../../../docs/comets/67P-OSIRIS-TRIAL.md) retains its original
unnormalized camera comparison and distinct scope.

#### September registration results

Maximum errors on source pixels withheld from camera fitting were 0.00190 and 0.00161 pixels.
[Numerical results](../../../docs/comets/evidence/surface-imagery-qualification.json).

The [September 13](source/reference/n20140913-200612-geo.lbl) and [September
20](source/reference/n20140920-133916-geo.lbl) labels contain the observation dates used to
identify the manifest disagreement above.

#### Earlier runs

[First integration](../../../docs/comets/67P-OSIRIS-INTEGRATION.md), [four-image
mosaic](../../../docs/comets/67P-OSIRIS-COVERAGE.md) and [original
tests](../../../docs/comets/QUALIFICATION.md) retain their earlier versions and results.

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

See the [geology report](../../../docs/comets/67P-GEOLOGY.md) for the projection checks and
symbol rules.

The Rosetta archive `RO-C-VIRTIS-5-67P-MAPS-V1.0` supplies albedo, spectral slope, 3.2 µm
absorption and modeled ice maps from August–September 2014. These are separate quantities with
separate legends. Modeled ice is a model result.

Registration is approximate; missing samples and ambiguous mapping near the neck remain
gridded. The [VIRTIS report](../../../docs/comets/67P-VIRTIS.md) contains the decoding and
registration method.

</details>

<details>
<summary>Alternative sources considered — 8 September 2026</summary>

| Candidate | Coverage and access | Decision |
| --- | --- | --- |
| [ESA/RMOC MTP019](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/DOCUMENT/ESA_MODEL_INFO.ASC) | Full nucleus, NAVCAM observations 6 August 2014–25 August 2015. Direct public OBJ; 52,098 vertices and 104,192 triangles in the lower resolution product. | Selected. The model is publicly downloadable and its coordinate frame is documented; the acquisition recipe verifies the file hash. |
| ESA/RMOC MTP009 | Earlier NAVCAM model; southern areas unconstrained by observations. Same archive documentation. | Superseded by MTP019 for this display. |
| [OSIRIS SHAP5](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/DOCUMENT/SHAP5_MODEL_INFO.ASC) | Global stereo-photogrammetric model and several resolution levels in the same PSA collection. | Follow-up candidate for a higher fidelity nucleus; not the input represented here. |
| [DLR SHAP7 and textured model](https://europlanet.dlr.de/Rosetta/) | Global shape and a textured model are described; data access is by contacting the provider. | Access and exact texture registration remain unresolved; no request or redistribution claim made. |
| [MiARD albedo](https://www.miard.eu/homepage/publications/) | Catalog lists a 144 MB release; CORDIS specifies 625 nm. Direct HTTPS timed out, HTTP returned 503, and the Commission report mirror returned HDS-010 on 8 September 2026. | Unresolved: data, registration, coverage and reuse terms could not be inspected. |
| MiARD SHAP8 | Publication route was not successfully retrieved during this survey. | Unresolved, not evidence that a product is unavailable. |
| [NAVCAM, 20 July 2015](https://blogs.esa.int/rosetta/2015/07/28/cometwatch-20-july/) | Dated 1024×1024 display image, range 171 km, scale 14.5 m/pixel, visibly active nucleus. | Retained original observational reference, not a registered texture. |
| [OSIRIS GEO, 5–6 August 2014](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/) | Public calibrated orange-filter radiance with corrected SHAP7 XYZ, angles and a separately matched L4 quality map. | Selected for the grayscale mosaic, later expanded with two September observations. Full source camera/quality checks and conservative surface correspondence precede texture transfer. |

</details>
