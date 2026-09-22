# (184) Dejopeja

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 175](https://damit.cuni.cz/projects/damit/asteroid_models/view/175) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **175**, version **2007-09-21**. DAMIT, Astronomical Institute of Charles University; A. Marciniak (2007), Hanuš et al. (2013); model 175, version 2007-09-21.

Convex light-curve reconstruction. Selected archive volume-equivalent diameter: 93 ±9 km. An alternative pole remains possible. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [dejopeja results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **414.41 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral gray must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative.

Select pole 1 model 175 (200,52). Hanuš et al. (2013), Tables 2–3, reports this pole and its mirror (18,54), one Keck AO image, and volume-equivalent diameters 93 ±9 and 95 ±9 km; neither is marked rejected. The selected 93-km archive calibration matches the paper.

Convex geometry is still inferred from light curves; the AO silhouette calibrates size, not all local topography.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 176, pole ['18', '54'], [Model 176](https://damit.cuni.cz/projects/damit/asteroid_models/view/176)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 421160.32844602439 source units³; an independent triangle-centroid divergence sum gives 421160.32844602439. The existing recipe applies one uniform scale of 1.0000000094167596 km per source unit so its volume-equivalent diameter is 93 km.

No unit-volume assumption is made. Radius above a 46.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (200°, 52°), with sidereal period 6.44111 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 930 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
