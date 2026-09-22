# (144) Vibilia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1824](https://damit.cuni.cz/projects/damit/asteroid_models/view/1824) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1824**, version **2017-06-16**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1824, version 2017-06-16.

Nonconvex ADAM shape constrained by resolved AO imaging, light curves and occultations. The selected archive gives 143 ± 3 km equivalent-volume size; its size error is not local shape accuracy. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [vibilia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Hanuš 2017 rejects the opposite pole using two disk-resolved AO images and three occultation epochs. Archive D143±3 km and pole(251,63) are retained rather than paper ensemble D141±3 km and pole(250,58). No resolved surface imagery is projected onto this mesh.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 1099, pole ['248', '56'], [Model 1099](https://damit.cuni.cz/projects/damit/asteroid_models/view/1099)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 1532024.7323014515 source units³; an independent triangle-centroid divergence sum gives 1532024.7323014515. The existing recipe applies one uniform scale of 0.99980119791335453 km per source unit so its volume-equivalent diameter is 143 km.

No unit-volume assumption is made. Radius above a 71.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (251°, 63°), with sidereal period 13.8252 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1430 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
