# (164) Eva

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1021](https://damit.cuni.cz/projects/damit/asteroid_models/view/1021) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1021**, version **2016-01-04**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2016); model 1021, version 2016-01-04.

Convex light-curve reconstruction with approximate thermal size: 97.7 km (catalog ±1.56 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. The grid marks unavailable imagery.

## Evidence

The [eva results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **394.57 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. The 2016 archive supplies one convex solution (54,-10). The 2021 ASAS-SN (54,-15) estimate agrees at broad-pole level; retain selected nominal coordinates/spin and an explicit AKARI size approximation.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. The survey found no alternative archive solution for this target.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.0000000395765907 source units³; an independent triangle-centroid divergence sum gives 1.0000000395765907. The existing recipe applies one uniform scale of 78.745805914874381 km per source unit so its volume-equivalent diameter is 97.7 km.

No unit-volume assumption is made. Radius above a 48.85 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (54°, -10°), with sidereal period 13.6638 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

[Model fields and mesh measurements](source/reference/damit-model.json).

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1021) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/3796/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2016), New and updated convex shape models of asteroids based on optical data from a large collaboration network](https://ui.adsabs.harvard.edu/abs/2016A%26A...586A.108H) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 97.7 ± 1.56 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2016), new and updated convex models](https://arxiv.org/pdf/1510.07422) — retained primary publication; see the body-specific selection and calibration above.
- [Hanuš et al. (2021), ASAS-SN photometry](https://arxiv.org/pdf/2107.10027) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 977 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
