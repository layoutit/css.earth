# (250) Bettina

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1850](https://damit.cuni.cz/projects/damit/asteroid_models/view/1850) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1850**, version **2017-09-21**. DAMIT, Astronomical Institute of Charles University; Viikinkoski et al. (2017); model 1850, version 2017-09-21.

Nonconvex ADAM shape constrained by resolved AO imaging and light curves, 110 ± 5 km volume-equivalent diameter. Only one resolved AO observation constrains this reconstruction. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [bettina results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The 2017 ADAM reconstruction combines optical light curves with one resolved adaptive-optics observation. With only one AO observation, jackknife image resampling is impossible; size uncertainty comes from different shape supports. The selected archive solution has volume-equivalent diameter 110±5 km, while the paper ensemble reports 109±5 km.

Its source-scale adjustment preserves the archived surface and does not add image texture.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 187, pole ['100', '17'], [Model 187](https://damit.cuni.cz/projects/damit/asteroid_models/view/187)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 698720.03584500984 source units³; an independent triangle-centroid divergence sum gives 698720.03584500984. The existing recipe applies one uniform scale of 0.99913573834884117 km per source unit so its volume-equivalent diameter is 110 km.

No unit-volume assumption is made. Radius above a 55 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (99°, 10°), with sidereal period 5.05441 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1100 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
