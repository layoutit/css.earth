# (129) Antigone

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1810](https://damit.cuni.cz/projects/damit/asteroid_models/view/1810) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1810**, version **2017-06-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1810, version 2017-06-14.

Nonconvex ADAM shape constrained by resolved AO imaging, light curves and occultations. The selected archive gives 126 ± 3 km equivalent-volume size; its size error is not local shape accuracy. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [antigone results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Hanuš 2017 confirms the pole family using disk-resolved AO imaging, light curves and occultations. Section on 129 describes eight AO images while TableA.1 lists nine; this discrepancy is retained. Archive D126±3 km is retained; local shape accuracy is not the diameter uncertainty.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 159, pole ['207', '58'], [Model 159](https://damit.cuni.cz/projects/damit/asteroid_models/view/159)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 1052275.475911973 source units³; an independent triangle-centroid divergence sum gives 1052275.475911973. The existing recipe applies one uniform scale of 0.99845141371348756 km per source unit so its volume-equivalent diameter is 126 km.

No unit-volume assumption is made. Radius above a 63 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (205°, 63°), with sidereal period 4.95716 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1260 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
