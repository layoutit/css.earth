# Varda

Varda is a distant binary-system primary whose outline was measured as it eclipsed a star. Its companion’s orbit helps orient this model, but Varda’s depth remains uncertain.

## Sources

One published allowable triaxial model has semiaxes **389, 353 and 248 km** (full axes **778 × 706 × 496 km**). These best-fit values illustrate one solution. The **Shape model** uses the normal unmapped-surface grid. Shadows and Orbit default off.

| Source | Used for |
| --- | --- |
| [Proudfoot et al. (2026), occult3d reanalysis](https://arxiv.org/abs/2605.28636) | Updated satellite orbit and an example triaxial fit. |
| [Souami et al. (2020), occultation chords](https://doi.org/10.1051/0004-6361/202038526) | Five measured chords; used as observations rather than adopting an older spheroidal interpretation. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch. |

The source survey was checked on **2026-09-09**. [Measurements and assumptions](source/measurements.json) retain the numerical extraction; the [source manifest](source/manifest.json) pins the files and their acquisition records. See [NOTICE.md](NOTICE.md) for credits and reuse terms.

## Evidence

The original reports and images below are retained at [commit `5ccf1ea`](https://github.com/layoutit/cssEarth/tree/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds), in their historical `docs/distant-worlds/` location. The PR #99 documentation consolidation and helper relocation reuse them because this body’s measurements, prepared assets and shared runtime bytes are unchanged. These are the original runs, not new captures.

- [Package qualification](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/qualification.json#L210) recorded **480 native `u` raster triangles** and complete source/runtime byte sets. [Fresh source restoration](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/fresh-sources.json#L96) verified **20 files**; checked-in inputs were copied and pinned upstream originals downloaded or reused from a freshly verified download. [Fresh runtime installation](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/fresh-install.json#L1311) checked all **31 assets** for this body against their byte counts and SHA-256 pins. These are closure and acquisition checks, not a claim of output reproduction.
- [Production browser checks](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/browser-validation.json#L253) recorded the default model at **DPR 1 and 2**, with 480 triangles, Shadows and Orbit off, and no forbidden scene leaves. The run used headless Chromium **152.0.7977.84**, a **1440 × 900** viewport and freshly installed assets on **2026-09-10**. Inspect the [original default-view screenshot](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/images/varda.webp) and its [image provenance](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/image-provenance.json). The image shows the selected scientific model, not a resolved photograph.
- [Independent orbital comparison](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/orbit-errors.json#L113) differed from the retained Horizons vector by **0.0211 m** at the scene epoch; the larger checked ±30-day difference was **525.3 km**. The fixed-epoch osculating two-body orbit does not simulate long-term perturbations.
- [Surface-fit sampling](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/surface-fit.json#L155) found a maximum radial deviation of **9.8 km** from the adopted ellipsoid over **3,360** vertex, edge-midpoint and triangle-centroid samples. This finite sampling is neither an exhaustive surface-error bound nor a measurement uncertainty.

## Known problems

The line-of-sight depth is unconstrained, so this is not a uniquely measured body shape. The model assumes the spin pole aligns with Ilmarë’s orbit: J2000 right ascension **272.6°** and declination **−10.8°**. This is a model prior; rotational phase and meridian are illustrative. The grid marks unmapped terrain.

The [shared checks](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/checks.json) retain the outstanding `packages/astronomy/src/bodies.ts` max-lines lint failure. The scoped results above do not establish a full-suite pass.

<details>
<summary>Source survey and model selection</summary>

- **Selected:** The 2026 triaxial example was the most recent qualified numerical fit found in the source survey. Its depth degeneracy is retained.
- **Older interpretation:** The 2020 study offered several Maclaurin interpretations. If spin and satellite orbit are aligned, the 2026 study rules out the older mirror-orbit interpretation supporting the spheroidal fit.
- **Excluded as surface data:** [Astrometry and occultation light curves](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/643/A125) are unresolved time series; they imply neither a spatial surface mosaic nor additional terrain.
- **Excluded from runtime:** [Published occult3d analysis software](https://github.com/benp175/occult3d). The existing ellipsoid preparer consumes the published numbers; it introduces no new fitting or rendering technique.

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../tools/objects/source-authoring/distant-worlds/README.md) explain numerical authoring, acquisition, preparation and the checks above. The existing terrestrial preparer and meshoptimizer turn the adopted analytical ellipsoid into retained PolyCSS native `u` raster triangles; runtime consumes the prepared result.

Edit source interpretation in [measurements](source/measurements.json) and the existing [preparation records](source/preparation/). Trace the generated result through [prepared provenance](prepared/provenance.json) and the [runtime asset inventory](runtime-assets.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
