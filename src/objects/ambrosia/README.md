# (193) Ambrosia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 548](https://damit.cuni.cz/projects/damit/asteroid_models/view/548) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **548**, version **2013-02-11**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2013); model 548, version 2013-02-11.

Convex light-curve reconstruction with approximate thermal size: 37.89 km effective diameter (catalog ±0.65 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [ambrosia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **120.17 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Hanuš 2013 table reports 18 dense lightcurves from four apparitions plus 256 sparse measurements. Both mirror poles remain; model 548 is the representative first archived solution. The thermal scale is approximate. Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 549, pole ['328', '-17'], [Model 549](https://damit.cuni.cz/projects/damit/asteroid_models/view/549)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1002 vertices and 2000 triangles. Its signed tetrahedral volume is 0.99999984422902566 source units³; an independent triangle-centroid divergence sum gives 0.99999984422902566. The existing recipe applies one uniform scale of 30.539189154548517 km per source unit so its volume-equivalent diameter is 37.89 km.

No unit-volume assumption is made. Radius above a 18.945 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (141°, -11°), with sidereal period 6.58167 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 378.9 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
