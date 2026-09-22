# 2I/Borisov

The second known interstellar visitor, found in August 2019, passed the Sun on 8 December 2019 and was the first clearly active interstellar comet. No image resolves its nucleus; this view shows a sphere of estimated size.

## Sources

| Source | Used for |
| --- | --- |
| [Hui et al. (2020), AJ 160, 92](https://doi.org/10.3847/1538-3881/ab9df8) | Nucleus radius "most likely ≲0.4 km", from the non-gravitational acceleration and CO production, assuming density 0.5 g/cm³. |
| [Jewitt et al. (2020), ApJL 888, L23](https://doi.org/10.3847/2041-8213/ab621b) | Bounds: Hubble coma modelling limits the radius to at most 0.5 km (albedo 0.04); the acceleration requires at least 0.2 km (density 500 kg/m³). |
| [Kim et al. (2020), ApJL 895, L34](https://doi.org/10.3847/2041-8213/ab9228) | Rotation pole RA 205°, Dec 52° (obliquity 30°), fitted to coma anisotropy. |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position at the fixed 2026-09-03 scene epoch: eccentricity 3.35, 48.10 au from the Sun. |

The display is a **0.4 km sphere** (800 m across): an estimate inside the published bounds, not a measured size or shape. No elongation or period was published. It is turned so its pole points at RA 205°, Dec 52°; the prime meridian and spin phase are arbitrary. [Measurements and assumptions](source/measurements.json) retain the numbers; the [source manifest](source/manifest.json) pins the files. See [NOTICE.md](NOTICE.md) for credits.

## Evidence

- The prepared sphere has 480 native `u` raster triangles.
- The [default view](evidence/default-view.webp) was captured in headless Chromium 148.0.7778.96 at 1440 × 900 with no page errors or failed requests.
- The two-body path differs from the retained Horizons vectors by **527.71 km** and **521.57 km** 30 days either side of the scene epoch; `packages/astronomy/src/asteroids.test.ts` bounds it at 607 km.

## Known problems

The radius could be anywhere from about 0.2 to 0.5 km. The pole fit depends on a model of the coma's sublimation, and the period is unknown. The 2020 outburst and fragments, the coma and the tail are not shown. The osculating orbit omits non-gravitational acceleration beyond the scene epoch. The grid marks unmapped terrain.

<details>
<summary>Source survey and model selection</summary>

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../tools/objects/source-authoring/distant-worlds/README.md) explain numerical authoring, acquisition, preparation and checks; this body's inputs are in [the interstellar input table](../../../tools/objects/source-authoring/interstellar/inputs.json). The existing terrestrial preparer and meshoptimizer turn the sphere into native PolyCSS `u` raster triangles.

Edit source interpretation in [measurements](source/measurements.json) and the [preparation records](source/preparation/). Trace the generated result through prepared provenance (`prepared/provenance.json`) and the [runtime asset inventory](inventory.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
