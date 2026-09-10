# (188) Menippe

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 327](https://damit.cuni.cz/projects/damit/asteroid_models/view/327) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **327**, version **2011-04-21**. DAMIT, Astronomical Institute of Charles University; Hanuš (2011); model 327, version 2011-04-21.

Convex light-curve reconstruction. Published thermophysical scale: 35.3 ±0.9 km. An alternative pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [menippe results](../../../docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **115.13 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

A publication scale is transferred uniformly to the archived mesh of the same nominal pole family. Identity of every vertex with the publication fit is not established. No local topographic or material accuracy follows from the diameter uncertainty.

An alternative pole remains possible. Select Hanuš (2011) nominal pole1 model327 (32,48), with328 (198,25) retained. Hanuš et al. (2018), TableA.3, explicitly gives VS-TPM volume-equivalent35.3 ±0.9 km for this nominal pole and period11.9765 h; use this shape-aware calibration instead of AKARI39.33 ±0.44 km.

The varied-shape ensemble does not establish identical mesh bytes or local shape accuracy, and its alternative pole remains possible.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 328, pole ['198', '25'], [Model 328](https://damit.cuni.cz/projects/damit/asteroid_models/view/328)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.0000000121974248 source units³; an independent triangle-centroid divergence sum gives 1.0000000121974251. The existing recipe applies one uniform scale of 28.451657872711699 km per source unit so its volume-equivalent diameter is 35.3 km.

No unit-volume assumption is made. Radius above a 17.65 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (32°, 48°), with sidereal period 11.9765 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/327) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1204/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš (2011)](https://damit.cuni.cz/projects/damit/references/view/141) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 39.33 ± 0.44 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2011), original light-curve inversion study](https://arxiv.org/pdf/1104.4114) — retained primary publication; see the body-specific selection and calibration above.
- [Hanuš et al. (2018), VS-TPM size study, Table A.3](https://arxiv.org/pdf/1803.06116) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 353 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
