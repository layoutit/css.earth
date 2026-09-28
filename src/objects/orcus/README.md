# Orcus

Orcus is a large resonant world beyond Neptune, partnered with the substantial moon Vanth. The displayed size belongs to Orcus alone; its smooth shape and grid surface are illustrative.

## Sources

The spherical illustration uses Orcus’s primary-only thermal diameter, **910 +50/−40 km**. ALMA separated the binary components, allowing their thermal fluxes to be modeled separately instead of using a system-equivalent diameter. The **Shape model** uses the normal unmapped-surface grid. Shadows defaults off.

| Source | Used for |
| --- | --- |
| [Brown and Butler (2018), ALMA binary photometry with Spitzer/Herschel thermal modeling](https://arxiv.org/abs/1801.07221) | Orcus’s thermal diameter, excluding Vanth. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch. |

The source survey was checked on **2026-09-09**. [Measurements and assumptions](source/measurements.json) retain the numerical extraction; the [source manifest](source/manifest.json) pins the files and their acquisition records. See [NOTICE.md](NOTICE.md) for credits and reuse terms.

## Evidence

The original reports and images below are retained, in their historical `docs/distant-worlds/` location. The PR #99 documentation consolidation and helper relocation reuse them because this body’s measurements, prepared assets and shared runtime bytes are unchanged. These are the original runs, not new captures.

- Package qualification recorded **480 native `u` raster triangles** and complete source/runtime byte sets. Fresh source restoration verified **20 files**; checked-in inputs were copied and pinned upstream originals downloaded or reused from a freshly verified download. Fresh runtime installation checked all **31 assets** for this body against their byte counts and SHA-256 pins. These are closure and acquisition checks, not a claim of output reproduction.
- Production browser checks recorded the default model at **DPR 1 and 2**, with 480 triangles, Shadows and Orbit off, and no forbidden scene leaves. The run used headless Chromium **152.0.7977.84**, a **1440 × 900** viewport and freshly installed assets on **2026-09-10**. Inspect the original default-view screenshot and its image provenance. The image shows the selected scientific model, not a resolved photograph.
- Independent orbital comparison differed from the retained Horizons vector by **0.0168 m** at the scene epoch; the larger checked ±30-day difference was **540.8 km**. The fixed-epoch osculating two-body orbit does not simulate long-term perturbations.
- Surface-fit sampling found a maximum radial deviation of **14.4 km** from the adopted ellipsoid over **3,360** vertex, edge-midpoint and triangle-centroid samples. This finite sampling is neither an exhaustive surface-error bound nor a measurement uncertainty.

## Known problems

ALMA did not resolve Orcus’s terrain or measure three shape axes. The display uses an illustrative ICRF north pole (right ascension 0°, declination +90°), arbitrary prime meridian and phase. No measured body pole or absolute surface attitude is claimed. The grid marks unmapped terrain.

The shared checks retain the outstanding `packages/astronomy/src/bodies.ts` max-lines lint failure. The scoped results above do not establish a full-suite pass.

<details>
<summary>Source survey and model selection</summary>

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../packages/bake/authoring/distant-worlds/README.md) explain numerical authoring, acquisition, preparation and the checks above. The existing terrestrial preparer and meshoptimizer turn the adopted analytical ellipsoid into retained PolyCSS native `u` raster triangles; runtime consumes the prepared result.

Edit source interpretation in [measurements](source/measurements.json) and the existing [preparation records](source/preparation/). Trace the generated result through prepared provenance (`prepared/provenance.json`) and the [runtime asset inventory](inventory.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
