# (227) Philosophia

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1873](https://damit.cuni.cz/projects/damit/asteroid_models/view/1873) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1873**, version **2018-03-22**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2018); model 1873, version 2018-03-22.

Convex light-curve reconstruction; 101 km volume-equivalent diameter (±5 km). The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [philosophia results](../../../docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **458.58 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Marciniak2018 section5.2 and Table7 select the convex pole(95,+19) as the best thermal fit (chi-square1.2). Table7 reports101±5 km equivalent-volume diameter, with errors spanning the full3-sigma range. This primary publication scale supersedes DAMIT’s107±5 km field. The paper also presents SAGE nonconvex alternatives, but the selected convex solution gives the best thermal fit; no multichord occultation supports those concavities.

Shape and thermal fit are explicitly the least constrained of the five studied targets; neither is a resolved terrain map.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 1874, pole ['272', '-1'], [Model 1874](https://damit.cuni.cz/projects/damit/asteroid_models/view/1874)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 641431.04283826763 source units³; an independent triangle-centroid divergence sum gives 641431.04283826763. The existing recipe applies one uniform scale of 0.94392521991833334 km per source unit so its volume-equivalent diameter is 101 km.

No unit-volume assumption is made. Radius above a 50.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (95°, 19°), with sidereal period 26.4614 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1873) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/6154/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2018)](https://damit.cuni.cz/projects/damit/references/view/174) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 95.61 ± 1.56 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Marciniak et al. (2018), A&A 610, A7](https://arxiv.org/pdf/1711.01893) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1010 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
