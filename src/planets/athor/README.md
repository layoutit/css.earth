# (161) Athor

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 461](https://damit.cuni.cz/projects/damit/asteroid_models/view/461) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **461**, version **2012-09-25**. DAMIT, Astronomical Institute of Charles University; Franco et al. (2012); model 461, version 2012-09-25.

Convex light-curve reconstruction with approximate thermal size: 40.84 km (catalog ±0.52 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

## Evidence

The [athor results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **115.86 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Select Franco et al. (2012) model 461 (350,-6), retaining 462 (170,4). The archive and linked Minor Planet Bulletin reference support a convex light-curve shape and two poles, with no physical-size calibration.

No preference is inferred from model ordering.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 462, pole ['170', '4'], [Model 462](https://damit.cuni.cz/projects/damit/asteroid_models/view/462)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1008 vertices and 2012 triangles. Its signed tetrahedral volume is 1.000000064037925 source units³; an independent triangle-centroid divergence sum gives 1.000000064037925. The existing recipe applies one uniform scale of 32.916874998373537 km per source unit so its volume-equivalent diameter is 40.84 km.

No unit-volume assumption is made. Radius above a 20.42 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (350°, -6°), with sidereal period 7.28009 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

[Model fields and mesh measurements](source/reference/damit-model.json).

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/461) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1801/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Franco et al. (2012), Shape and spin axis model for 161 Athor](https://ui.adsabs.harvard.edu/abs/2012MPBu...39..234F) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 40.84 ± 0.52 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 408.4 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
