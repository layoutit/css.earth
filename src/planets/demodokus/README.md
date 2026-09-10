# (11429) Demodokus

L4 Jupiter Trojan. Source records checked 2026-09-09.

## Sources

| Source | What the view uses |
| --- | --- |
| [DAMIT model 3896](https://damit.cuni.cz/projects/damit/asteroid_models/view/3896), 2019-05-07; [Ďurech et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/182) | Convex light-curve shape and paired sidereal spin. |
| [NEOWISE v2, Gr12b](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html); [Grav et al. (2012)](https://arxiv.org/abs/1209.1549) | Effective spherical diameter 37.63 ± 1.307 km; approximate mesh-volume scale. |

## Evidence

- [Recorded qualification](../../../docs/trojan-population.md#preparation-and-validation) includes source/package checks, [independent mesh/scalar comparisons](../../../docs/evidence/trojan-population/numerical-summary.json), and fresh source/runtime installation.
- [Headless Chrome](../../../docs/evidence/trojan-population/browser.json) passed this body at DPR 1/2, Shape/Elevation and both shadow states in `performance` build `c09191cb2d`. Diagnostic APIs were enabled. These focused checks do not establish full-catalog browser or physical-device qualification.
- [Integration of `bd265cf3a`](../../../docs/evidence/trojan-population/main-integration.json) checked unchanged scene, terrain and image inventories plus non-marker runtime fields. It did not repeat the browser matrix; captures keep their original revision.

## Known problems

- The grid marks unmapped coverage: no registered global reflectance mosaic was found in the selected releases. Convex inversion leaves concavities and fine relief unresolved.
- Transferring thermal diameter to mesh volume is approximate. The quoted fit error excludes additional thermal/shape uncertainty and does not measure local shape accuracy.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- Absolute phase is arbitrary; accelerated display spin is illustrative. Orbit context is fixed at 2026-09-03 TT. The archive also lists an alternative pole.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Mesh scale, spin, source alternatives and preparation</summary>

### Shape, scale and orientation

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 0.99999981810390037 source units³; independent triangle-centroid divergence gives 0.99999981810390037. The existing recipe applies a uniform scale of 30.329630453767152 km per source unit. No unit-volume assumption is made. The Elevation reference sphere has radius 18.815 km.

Original +Z spin axis and +X reference meridian are retained. The selected ecliptic J2000 pole is (117°, -3°), with sidereal period 50.2193 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements; TDB is approximated as TT, under 2 ms.

### Source survey

The [original mesh](https://damit.cuni.cz/projects/damit/stored_files/open/12202/shape.txt) is retained without changing its coordinates or connectivity. [DAMIT documentation](https://damit.cuni.cz/pages/documentation) supplies the coordinate units, pole and sidereal-period conventions; its CC BY 4.0 terms and other credits are linked from [NOTICE.md](NOTICE.md).

Disk-integrated colors do not constrain a regolith map. The selected original Gr12b catalog row marks diameter as fitted (`D` in `FIT_CODE`). The CSV row, original query and column definitions are pinned in [the source manifest](source/manifest.json).

[Hanuš et al. (2023), Table B.3](https://arxiv.org/abs/2308.05380) — adopts this existing DAMIT shape/spin solution. No replacement mesh is required by that survey.

Alternative archive solution: [model 3897](https://damit.cuni.cz/projects/damit/asteroid_models/view/3897), ecliptic pole (306°, -38°).

### Preparation

The [terrestrial recipe](source/preparation/terrestrial.json) reads the original mesh through `source-meshoptimizer` and targets at most 800 native PolyCSS `u` raster triangles with 128 px raster cells. Its error allowance is 376.3 m. Sampled source-fit distances measure preparation error separately from source accuracy; they are not exhaustive Hausdorff bounds.

Shadows and asteroid orbit visibility are off by default. The [family report](../../../docs/trojan-population.md#preparation-and-validation) records source/result comparisons, numerical checks, runtime cases and delivery. [Orbit fixtures](../../../docs/evidence/trojan-population/orbit-errors.json) sample the epoch and ±30 days; they do not bound the whole interval or establish long-term accuracy.

</details>
