# (5130) Ilioneus

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

L5 Jupiter Trojan. Source records checked 2026-09-09.

## Sources

| Source | What the view uses |
| --- | --- |
| [DAMIT model 4172](https://damit.cuni.cz/projects/damit/asteroid_models/view/4172), 2019-05-07; [Ďurech et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/182) | Convex light-curve shape and paired sidereal spin. |
| [NEOWISE v2, Gr12b](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html); [Grav et al. (2012)](https://arxiv.org/abs/1209.1549) | Effective spherical diameter 60.711 ± 0.982 km; approximate mesh-volume scale. |

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

- [Recorded qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trojan-population.md#preparation-and-validation) includes source/package checks, [independent mesh/scalar comparisons](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/numerical-summary.json), and fresh source/runtime installation.
- [Headless Chrome](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/browser.json) passed this body at DPR 1/2, Shape/Elevation and both shadow states in `performance` build `c09191cb2d`. Diagnostic APIs were enabled. These focused checks do not establish full-catalog browser or physical-device qualification.
- [Integration of `bd265cf3a`](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/main-integration.json) checked unchanged scene, terrain and image inventories plus non-marker runtime fields. It did not repeat the browser matrix; captures keep their original revision.

## Known problems

- The grid marks unmapped coverage: no registered global reflectance mosaic was found in the selected releases. Convex inversion leaves concavities and fine relief unresolved.
- Transferring thermal diameter to mesh volume is approximate. The quoted fit error excludes additional thermal/shape uncertainty and does not measure local shape accuracy.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- Absolute phase is arbitrary; accelerated display spin is illustrative. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Mesh scale, spin, source alternatives and preparation</summary>

### Shape, scale and orientation

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 0.99999986374790339 source units³; independent triangle-centroid divergence gives 0.99999986374790339. The existing recipe applies a uniform scale of 48.932823982546999 km per source unit. No unit-volume assumption is made. The Elevation reference sphere has radius 30.3555 km.

Original +Z spin axis and +X reference meridian are retained. The selected ecliptic J2000 pole is (307°, -26°), with sidereal period 14.7357 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements; TDB is approximated as TT, under 2 ms.

### Preparation

The [terrestrial recipe](source/preparation/terrestrial.json) reads the original mesh through `source-meshoptimizer` and targets at most 800 native PolyCSS `u` raster triangles with 128 px raster cells. Its error allowance is 607.11 m. Sampled source-fit distances measure preparation error separately from source accuracy; they are not exhaustive Hausdorff bounds.

Shadows and asteroid orbit visibility are off by default. The [family report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trojan-population.md#preparation-and-validation) records source/result comparisons, numerical checks, runtime cases and delivery. [Orbit fixtures](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/orbit-errors.json) sample the epoch and ±30 days; they do not bound the whole interval or establish long-term accuracy.

[Grav et al. (2012), WISE/NEOWISE Observations of the Jovian Trojan Population: Taxonomy](https://arxiv.org/abs/1209.1549).

[Ďurech et al. (2019), Inversion of asteroid photometry from Gaia DR2 and the Lowell Observatory photometric database](https://ui.adsabs.harvard.edu/abs/2019A&A...631A...2D).

</details>
