# (1647) Menelaus

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

L4 Jupiter Trojan. Source records checked 2026-09-09.

## Sources

| Source | What the view uses |
| --- | --- |
| [DAMIT model 8131](https://damit.cuni.cz/projects/damit/asteroid_models/view/8131), 2022-11-29; [Ďurech & Hanuš (2023)](https://damit.cuni.cz/projects/damit/references/view/665) | Gaia DR3 convex shape and paired sidereal spin. |
| [NEOWISE v2, Gr12b](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html); [Grav et al. (2012)](https://arxiv.org/abs/1209.1549) | Effective spherical diameter 42.716 ± 0.517 km; approximate mesh-volume scale. |

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

- [Recorded qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trojan-population.md#preparation-and-validation) includes source/package checks, [independent mesh/scalar comparisons](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/numerical-summary.json), and fresh source/runtime installation.
- [Headless Chrome](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/browser.json) passed this body at DPR 1/2, Shape/Elevation and both shadow states in `performance` build `c09191cb2d`. Diagnostic APIs were enabled. These focused checks do not establish full-catalog browser or physical-device qualification.
- [Integration of `bd265cf3a`](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/main-integration.json) checked unchanged scene, terrain and image inventories plus non-marker runtime fields. It did not repeat the browser matrix; captures keep their original revision.

## Known problems

- The grid marks unmapped coverage: no registered global reflectance mosaic was found in the selected releases. Convex inversion leaves concavities and fine relief unresolved.
- Transferring thermal diameter to mesh volume is approximate. The quoted fit error excludes additional thermal/shape uncertainty and does not measure local shape accuracy.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- Absolute phase is arbitrary; accelerated display spin is illustrative. Orbit context is fixed at 2026-09-03 TT. The archive also lists an alternative pole.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Mesh scale, spin, source alternatives and preparation</summary>

### Shape, scale and orientation

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 0.99999985677502146 source units³; independent triangle-centroid divergence gives 0.99999985677502157. The existing recipe applies a uniform scale of 34.42892579757789 km per source unit. No unit-volume assumption is made. The Elevation reference sphere has radius 21.358 km.

Original +Z spin axis and +X reference meridian are retained. The selected ecliptic J2000 pole is (327°, 66°), with sidereal period 17.7464 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements; TDB is approximated as TT, under 2 ms.

### Preparation

The [terrestrial recipe](source/preparation/terrestrial.json) reads the original mesh through `source-meshoptimizer` and targets at most 800 native PolyCSS `u` raster triangles with 128 px raster cells. Its error allowance is 427.16 m. Sampled source-fit distances measure preparation error separately from source accuracy; they are not exhaustive Hausdorff bounds.

Shadows and asteroid orbit visibility are off by default. The [family report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trojan-population.md#preparation-and-validation) records source/result comparisons, numerical checks, runtime cases and delivery. [Orbit fixtures](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/orbit-errors.json) sample the epoch and ±30 days; they do not bound the whole interval or establish long-term accuracy.

[Grav et al. (2012), WISE/NEOWISE Observations of the Jovian Trojan Population: Taxonomy](https://arxiv.org/abs/1209.1549).

[Ďurech & Hanuš (2023), Reconstruction of asteroid spin states from Gaia DR3 photometry](https://ui.adsabs.harvard.edu/abs/2023A&A...675A..24D).

</details>
