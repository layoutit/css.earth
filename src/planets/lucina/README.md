# (146) Lucina

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1837](https://damit.cuni.cz/projects/damit/asteroid_models/view/1837) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1837**, version **2017-09-21**. DAMIT, Astronomical Institute of Charles University; Viikinkoski et al. (2017); model 1837, version 2017-09-21.

ADAM nonconvex reconstruction constrained by Keck adaptive-optics images. Selected archive volume-equivalent diameter: 154 ±15 km. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [lucina results](../../../docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral grid must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative.

Select the 2017 ADAM nonconvex model over older convex 164. Viikinkoski et al. (2017), Table 1, uses 22 light curves and two Keck AO images. Its publication-level diameter is 131 ±15 km; Table 4 lists a 128–159 km range for model variants.

The selected archive mesh has diameter 153.914 source units and declares 154 ±15 km, so this release uses the archive solution rather than silently substituting the ensemble value. No resolved reflectance mosaic is supplied.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 164, pole ['305', '-41'], [Model 164](https://damit.cuni.cz/projects/damit/asteroid_models/view/164)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 1909126.222472582 source units³; an independent triangle-centroid divergence sum gives 1909126.222472582. The existing recipe applies one uniform scale of 1.0005574898925409 km per source unit so its volume-equivalent diameter is 154 km.

No unit-volume assumption is made. Radius above a 77 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (304°, -41°), with sidereal period 18.5538 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1837) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/436/shape.txt) — included unchanged. ADAM nonconvex reconstruction constrained by Keck adaptive-optics images; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Viikinkoski et al. (2017)](https://damit.cuni.cz/projects/damit/references/view/171) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 126.89 ± 1.64 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Viikinkoski et al. (2017), AO and light-curve shape models](https://arxiv.org/pdf/1708.05191) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1540 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
