# 67P source and interpretation

The PoC preserves the non-convex, two-lobed nucleus as a connected triangle mesh. A longitude/latitude radius field would lose overhangs at the neck; the `radial-terrain` preparation family is used in its **source-meshoptimizer** mode, which retains source connectivity and source vertex positions.

## Source survey, 8 September 2026

| Candidate | Coverage and access | Decision |
| --- | --- | --- |
| [ESA/RMOC MTP019](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/DOCUMENT/ESA_MODEL_INFO.ASC) | Full nucleus, NAVCAM observations 6 August 2014–25 August 2015. Direct public OBJ; 52,098 vertices and 104,192 triangles in the lower resolution product. | Selected. Public input, frame documentation and reproducible source closure. |
| ESA/RMOC MTP009 | Earlier NAVCAM model; southern areas unconstrained by observations. Same archive documentation. | Superseded by MTP019 for this PoC. |
| [OSIRIS SHAP5](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/DOCUMENT/SHAP5_MODEL_INFO.ASC) | Global stereo-photogrammetric model and several resolution levels in the same PSA collection. | Follow-up candidate for a higher fidelity nucleus; not the input represented here. |
| [DLR SHAP7 and textured model](https://europlanet.dlr.de/Rosetta/) | Global shape and a textured model are described; data access is by contacting the provider. | Access and exact texture registration remain unresolved; no request or redistribution claim made. |
| MiARD SHAP8 | Publication route was not successfully retrieved during this survey. | Unresolved, not evidence that a product is unavailable. |
| [NAVCAM, 20 July 2015](https://blogs.esa.int/rosetta/2015/07/28/cometwatch-20-july/) | Dated 1024×1024 display image, range 171 km, scale 14.5 m/pixel, visibly active nucleus. | Retained original observational reference, not a registered texture. |

## Exact inputs

`source/manifest.json` pins every input by SHA-256 and byte count. `source/shape/mtp019.lbl` and `source/reference/esa-model-info.asc` are the original archive metadata. The OBJ is restored from the direct PSA URL in `source/preparation/acquisition.json` and decoded in **kilometres to metres**. The Cheops frame has +Z along the pole, +X defined through the Cheops landmark convention, and a right-handed +Y.

The equivalent reference sphere has diameter 3.3 km (radius 1.65 km), following the selected MTP019 documentation. This is a camera/unit reference, not replacement sphere geometry. The source bounds are approximately 5.060 × 3.715 × 3.311 km. The generic astronomy record uses the Rosetta mass estimate 9.982×10¹² kg ([Pätzold et al., 2016](https://doi.org/10.1038/nature16535)); surface gravity and dust trajectories are not simulated.

The released pole RA 69.4°, Dec +64.1° and pre-perihelion rotation period 12.4041 hours are retained. The display meridian is explicitly arbitrary. The shared scene epoch is JD 2461286.5 (3 September 2026 TT); no extrapolation of Rosetta rotational phase is asserted. `packages/astronomy/tools/generate-comets.mjs` records the exact JPL Horizons elements and independent vector query URLs. Its single-epoch conic supplies prepared placement and an osculating orbit; it is not a long-term perturbation or nongravitational outgassing model.

## Prepared interpretation

- Shape: meshoptimizer 1.2.0 reduces the released mesh to 1,000 closed, consistently wound triangles. It preserves both lobes, the neck and recessed surfaces without a radial resample. `prepared/terrain.json` records topology and the simplifier's estimated error; that estimate is not a Hausdorff bound or the source measurement uncertainty.
- Material: `source/material/neutral.png` is an authored solid gray image, every pixel #b8b6b2. It carries no observed albedo, color or geographic coverage. The only lens is **Shape model**; its uniform input is omitted from the surface-map panel.
- Relief and lighting: per-texel rays project nearby simplified surface positions onto the original mesh along the local interpolated normal. Original vertex normals and original-mesh shadow rays generate two immutable atlases. The 150 m search limit is a projection cutoff; fallback texels retain the coarse normal. Reported raster counts include triangle padding, not only visible surface samples. Shadows use the shared epoch and arbitrary rotation phase; Shadows off uses three authored fill lights to inspect the shape.
- Runtime: 1,000 native `u` triangles. Geometry, atlas pixels, light/shadow computation and transforms are prepared. Runtime switches prepared resources through the existing object contract. No tails or dust simulation are included.

The checked context thumbnail is reproducible with the manifest's `radial-snapshot.mjs` recipe and the same prepared faces. Preparation checks its exact bytes. Original photographs and the browser are useful qualitative comparisons, but their poses, epoch and optical model are unmatched: **not a pixel-parity oracle**.
