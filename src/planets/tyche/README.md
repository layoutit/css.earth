# (258) Tyche

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 329](https://damit.cuni.cz/projects/damit/asteroid_models/view/329) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **329**, version **2011-04-21**. DAMIT, Astronomical Institute of Charles University; Hanuš (2011); model 329, version 2011-04-21.

Convex light-curve reconstruction with approximate thermal size: 64.37 km effective diameter (catalog ±0.89 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. Both pole solutions remain possible. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [tyche results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **193.80 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Published convex inversion from Hanuš (2011). The selected archive solution is retained as a reproducible coarse model. An alternative pole remains possible; no unique orientation is claimed.

The release supplies no registered global surface imagery or measured local terrain. AKARI thermal effective diameter provides only an explicit volume-scale approximation.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 330, pole ['40', '-9'], [Model 330](https://damit.cuni.cz/projects/damit/asteroid_models/view/330)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1016 vertices and 2028 triangles. Its signed tetrahedral volume is 0.9999999645722949 source units³; an independent triangle-centroid divergence sum gives 0.9999999645722949. The existing recipe applies one uniform scale of 51.881961652706366 km per source unit so its volume-equivalent diameter is 64.37 km.

No unit-volume assumption is made. Radius above a 32.185 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (224°, -4°), with sidereal period 10.0401 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

[Model fields and mesh measurements](source/reference/damit-model.json).

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/329) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1213/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš (2011), A study of asteroid pole-latitude distribution based on an extended set of shape models derived by the lightcurve inversion method](https://ui.adsabs.harvard.edu/abs/2011A%26A...530A.134H) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 64.37 ± 0.89 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2011), A&A 530, A134](https://arxiv.org/pdf/1104.4114) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 643.7 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
