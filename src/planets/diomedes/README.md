# (1437) Diomedes

L4 Jupiter Trojan. Source records checked 2026-09-09.

## Sources

| Source | What the view uses |
| --- | --- |
| [DAMIT model 4215](https://damit.cuni.cz/projects/damit/asteroid_models/view/4215), 2019-05-07; [Ďurech et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/182) | Original convex mesh; archive spin is retained for reference. |
| [Dutra et al. (2025)](https://doi.org/10.1098/rsta.2024.0187) | Same-mesh occultation fit: 118.8 ± 0.6 km volume-equivalent diameter, with refined pole and period. |

## Evidence

- [Recorded qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trojan-population.md#preparation-and-validation) includes source/package checks, [independent mesh/scalar comparisons](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/numerical-summary.json), and fresh source/runtime installation.
- [Headless Chrome](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/browser.json) passed this body at DPR 1/2, Shape/Elevation and both shadow states in `performance` build `c09191cb2d`. Diagnostic APIs were enabled. These focused checks do not establish full-catalog browser or physical-device qualification.
- [Integration of `bd265cf3a`](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/main-integration.json) checked unchanged scene, terrain and image inventories plus non-marker runtime fields. It did not repeat the browser matrix; captures keep their original revision.

## Known problems

- The grid marks unmapped coverage: no registered global reflectance mosaic was found in the selected releases. Convex inversion leaves concavities and fine relief unresolved.
- Three occultation chords constrain the silhouette of an inverse model. They do not resolve local terrain, albedo, craters or regolith.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- Absolute phase is arbitrary; accelerated display spin is illustrative. Orbit context is fixed at 2026-09-03 TT.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Mesh scale, spin, source alternatives and preparation</summary>

### Shape, scale and orientation

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 0.99999995101356143 source units³; independent triangle-centroid divergence gives 0.99999995101356143. The existing recipe applies a uniform scale of 95.752323632100087 km per source unit. No unit-volume assumption is made. The Elevation reference sphere has radius 59.4 km.

Original +Z spin axis and +X reference meridian are retained. The selected ecliptic J2000 pole is (153.73°, 12.69°), with sidereal period 24.4984 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements; TDB is approximated as TT, under 2 ms.

### Source survey

The [original mesh](https://damit.cuni.cz/projects/damit/stored_files/open/13159/shape.txt) is retained without changing its coordinates or connectivity. [DAMIT documentation](https://damit.cuni.cz/pages/documentation) supplies the coordinate units, pole and sidereal-period conventions; its CC BY 4.0 terms and other credits are linked from [NOTICE.md](NOTICE.md).

Disk-integrated colors do not constrain a regolith map. The selected original Gr12b catalog row marks diameter as fitted (`D` in `FIT_CODE`). The CSV row, original query and column definitions are pinned in [the source manifest](source/manifest.json). The [NEOWISE v2 definitions](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html) and [Grav et al. (2012)](https://arxiv.org/abs/1209.1549) describe those thermal records; the selected physical scale comes from the occultation fit.

The original archive pole (150°, 5°) and period 24.4987 h remain in [damit-model.json](source/reference/damit-model.json). The [Dutra et al. (2025)](https://doi.org/10.1098/rsta.2024.0187) occultation fit drives the presentation. [Hanuš et al. (2023)](https://arxiv.org/abs/2308.05380) proposed a different shape/133 ± 5 km fit whose numerical mesh remains unresolved; the later same-mesh fit is used here.

The selected archive query lists no alternative model for this target.

### Preparation

The [terrestrial recipe](source/preparation/terrestrial.json) reads the original mesh through `source-meshoptimizer` and targets at most 800 native PolyCSS `u` raster triangles with 128 px raster cells. Its error allowance is 1188 m. Sampled source-fit distances measure preparation error separately from source accuracy; they are not exhaustive Hausdorff bounds.

Shadows and asteroid orbit visibility are off by default. The [family report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trojan-population.md#preparation-and-validation) records source/result comparisons, numerical checks, runtime cases and delivery. [Orbit fixtures](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/trojan-population/orbit-errors.json) sample the epoch and ±30 days; they do not bound the whole interval or establish long-term accuracy.

</details>
