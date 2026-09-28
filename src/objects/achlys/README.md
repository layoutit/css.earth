# Achlys

Formerly 2003 AZ84, Achlys is a plutino in Neptune’s 3:2 orbital resonance. Its changing occultation silhouette supports a flattened, elongated model, while a grazing event hints at a local depression.

## Sources

The published Jacobi-ellipsoid interpretation has semiaxes **470 ±20, 383 ±10 and 245 ±8 km** (full axes **940 × 766 × 490 km**). It assumes hydrostatic equilibrium and a **6.75-hour rotation**. The **Shape model** uses the normal unmapped-surface grid. Shadows defaults off.

| Source | Used for |
| --- | --- |
| [Dias-Oliveira et al. (2017), AJ 154, 22, four stellar occultations](https://arxiv.org/abs/1705.10895) | Published three-dimensional Jacobi dimensions constrained by multiple occultations. |
| [WGSBN Bulletin V005, 015](https://www.wgsbn-iau.org/files/Bulletins/V005/WGSBNBull_V005_015.pdf) | Official 2025 name Achlys; 2003 AZ84 remains a search alias. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch. |

The source survey was checked on **2026-09-09**. [Measurements and assumptions](source/measurements.json) retain the numerical extraction; the [source manifest](source/manifest.json) pins the files and their acquisition records. See [NOTICE.md](NOTICE.md) for credits and reuse terms.

## Evidence

The original reports and images below are retained, in their historical `docs/distant-worlds/` location. The PR #99 documentation consolidation and helper relocation reuse them because this body’s measurements, prepared assets and shared runtime bytes are unchanged. These are the original runs, not new captures.

- Package qualification recorded **480 native `u` raster triangles** and complete source/runtime byte sets. Fresh source restoration verified **20 files**; checked-in inputs were copied and pinned upstream originals downloaded or reused from a freshly verified download. Fresh runtime installation checked all **31 assets** for this body against their byte counts and SHA-256 pins. These are closure and acquisition checks, not a claim of output reproduction.
- Production browser checks recorded the default model at **DPR 1 and 2**, with 480 triangles, Shadows and Orbit off, and no forbidden scene leaves. The run used headless Chromium **152.0.7977.84**, a **1440 × 900** viewport and freshly installed assets on **2026-09-10**. Inspect the original default-view screenshot and its image provenance. The image shows the selected scientific model, not a resolved photograph.
- Independent orbital comparison differed from the retained Horizons vector by **0.0062 m** at the scene epoch; the larger checked ±30-day difference was **548.7 km**. The fixed-epoch osculating two-body orbit does not simulate long-term perturbations.
- Surface-fit sampling found a maximum radial deviation of **10.6 km** from the adopted ellipsoid over **3,360** vertex, edge-midpoint and triangle-centroid samples. This finite sampling is neither an exhaustive surface-error bound nor a measurement uncertainty.
- Production search interactions passed both “Achlys” and “2003 AZ84” aliases.

## Known problems

The smooth shape is inferred from occultations, not imaged terrain. The pole is illustrative (right ascension **0°**, declination **90°**) and the meridian arbitrary. The paper’s local projected-limb and opening angles do not provide a unique absolute surface attitude for this display. The grid marks unmapped terrain.

The shared checks retain the outstanding `packages/astronomy/src/bodies.ts` max-lines lint failure. The scoped results above do not establish a full-suite pass.

<details>
<summary>Source survey and model selection</summary>

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../tools/objects/source-authoring/distant-worlds/README.md) explain numerical authoring, acquisition, preparation and the checks above. The existing terrestrial preparer and meshoptimizer turn the adopted analytical ellipsoid into retained PolyCSS native `u` raster triangles; runtime consumes the prepared result.

Edit source interpretation in [measurements](source/measurements.json) and the existing [preparation records](source/preparation/). Trace the generated result through prepared provenance (`prepared/provenance.json`) and the [runtime asset inventory](inventory.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
