# (276) Adelheid

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 189](https://damit.cuni.cz/projects/damit/asteroid_models/view/189) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **189**, version **2011-03-28**. DAMIT, Astronomical Institute of Charles University; A. Marciniak (2007), Ďurech et al. (2011), Hanuš et al. (2013); model 189, version 2011-03-28.

Convex light-curve reconstruction, 104 ± 11 km volume-equivalent diameter. Both pole solutions remain possible. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [adelheid results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **657.90 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The selected convex pole(9,−4) remains one of two possible orientations. Ďurech2011 fits three occultation chords (two close together) at125±15 km and cannot distinguish the poles. Hanuš2013 Table3 obtains volume-equivalent104±11 km for this pole from one Keck AO observation, matching the later archive comment.

This newer resolved-image scale is explicitly transferred to the original mesh, rather than treating the archived125 km coordinates as final physical kilometers. One-image size and local morphology remain uncertain.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 190, pole ['199', '-20'], [Model 190](https://damit.cuni.cz/projects/damit/asteroid_models/view/190)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1598 vertices and 3192 triangles. Its signed tetrahedral volume is 1022653.8517369278 source units³; an independent triangle-centroid divergence sum gives 1022653.8517369275. The existing recipe applies one uniform scale of 0.83200000185859968 km per source unit so its volume-equivalent diameter is 104 km.

No unit-volume assumption is made. Radius above a 52 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (9°, -4°), with sidereal period 6.3192 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/189) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/540/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [A. Marciniak (2007), Photometry and models of selected main belt asteroids. IV. 184 Dejopeja, 276 Adelheid, 556 Phyllis](https://ui.adsabs.harvard.edu/abs/2007A%26A...473..633M) — original model publication record.
- [Ďurech et al. (2011), Combining asteroid models derived by lightcurve inversion with asteroidal occultation silhouettes](https://ui.adsabs.harvard.edu/abs/2011Icar..214..652D) — original model publication record.
- [Hanuš et al. (2013), Sizes of main-belt asteroids by combining shape models and Keck Adaptive Optics observations](https://ui.adsabs.harvard.edu/abs/2013Icar..226.1045H) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 135.3 ± 2.09 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2013), Icarus 226, 1045–1057](https://arxiv.org/pdf/1308.0446) — retained primary publication; see the body-specific selection and calibration above.
- [Ďurech et al. (2011), Icarus 214, 652–670](https://arxiv.org/pdf/1104.4227) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1040 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
