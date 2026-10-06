# Salacia

Salacia is a large, dark Kuiper-belt world with the moon Actaea. Long-term photometry supports a synchronized binary. This grid-covered illustration uses a separately estimated primary size, not a resolved surface.

## Sources

The spherical illustration uses the primary-only **838 ±44 km** ALMA/NEATM estimate. This value is a **2025 conference-abstract result**, with no resolved three-axis shape. The **Shape model** uses the normal unmapped-surface grid. Shadows defaults off.

| Source | Used for |
| --- | --- |
| [Kiss et al. (2025), EPSC-DPS conference thermal-model result](https://doi.org/10.5194/epsc-dps2025-905) | ALMA separates Salacia and Actaea, with distinct diameters and albedos. |
| [Collyer et al. (2025), synchronous rotation](https://arxiv.org/abs/2509.02734) | Sixteen years of photometry favor albedo variation and a 5.494-day synchronous rotation. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch. |

The source survey was checked on **2026-09-09**. [Measurements and assumptions](source/measurements.json) retain the numerical extraction; the [source manifest](source/manifest.json) pins the files and their acquisition records. See [NOTICE.md](NOTICE.md) for credits and reuse terms.

## Evidence

The original reports and images below are retained, in their historical `docs/distant-worlds/` location. The PR #99 documentation consolidation and helper relocation reuse them because this body’s measurements, prepared assets and shared runtime bytes are unchanged. These are the original runs, not new captures.

- Package qualification recorded **480 native `u` raster triangles** and complete source/runtime byte sets. Fresh source restoration verified **21 files**; checked-in inputs were copied and pinned upstream originals downloaded or reused from a freshly verified download. Fresh runtime installation checked all **31 assets** for this body against their inventory entries. These are closure and acquisition checks, not a claim of output reproduction.
- Re-prepared 2026-10-06: the error allowance now decides the face count, 308 faces at 1.045e+04 m estimated simplifier error; checks and sampled distances recorded here before that date describe the earlier 480-face mesh.
- Production browser checks recorded the default model at **DPR 1 and 2**, with 480 triangles, Shadows and Orbit off, and no forbidden scene leaves. The run used headless Chromium **152.0.7977.84**, a **1440 × 900** viewport and freshly installed assets on **2026-09-10**. Inspect the original default-view screenshot and its image provenance. The image shows the selected scientific model, not a resolved photograph.
- Independent orbital comparison differed from the retained Horizons vector by **0.0036 m** at the scene epoch; the larger checked ±30-day difference was **529.1 km**. The fixed-epoch osculating two-body orbit does not simulate long-term perturbations.
- Surface-fit sampling found a maximum radial deviation of **12.2 km** from the adopted ellipsoid over **3,360** vertex, edge-midpoint and triangle-centroid samples. This finite sampling is neither an exhaustive surface-error bound nor a measurement uncertainty.

## Known problems

The selected diameter retains conference-abstract status. Photometry favors albedo variation rather than a triaxial explanation of the light curve; it does not resolve the surface. The display uses an illustrative ICRF north pole (right ascension 0°, declination +90°), arbitrary prime meridian and phase. No measured body pole or absolute surface attitude is claimed. The grid marks unmapped terrain.

The shared checks retain the outstanding `packages/astronomy/src/bodies.ts` max-lines lint failure. The scoped results above do not establish a full-suite pass.

<details>
<summary>Source survey and model selection</summary>

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../packages/bake/authoring/distant-worlds/README.md) explain numerical authoring, acquisition, preparation and the checks above. The existing terrestrial preparer and meshoptimizer turn the adopted analytical ellipsoid into retained PolyCSS native `u` raster triangles; runtime consumes the prepared result.

Edit source interpretation in [measurements](source/measurements.json) and the existing [preparation records](source/preparation/). Trace the generated result through the [source manifest](source/manifest.json) and the [runtime asset inventory](inventory.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
