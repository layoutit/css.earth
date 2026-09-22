# (249) Ilse

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 864](https://damit.cuni.cz/projects/damit/asteroid_models/view/864) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **864**, version **2016-01-04**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2016); model 864, version 2016-01-04.

Convex light-curve reconstruction with approximate thermal size: 37.03 km effective diameter (catalog ±0.61 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. Both pole solutions remain possible. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [ilse results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **101.23 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Published convex inversion from Hanuš et al. (2016). The selected archive solution is retained as a reproducible coarse model.

An alternative pole remains possible; no unique orientation is claimed. The release supplies no registered global surface imagery or measured local terrain. AKARI thermal effective diameter provides only an explicit volume-scale approximation.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 865, pole ['222', '41'], [Model 865](https://damit.cuni.cz/projects/damit/asteroid_models/view/865)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 996 vertices and 1988 triangles. Its signed tetrahedral volume is 1.0000000061697116 source units³; an independent triangle-centroid divergence sum gives 1.0000000061697119. The existing recipe applies one uniform scale of 29.846030967234469 km per source unit so its volume-equivalent diameter is 37.03 km.

No unit-volume assumption is made. Radius above a 18.515 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (2°, 85°), with sidereal period 84.995 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 370.3 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
