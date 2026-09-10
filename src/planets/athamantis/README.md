# (230) Athamantis

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 185](https://damit.cuni.cz/projects/damit/asteroid_models/view/185) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **185**, version **2007-02-27**. DAMIT, Astronomical Institute of Charles University; Torppa et al. (2003), Hanuš et al. (2013); model 185, version 2007-02-27.

Convex light-curve reconstruction; 115 km volume-equivalent diameter (±12 km). The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [athamantis results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **438.92 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Hanuš2013 Keck study Table3 independently confirms115±12 km for the first pole and116±12 km for the mirror, based on one adaptive-optics image. DAMIT comment slightly prefers pole(74,+27), selected here. The geometry remains a convex lightcurve model; AO constrains scale and silhouette, not a global photographic surface.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 186, pole ['237', '29'], [Model 186](https://damit.cuni.cz/projects/damit/asteroid_models/view/186)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 796328.21249552199 source units³; an independent triangle-centroid divergence sum gives 796328.21249552199. The existing recipe applies one uniform scale of 1.0000000315374733 km per source unit so its volume-equivalent diameter is 115 km.

No unit-volume assumption is made. Radius above a 57.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (74°, 27°), with sidereal period 23.9845 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/185) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/519/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Torppa et al. (2003)](https://damit.cuni.cz/projects/damit/references/view/106) — original model publication record.
- [Hanuš et al. (2013)](https://damit.cuni.cz/projects/damit/references/view/149) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 108.28 ± 1.18 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2013), Icarus 226, 1045–1057](https://arxiv.org/pdf/1308.0446) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1150 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
