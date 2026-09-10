# (286) Iclea

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5017](https://damit.cuni.cz/projects/damit/asteroid_models/view/5017) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **5017**, version **2023-10-03**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2023); model 5017, version 2023-10-03.

Convex light-curve reconstruction scaled by stellar occultations: 86 km volume-equivalent diameter (model range79–99 km). The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [iclea results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **274.33 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Marciniak2023 §5.3 prefers pole1(31,13) based on the only available three-chord occultation, agreement with independent period/pole recovery, and inconsistent smaller size for pole2. Table1 gives volume-equivalent86 km with asymmetric interval79–99 km; these limits reflect model vertical-stretch variation, not Gaussian local surface error.

The archive keeps the larger13 km side as a symmetric error field; the actual asymmetric range is preserved here.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 16295, pole ['196', '44'], [Model 16295](https://damit.cuni.cz/projects/damit/asteroid_models/view/16295)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 994 vertices and 1984 triangles. Its signed tetrahedral volume is 333038.14017642365 source units³; an independent triangle-centroid divergence sum gives 333038.14017642359. The existing recipe applies one uniform scale of 1.0000000026378641 km per source unit so its volume-equivalent diameter is 86 km.

No unit-volume assumption is made. Radius above a 43 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (31°, 13°), with sidereal period 15.3612 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

[Model fields and mesh measurements](source/reference/damit-model.json).

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/5017) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/127591/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2023), Scaling slowly rotating asteroids with stellar occultations](https://ui.adsabs.harvard.edu/abs/2023A&A...679A..60M) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 109.11 ± 1.49 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Marciniak et al. (2023), A&A 679, A60, accepted author manuscript](https://winstars.net/wp-content/uploads/2023/09/Marciniak-et-al-2023-AA-Scaling-slowly-rotating-asteroids-stellar-occultations-accepted.pdf) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 860 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
