# 67P/Churyumov–Gerasimenko

Route: `/comet-67p/`. Rosetta’s two-lobed comet, shown with a measured shape,
photographic mosaics and scientific maps.

## Sources

The [source manifest](source/manifest.json) pins input files and metadata.
[NOTICE](NOTICE.md) records credits and reuse terms. The [descriptor](object.json)
and [recipes](source/preparation) specify preparation; [generated provenance](prepared/provenance.json)
connects outputs to inputs, and the [delivery inventory](runtime-assets.json)
identifies the shipped images.

The display preserves the non-convex, two-lobed nucleus as a connected triangle mesh. A longitude/latitude radius field would lose overhangs at the neck; the `radial-terrain` preparation family is used in its **source-meshoptimizer** mode, which retains source connectivity and source vertex positions.

### Source survey, 8 September 2026

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

### Exact inputs

The shape archive is `RO-C-MULTI-5-67P-SHAPE-V2.0`. `source/shape/mtp019.lbl` and `source/reference/esa-model-info.asc` are the original archive metadata. The OBJ is restored from the direct PSA URL in `source/preparation/acquisition.json` and decoded in **kilometres to metres**. The Cheops frame has +Z along the pole, +X defined through the Cheops landmark convention, and a right-handed +Y.

The equivalent reference sphere has diameter 3.3 km (radius 1.65 km), following the selected MTP019 documentation. This is a camera/unit reference, not replacement sphere geometry. The source bounds are approximately 5.060 × 3.715 × 3.311 km. The generic astronomy record uses the Rosetta mass estimate 9.982×10¹² kg ([Pätzold et al., 2016](https://doi.org/10.1038/nature16535)); surface gravity and dust trajectories are not simulated.

The released pole RA 69.4°, Dec +64.1° and pre-perihelion rotation period 12.4041 hours are retained. The display meridian is explicitly arbitrary. The shared scene epoch is JD 2461286.5 (3 September 2026 TT); no extrapolation of Rosetta rotational phase is asserted. `packages/astronomy/tools/generate-comets.mjs` records the exact JPL Horizons elements and independent vector query URLs. Its single-epoch conic supplies prepared placement and an osculating orbit; it is not a long-term perturbation or nongravitational outgassing model.

### Prepared interpretation

- Shape: meshoptimizer 1.2.0 reduces the released mesh to 1,000 closed, consistently wound triangles. It preserves both lobes, the neck and recessed surfaces without a radial resample. `prepared/terrain.json` records topology and the simplifier's estimated error; that estimate is not a Hausdorff bound or the source measurement uncertainty.
- Shape model material: `source/material/neutral.png` is an authored solid gray image, every pixel #b8b6b2. It carries no observed albedo, color or geographic coverage. This remains the default lens; its uniform input is omitted from the surface-map panel.
- OSIRIS mosaic: six calibrated exposures span 2014-08-05T19:44:22.918 UTC to 2014-09-20T13:40:25.993 UTC. The single orange filter supplies grayscale only. Each exposure retains its original attached label and matching quality companion. The September labels identify the GEO inputs as level 5 DDR and their companions as level 4 RDR. The companion L4 image must match every GEO radiance pixel and its observation identity before its quality flags are used. Positive VALID is required, LOSSY is explicitly permitted for visual use, and every other quality flag is rejected before bilinear interpolation.
- OSIRIS transfer: the corrected GEO shape identifier is required by the archive errata. A projective camera fitted from archived XYZ/pixel correspondences must predict the remaining pixels within 0.01 source pixel. Retained triangle texels match the closest original RMOC source triangle within 50 m; every source pixel contributor must lie within 20 m of that matched point, with emission ≤80° and an independent full-RMOC visibility ray. Atlas bleed stays on its own retained face. Grid denotes rejected or absent photography, not uncertainty in the underlying shape.
- OSIRIS compositing: at every accepted point, select the observation with the lowest maximum source emission angle. A robust fit of brightness ratios at matching surface points determines one adjustment per image, within the recipe’s limits, using the first image as the reference. This is a display adjustment, not phase correction. The lossless source-index raster identified by `prepared/osiris-source-index.json` binds every atlas texel to its exposure, with zero for no accepted observation. It is an inspection output, not a browser asset. See [coverage and source survey](../../../docs/comets/67P-OSIRIS-COVERAGE.md).
- OSIRIS illumination: [Fornasier et al. (2015)](https://doi.org/10.1051/0004-6361/201525901) provides the comet-specific Lommel–Seeliger disk-law basis. Radiance is divided by `2 cos(i)/(cos(i)+cos(e))` before interpolation, referenced to zero incidence/emission, with both angles ≤80° and gain ≤3. The first observation supplies one common 1–99% linear grayscale stretch after those brightness adjustments. There is no phase, roughness or cast-shadow recovery; this is relative observed appearance, not measured albedo. Shadows off displays the corrected image uniformly lit; Shadows on adds the prepared Sun lighting. Residual photographed shadows are disclosed beside the lens.
- Relief and lighting: per-texel rays project nearby simplified surface positions onto the original mesh along the local interpolated normal. Original vertex normals and original-mesh shadow rays prepare the modeled lighting. The 150 m search limit is a projection cutoff; fallback texels retain the coarse normal. Reported lighting raster counts include triangle padding, not only visible surface samples. Shadows use the shared epoch and arbitrary rotation phase. In Shape model, Shadows off uses three authored fill lights to inspect the shape.
- Runtime: 1,000 native `u` triangles. Geometry, atlas pixels, light/shadow computation and transforms are prepared. Runtime switches prepared resources through the existing object contract. No tails or dust simulation are included.

The checked context thumbnail is reproducible with the manifest's `radial-snapshot.mjs` recipe and the same prepared faces. Preparation checks its exact bytes. Original photographs and browser images can be compared visually, but their camera poses, dates and optical models differ. They cannot establish a pixel-by-pixel match.

The OSIRIS thumbnail samples the same normalized observation on the same retained
mesh, viewed toward its acquisition camera. Its dedicated flat minimap withholds
ambiguous radial intersections; runtime never uses that map to choose a surface
sheet. [OSIRIS provenance](source/reference/osiris-georeference.json) records the
manual hashes, quality-bit interpretation and correction limits. The
[initial photographic trial](../../../docs/comets/67P-OSIRIS-TRIAL.md) retains its
original unnormalized camera comparison and distinct scope.

### Regions and geological features

Regions uses Thomas et al. (2018), SHAP7 categorical region cells, version 1,
DOI [10.17632/2845znt54k.1](https://doi.org/10.17632/2845znt54k.1), CC BY 4.0.
The 124,938 source triangles carry 26 region IDs; they are sampled onto the
existing 1,000-triangle RMOC display without changing its geometry.

Geology uses European Space Agency (2021), ESA-AURORA_67P-GEOMAP_OSIRIS_V1.0,
DOI [10.5270/esa-kokoti7](https://doi.org/10.5270/esa-kokoti7), and Leon-Dasi,
Besse, Grieger and Küppers (2021), A&A 652 A52,
[10.1051/0004-6361/202140497](https://doi.org/10.1051/0004-6361/202140497).
The Product User Guide §2.1 requests those acknowledgments. The archive's 843
paths and 2,265 feature centres are map symbols in 17 studied regions, mostly
north; their display widths are not measured feature sizes. Missing or unreliable
surface correspondence remains gridded.

See the [geology report](../../../docs/comets/67P-GEOLOGY.md) for the projection checks and symbol rules.

### VIRTIS scientific maps

The Rosetta archive `RO-C-VIRTIS-5-67P-MAPS-V1.0` supplies albedo, spectral
slope, 3.2 µm absorption and modeled ice maps from August–September 2014.
These are separate quantities with separate legends. Modeled ice is a model
result. Registration is approximate; missing samples and ambiguous mapping near
the neck remain gridded. The [VIRTIS report](../../../docs/comets/67P-VIRTIS.md)
contains the decoding and registration method.

## Evidence

These are existing results. No scientific, installation or browser tests were
rerun for this documentation change.

| Check | Recorded result | Report |
| --- | --- | --- |
| Six-image OSIRIS mosaic | Accepted photographed area increased from 56.04% to 56.25% of the displayed mesh. The two added images supply about 1.76% of its area. | [Surface imagery](../../../docs/comets/SURFACE-IMAGERY.md) |
| September image registration | Maximum errors on source pixels withheld from camera fitting were 0.00190 and 0.00161 pixels. Geometry and acceptance limits stayed unchanged. | [Numerical results](../../../docs/comets/evidence/surface-imagery-qualification.json) |
| Source restoration and runtime installation | The four-comet run downloaded 16 new source files and installed 167 runtime files with matching sizes and hashes. Older source inputs were copied. | [Restoration](../../../docs/comets/evidence/surface-imagery-source-restore.json), [installation](../../../docs/comets/evidence/surface-imagery-delivery.json) |
| Browser behavior | The imagery run checked five photographic views at DPR 1 and 2. All 60 comet conformance cases passed; the renderer suite had 367 passes and nine failures. Application revision: `87ddd9680f76082eedd9915e86bda3253311b0f3`. | [Browser checks](../../../docs/comets/evidence/surface-imagery-browser.json), [conformance](../../../docs/comets/evidence/surface-imagery-conformance.json), [validation](../../../docs/comets/evidence/surface-imagery-validation.json) |
| Visual comparison | Previous and new atlases were shown on the same renderer with matching camera and lighting, alongside their absolute RGB difference. | [Images and comparison details](../../../docs/comets/SURFACE-IMAGERY.md#matched-visual-comparisons) |
| VIRTIS and geology | Separate reports describe the scientific quantities, source decoding, registration checks and remaining limits. | [VIRTIS](../../../docs/comets/67P-VIRTIS.md), [geology](../../../docs/comets/67P-GEOLOGY.md) |

The [first photographic integration](../../../docs/comets/67P-OSIRIS-INTEGRATION.md),
[four-image mosaic](../../../docs/comets/67P-OSIRIS-COVERAGE.md) and
[original comet tests](../../../docs/comets/QUALIFICATION.md) keep their earlier
results and tested versions.

## Known problems

- The original [September 13 label](source/reference/n20140913-200612-geo.lbl) and
  [September 20 label](source/reference/n20140920-133916-geo.lbl) confirm those dates,
  but their manifest entries repeat August 5. The recipe's display description
  also still says four photographs despite listing six. Those records need correction.
- The committed comparison images are available, but some original screenshots
  are referenced only through ignored local paths.
- The browser checks changed Shadows through a hidden input. They do not prove
  that a user could open Settings. The recorded full renderer suite was not green.
- The photographs do not cover the whole comet. They retain shadows and seams;
  comparisons against earlier atlases do not establish pixel matching with native
  source photography. The source survey above lists unresolved alternative datasets.
