# (275) Sapientia

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 16284](https://damit.cuni.cz/projects/damit/asteroid_models/view/16284) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **16284**, version **2023-10-03**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2023); model 16284, version 2023-10-03.

Convex light-curve reconstruction scaled by stellar occultations: 103 km volume-equivalent diameter (model range96–109 km). The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [sapientia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **487.83 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The selected convex pole2 is preferred by nine occultation epochs in Marciniak2023 §5.2. Table1 gives103 km with asymmetric size interval96–109 km, accounting for acceptable vertical-shape variations. The archive latitude is −2°, differing by 1° from the paper value −1° (published latitude uncertainty ±20°); the cause of the difference is not established.

The archive period 14.93046 h also differs slightly from the paper 14.93045 ± 0.00005 h; the archived spin is retained. The paper also reports a stronger nonconvex ADAM pole2 shape at100±1 km; DAMIT lists only the two convex solutions and the targeted ISAM release page returned no model rows, so that improved mesh remains unresolved.

It is not substituted by an invented shape.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 16283, pole ['85', '-10'], [Model 16283](https://damit.cuni.cz/projects/damit/asteroid_models/view/16283)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1020 vertices and 2036 triangles. Its signed tetrahedral volume is 572150.5235493955 source units³; an independent triangle-centroid divergence sum gives 572150.5235493955. The existing recipe applies one uniform scale of 0.99999999750287583 km per source unit so its volume-equivalent diameter is 103 km.

No unit-volume assumption is made. Radius above a 51.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (264°, -2°), with sidereal period 14.9305 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/16284) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/126589/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2023)](https://damit.cuni.cz/projects/damit/references/view/667) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 118.86 ± 1.76 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Marciniak et al. (2023), A&A 679, A60, accepted author manuscript](https://winstars.net/wp-content/uploads/2023/09/Marciniak-et-al-2023-AA-Scaling-slowly-rotating-asteroids-stellar-occultations-accepted.pdf) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1030 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
