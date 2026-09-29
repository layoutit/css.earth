# ʻOumuamua

The first confirmed interstellar visitor crossed the Solar System in 2017. Its changing brightness supports competing shape interpretations; this view shows one published disc-like fit, with size set by an assumed reflectivity.

## Sources

The selected DISC light-curve model has full axes **115 × 111 × 19 m**, assuming geometric albedo 0.1. The **Shape model** uses the normal unmapped-surface grid. Shadows defaults off.

| Source | Used for |
| --- | --- |
| [Mashchenko (2019), MNRAS 489, 3003–3021, §4 and Table 1](https://doi.org/10.1093/mnras/stz2378) | Published DISC fit and its assumed reflectivity. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch. |

The source survey was checked on **2026-09-09**. [Measurements and assumptions](source/measurements.json) retain the numerical extraction; the [source manifest](source/manifest.json) pins the files and their acquisition records. See [NOTICE.md](NOTICE.md) for credits and reuse terms.

## Evidence

The original reports and images below are retained, in their historical `docs/distant-worlds/` location. The PR #99 documentation consolidation and helper relocation reuse them because this body’s measurements, prepared assets and shared runtime bytes are unchanged. These are the original runs, not new captures.

- Package qualification recorded **480 native `u` raster triangles** and complete source/runtime byte sets. Fresh source restoration verified **19 files**; checked-in inputs were copied and pinned upstream originals downloaded or reused from a freshly verified download. Fresh runtime installation checked all **31 assets** for this body against their inventory entries. These are closure and acquisition checks, not a claim of output reproduction.
- Production browser checks recorded the default model at **DPR 1 and 2**, with 480 triangles, Shadows and Orbit off, and no forbidden scene leaves. The run used headless Chromium **152.0.7977.84**, a **1440 × 900** viewport and freshly installed assets on **2026-09-10**. Inspect the original default-view screenshot and its image provenance. The image shows the selected scientific model, not a resolved photograph.
- Independent orbital comparison differed from the retained Horizons vector by **0.0491 m** at the scene epoch; the larger checked ±30-day difference was **529.9 km**. The finite open drawing window is a display extent, not a physical bound; the osculating two-body path omits long-term perturbations and non-gravitational acceleration.
- Surface-fit sampling found a maximum radial deviation of **1.85 m** from the adopted ellipsoid over **3,360** vertex, edge-midpoint and triangle-centroid samples. This finite sampling is neither an exhaustive surface-error bound nor a measurement uncertainty.
- Production interactions passed the Varuna marker click to ʻOumuamua, opt-in Shadows paint and the mobile scene/card layout; inspect the mobile view and Shadows-on view. Scoped conformance passed desktop, mobile and dataset interactions at DPR 1/2.
- The production DPR 2 drag comparison retained all nodes and requested no new interaction assets: 16.7 ms p95 animation-frame interval versus 16.8 ms for the existing 480-face reference. Different appearance and projected area limit the comparison; these headless results do not establish performance on every device.

## Known problems

The same study permits a **324 × 42 × 42 m CIGAR** solution. These are competing inferred shapes; no resolved silhouette or surface map exists, and size depends on the assumed albedo. The display pole and meridian are arbitrary. ʻOumuamua tumbles; this static view does not reconstruct its 2017 attitude or claim a current spin phase. The grid marks unmapped terrain.

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
