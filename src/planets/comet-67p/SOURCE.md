# 67P source and interpretation

The PoC preserves the non-convex, two-lobed nucleus as a connected triangle mesh. A longitude/latitude radius field would lose overhangs at the neck; the `radial-terrain` preparation family is used in its **source-meshoptimizer** mode, which retains source connectivity and source vertex positions.

## Source survey, 8 September 2026

| Candidate | Coverage and access | Decision |
| --- | --- | --- |
| [ESA/RMOC MTP019](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/DOCUMENT/ESA_MODEL_INFO.ASC) | Full nucleus, NAVCAM observations 6 August 2014–25 August 2015. Direct public OBJ; 52,098 vertices and 104,192 triangles in the lower resolution product. | Selected. Public input, frame documentation and reproducible source closure. |
| ESA/RMOC MTP009 | Earlier NAVCAM model; southern areas unconstrained by observations. Same archive documentation. | Superseded by MTP019 for this PoC. |
| [OSIRIS SHAP5](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/DOCUMENT/SHAP5_MODEL_INFO.ASC) | Global stereo-photogrammetric model and several resolution levels in the same PSA collection. | Follow-up candidate for a higher fidelity nucleus; not the input represented here. |
| [DLR SHAP7 and textured model](https://europlanet.dlr.de/Rosetta/) | Global shape and a textured model are described; data access is by contacting the provider. | Access and exact texture registration remain unresolved; no request or redistribution claim made. |
| [MiARD albedo](https://www.miard.eu/homepage/publications/) | Catalog lists a 144 MB release; CORDIS specifies 625 nm. Direct HTTPS timed out, HTTP returned 503, and the Commission report mirror returned HDS-010 on 8 September 2026. | Unresolved: data, registration, coverage and reuse terms could not be inspected. |
| MiARD SHAP8 | Publication route was not successfully retrieved during this survey. | Unresolved, not evidence that a product is unavailable. |
| [NAVCAM, 20 July 2015](https://blogs.esa.int/rosetta/2015/07/28/cometwatch-20-july/) | Dated 1024×1024 display image, range 171 km, scale 14.5 m/pixel, visibly active nucleus. | Retained original observational reference, not a registered texture. |
| [OSIRIS GEO, 5–6 August 2014](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/) | Public calibrated orange-filter radiance with corrected SHAP7 XYZ, angles and a separately matched L4 quality map. | Selected as an optional four-observation grayscale mosaic. Full source camera/quality checks and conservative surface correspondence precede texture transfer. |

## Exact inputs

`source/manifest.json` pins every input by SHA-256 and byte count. `source/shape/mtp019.lbl` and `source/reference/esa-model-info.asc` are the original archive metadata. The OBJ is restored from the direct PSA URL in `source/preparation/acquisition.json` and decoded in **kilometres to metres**. The Cheops frame has +Z along the pole, +X defined through the Cheops landmark convention, and a right-handed +Y.

The equivalent reference sphere has diameter 3.3 km (radius 1.65 km), following the selected MTP019 documentation. This is a camera/unit reference, not replacement sphere geometry. The source bounds are approximately 5.060 × 3.715 × 3.311 km. The generic astronomy record uses the Rosetta mass estimate 9.982×10¹² kg ([Pätzold et al., 2016](https://doi.org/10.1038/nature16535)); surface gravity and dust trajectories are not simulated.

The released pole RA 69.4°, Dec +64.1° and pre-perihelion rotation period 12.4041 hours are retained. The display meridian is explicitly arbitrary. The shared scene epoch is JD 2461286.5 (3 September 2026 TT); no extrapolation of Rosetta rotational phase is asserted. `packages/astronomy/tools/generate-comets.mjs` records the exact JPL Horizons elements and independent vector query URLs. Its single-epoch conic supplies prepared placement and an osculating orbit; it is not a long-term perturbation or nongravitational outgassing model.

## Prepared interpretation

- Shape: meshoptimizer 1.2.0 reduces the released mesh to 1,000 closed, consistently wound triangles. It preserves both lobes, the neck and recessed surfaces without a radial resample. `prepared/terrain.json` records topology and the simplifier's estimated error; that estimate is not a Hausdorff bound or the source measurement uncertainty.
- Shape model material: `source/material/neutral.png` is an authored solid gray image, every pixel #b8b6b2. It carries no observed albedo, color or geographic coverage. This remains the default lens; its uniform input is omitted from the surface-map panel.
- OSIRIS mosaic: four calibrated exposures span 2014-08-05T19:44:22.918 UTC to 2014-08-06T05:20:22.894 UTC. The single orange filter supplies grayscale only. Each exposure retains its original attached label and matching quality companion. The companion L4 image must match every GEO radiance pixel and its observation identity before its quality flags are used. Positive VALID is required, LOSSY is explicitly permitted for visual use, and every other quality flag is rejected before bilinear interpolation.
- OSIRIS transfer: the corrected GEO shape identifier is required by the archive errata. A projective camera fitted from archived XYZ/pixel correspondences must predict the remaining pixels within 0.01 source pixel. Retained triangle texels match the closest original RMOC source triangle within 50 m; every source pixel contributor must lie within 20 m of that matched point, with emission ≤80° and an independent full-RMOC visibility ray. Atlas bleed stays on its own retained face. Grid denotes rejected or absent photography, not uncertainty in the underlying shape.
- OSIRIS compositing: at every accepted point, select the observation with the lowest maximum source emission angle. Robust co-located overlap ratios fit one bounded brightness gain per observation, anchored to the first image. This is a display adjustment, not phase correction. A prepared lossless source-index raster binds every atlas texel to its exposure, with zero for no accepted observation. See [coverage and source survey](../../../docs/comets/67P-OSIRIS-COVERAGE.md).
- OSIRIS illumination: [Fornasier et al. (2015)](https://doi.org/10.1051/0004-6361/201525901) provides the comet-specific Lommel–Seeliger disk-law basis. Radiance is divided by `2 cos(i)/(cos(i)+cos(e))` before interpolation, referenced to zero incidence/emission, with both angles ≤80° and gain ≤3. The first observation supplies one common 1–99% linear grayscale stretch after the bounded overlap-level adjustment. There is no phase, roughness or cast-shadow recovery; this is relative observed appearance, not measured albedo. Shadows off displays the corrected image uniformly lit; Shadows on adds the prepared Sun lighting. Residual photographed shadows are disclosed beside the lens.
- Relief and lighting: per-texel rays project nearby simplified surface positions onto the original mesh along the local interpolated normal. Original vertex normals and original-mesh shadow rays prepare the modeled lighting. The 150 m search limit is a projection cutoff; fallback texels retain the coarse normal. Reported lighting raster counts include triangle padding, not only visible surface samples. Shadows use the shared epoch and arbitrary rotation phase. In Shape model, Shadows off uses three authored fill lights to inspect the shape.
- Runtime: 1,000 native `u` triangles. Geometry, atlas pixels, light/shadow computation and transforms are prepared. Runtime switches prepared resources through the existing object contract. No tails or dust simulation are included.

The checked context thumbnail is reproducible with the manifest's `radial-snapshot.mjs` recipe and the same prepared faces. Preparation checks its exact bytes. Original photographs and the browser are useful qualitative comparisons, but their poses, epoch and optical model are unmatched: **not a pixel-parity oracle**.

The OSIRIS thumbnail samples the same normalized observation on the same retained
mesh, viewed toward its acquisition camera. Its dedicated flat minimap withholds
ambiguous radial intersections; runtime never uses that map to choose a surface
sheet. [OSIRIS provenance](source/reference/osiris-georeference.json) records the
manual hashes, quality-bit interpretation and correction limits. The
[initial photographic trial](../../../docs/comets/67P-OSIRIS-TRIAL.md) retains its
original unnormalized camera comparison and distinct scope.

## Regions and geological features

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

The original source files, SHA-256 pins, download operations and interpretations
are retained under `source/geology/`, `source/manifest.json` and
`source/preparation/`. See `docs/comets/67P-GEOLOGY.md` for the source survey,
projection checks, symbol rules and qualification evidence.

The OSIRIS mosaic now includes corrected September 13 and 20, 2014 orange-filter GEO products and their exact L4 quality companions. They supplement the four August photographs inside the same view. SHAP7 identity, all-pixel companion equality, disjoint camera holdouts, source-distance and visibility gates are unchanged. The added images supply about 1.76% of the displayed area under the existing lowest-emission selection; overall accepted coverage rises modestly from 56.04% to 56.25%. Different illumination and residual seams remain. See [the surface-imagery qualification](../../../docs/comets/SURFACE-IMAGERY.md).
