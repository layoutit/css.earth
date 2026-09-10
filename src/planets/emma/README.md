# (283) Emma

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1859](https://damit.cuni.cz/projects/damit/asteroid_models/view/1859) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1859**, version **2017-09-21**. DAMIT, Astronomical Institute of Charles University; Viikinkoski et al. (2017); model 1859, version 2017-09-21.

Nonconvex ADAM shape constrained by resolved AO imaging and light curves, 147 ± 14 km volume-equivalent diameter. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [emma results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The 2017 ADAM study combines29 light curves with five resolved AO images and rejects the opposite pole. The exact archive solution has volume-equivalent147±14 km; the paper ensemble is142±14 km, spanning different raw/deconvolved image and shape supports.

The archived raw shape volume is explicitly reconciled to147 km. The primary is shown alone; its small satellite is not part of this source mesh. The AO observations constrain geometry, not a global reflectance map.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 196, pole ['251', '22'], [Model 196](https://damit.cuni.cz/projects/damit/asteroid_models/view/196)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 1674280.6278942444 source units³; an independent triangle-centroid divergence sum gives 1674280.6278942444. The existing recipe applies one uniform scale of 0.99779377791057622 km per source unit so its volume-equivalent diameter is 147 km.

No unit-volume assumption is made. Radius above a 73.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (257°, 23°), with sidereal period 6.89523 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

[Model fields and mesh measurements](source/reference/damit-model.json).

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1859) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/568/shape.txt) — included unchanged. Nonconvex ADAM shape constrained by resolved AO imaging and light curves; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Viikinkoski et al. (2017), Adaptive optics and lightcurve data of asteroids: twenty shape models and information content analysis](https://ui.adsabs.harvard.edu/abs/2017A%26A...607A.117V) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 122.07 ± 1.38 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Viikinkoski et al. (2017), A&A 607, A117](https://arxiv.org/pdf/1708.05191) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1470 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
