# (165) Loreley

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1809](https://damit.cuni.cz/projects/damit/asteroid_models/view/1809) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1809**, version **2017-06-16**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1809, version 2017-06-16.

ADAM nonconvex reconstruction constrained by Keck adaptive-optics images. Selected archive volume-equivalent diameter: 177 ±5 km. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [loreley results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral gray must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative.

Select the 2017 ADAM nonconvex model 1809 over convex 295. Hanuš et al. (2017) reports 30 light curves, four AO images, and one occultation; the earlier pole ambiguity was removed by occultations and confirmed by AO.

The publication ensemble gives 173 ±5 km and (178±3,31±3); the selected archive release gives 177 ±5 km and (180,31), with raw volume diameter 176.965. Keep the exact archived solution distinct from the ensemble estimate. No mass or density inference is adopted.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 295, pole ['174', '29'], [Model 295](https://damit.cuni.cz/projects/damit/asteroid_models/view/295)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 2901776.9965023012 source units³; an independent triangle-centroid divergence sum gives 2901776.9965023012. The existing recipe applies one uniform scale of 1.0001952689394022 km per source unit so its volume-equivalent diameter is 177 km.

No unit-volume assumption is made. Radius above a 88.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (180°, 31°), with sidereal period 7.22439 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1770 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
