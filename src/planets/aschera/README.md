# (214) Aschera

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1435](https://damit.cuni.cz/projects/damit/asteroid_models/view/1435) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1435**, version **2016-01-12**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2016); model 1435, version 2016-01-12.

Convex light-curve reconstruction with approximate thermal size: 26.07 km effective diameter (catalog ±0.34 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [aschera results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **117.39 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Ďurech2016 table reports 386 Lowell sparse measurements and a period identified by the ellipsoid method before convex reconstruction. Two poles remain. Select1435 as a reproducible representative and label the shape as coarse lightcurve inversion. The thermal scale is approximate.

Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 1436, pole ['306', '-42'], [Model 1436](https://damit.cuni.cz/projects/damit/asteroid_models/view/1436)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.000000046371027 source units³; an independent triangle-centroid divergence sum gives 1.000000046371027. The existing recipe applies one uniform scale of 21.012314795817147 km per source unit so its volume-equivalent diameter is 26.07 km.

No unit-volume assumption is made. Radius above a 13.035 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (123°, -37°), with sidereal period 6.8337 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

[Model fields and mesh measurements](source/reference/damit-model.json).

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1435) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/5059/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2016), Asteroid models from the Lowell Photometric Database](https://ui.adsabs.harvard.edu/abs/2016A%26A...587A..48D) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 26.07 ± 0.34 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2016), A&A 587, A48](https://arxiv.org/pdf/1601.02909) — retained primary publication; see the body-specific selection and calibration above.
- [Usui et al. (2011), PASJ 63, 1117–1138](https://arxiv.org/pdf/1106.1948) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 260.7 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
