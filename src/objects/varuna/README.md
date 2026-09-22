# Varuna

Varuna’s rapid rotation and changing brightness reveal an elongated world beyond Neptune. This smooth model follows a published light-curve fit; its absolute size remains approximate.

## Sources

The published Jacobi fit has **b/a = 0.60** and **c/b = 0.72**, scaled to the paper’s adopted approximate **700 km volume-equivalent diameter**. The resulting full axes are approximately **1098 × 659 × 474 km**; this is an illustrative scale model. The **Shape model** uses the normal unmapped-surface grid. Shadows defaults off.

| Source | Used for |
| --- | --- |
| [Fernández-Valenzuela et al. (2019), ApJL, multi-epoch rotational photometry](https://arxiv.org/abs/1909.04698) | Three-dimensional axis ratios, pole interpretations, period and approximate model scale. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch. |

The source survey was checked on **2026-09-09**. [Measurements and assumptions](source/measurements.json) retain the numerical extraction; the [source manifest](source/manifest.json) pins the files and their acquisition records. See [NOTICE.md](NOTICE.md) for credits and reuse terms.

## Evidence

The original reports and images below are retained at [commit `5ccf1ea`](https://github.com/layoutit/cssEarth/tree/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds), in their historical `docs/distant-worlds/` location. The PR #99 documentation consolidation and helper relocation reuse them because this body’s measurements, prepared assets and shared runtime bytes are unchanged. These are the original runs, not new captures.

- [Package qualification](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/qualification.json#L176) recorded **480 native `u` raster triangles** and complete source/runtime byte sets. [Fresh source restoration](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/fresh-sources.json#L82) verified **19 files**; checked-in inputs were copied and pinned upstream originals downloaded or reused from a freshly verified download. [Fresh runtime installation](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/fresh-install.json#L1094) checked all **31 assets** for this body against their byte counts and SHA-256 pins. These are closure and acquisition checks, not a claim of output reproduction.
- [Production browser checks](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/browser-validation.json#L213) recorded the default model at **DPR 1 and 2**, with 480 triangles, Shadows and Orbit off, and no forbidden scene leaves. The run used headless Chromium **152.0.7977.84**, a **1440 × 900** viewport and freshly installed assets on **2026-09-10**. Inspect the [original default-view screenshot](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/images/varuna.webp) and its [image provenance](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/image-provenance.json). The image shows the selected scientific model, not a resolved photograph.
- [Independent orbital comparison](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/orbit-errors.json#L95) differed from the retained Horizons vector by **0.0026 m** at the scene epoch; the larger checked ±30-day difference was **548.7 km**. The fixed-epoch osculating two-body orbit does not simulate long-term perturbations.
- [Surface-fit sampling](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/surface-fit.json#L130) found a maximum radial deviation of **14.9 km** from the adopted ellipsoid over **3,360** vertex, edge-midpoint and triangle-centroid samples. This finite sampling is neither an exhaustive surface-error bound nor a measurement uncertainty.
- [Production interactions](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/final-interactions.json) passed a native mouse click on Varuna’s visible prepared marker to navigate to ʻOumuamua.

## Known problems

The smooth axes are inferred, not resolved terrain. The display uses one published pole interpretation: ecliptic longitude **53° ±10°** and latitude **−64° ±6°**, converted with the J2000 mean obliquity. The antipodal pole is also allowed. Equinox and meridian are display conventions, not a qualified absolute attitude. The grid marks unmapped terrain.

The [shared checks](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/checks.json) retain the outstanding `packages/astronomy/src/bodies.ts` max-lines lint failure. The scoped results above do not establish a full-suite pass.

<details>
<summary>Source survey and model selection</summary>

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../tools/objects/source-authoring/distant-worlds/README.md) explain numerical authoring, acquisition, preparation and the checks above. The existing terrestrial preparer and meshoptimizer turn the adopted analytical ellipsoid into retained PolyCSS native `u` raster triangles; runtime consumes the prepared result.

Edit source interpretation in [measurements](source/measurements.json) and the existing [preparation records](source/preparation/). Trace the generated result through prepared provenance (`prepared/provenance.json`) and the [runtime asset inventory](runtime-assets.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
