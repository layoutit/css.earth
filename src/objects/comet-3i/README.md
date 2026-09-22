# 3I/ATLAS

The third known interstellar visitor, found in July 2025, passed the Sun on 29 October 2025 on an open, hyperbolic path. This view shows an elongated body of its measured brightness, not a resolved image.

## Sources

| Source | Used for |
| --- | --- |
| [Hui et al. (2026), ApJL, Hubble WFC3 nucleus photometry](https://doi.org/10.3847/2041-8213/ae471c) ([arXiv:2601.21569](https://arxiv.org/abs/2601.21569)) | Effective radius 1.3 ± 0.2 km (V-band absolute magnitude 17.1 ± 0.4, assumed geometric albedo 0.04) and a sky-plane axis ratio of at least 2:1 from brightness changes of at least 0.8 mag. Program GO/DD 18152, December 2025 to January 2026. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch: eccentricity 6.12, 10.88 au from the Sun. |

No shape model, pole or rotation period has been published. The display shape is a prolate ellipsoid at exactly the minimum 2:1 ratio. The paper's absolute magnitude averages the object's brightness, which corresponds to the geometric mean of its largest and smallest cross-sections, so the ellipsoid is sized to make that mean equal π × (1.3 km)². Its full axes are **4.37 × 2.19 × 2.19 km** (volume-equivalent radius 1.38 km). A larger axis ratio, another albedo or a non-ellipsoidal body would all change it. [Measurements and assumptions](source/measurements.json) retain the numbers; the [source manifest](source/manifest.json) pins the files. See [NOTICE.md](NOTICE.md) for credits.

## Evidence

- The prepared ellipsoid has **480 native `u` raster triangles**, reduced by meshoptimizer from the 5° analytical grid.
- The two-body path differs from the retained Horizons vectors by **964.45 km** and **872.87 km** 30 days either side of the scene epoch; `packages/astronomy/src/asteroids.test.ts` bounds it at 1,110 km.
- The [default view](evidence/default-view.webp) was captured in headless Chromium 148.0.7778.96 at 1440 × 900 with no page errors; the factsheet shows the display extents and the rotation limit.

## Known problems

The pole, meridian and spin phase are arbitrary. The size scales with the assumed albedo (radius ∝ 1/√albedo). The coma and tail are not shown. The Horizons osculating orbit omits the fitted non-gravitational acceleration beyond the scene epoch. The grid marks unmapped terrain.

<details>
<summary>Source survey and model selection</summary>

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../tools/objects/source-authoring/distant-worlds/README.md) explain numerical authoring, acquisition, preparation and checks; this body's inputs are in [the interstellar input table](../../../tools/objects/source-authoring/interstellar/inputs.json). The existing terrestrial preparer and meshoptimizer turn the ellipsoid into native PolyCSS `u` raster triangles.

Edit source interpretation in [measurements](source/measurements.json) and the [preparation records](source/preparation/). Trace the generated result through prepared provenance (`prepared/provenance.json`) and the [runtime asset inventory](runtime-assets.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
