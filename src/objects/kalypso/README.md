# (53) Kalypso

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1732](https://damit.cuni.cz/projects/damit/asteroid_models/view/1732) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1732**, version **2016-07-07**. DAMIT, Astronomical Institute of Charles University; Franco et al. (2016); model 1732, version 2016-07-07.

Convex light-curve reconstruction with approximate thermal size: 101.9 km effective diameter (catalog ±1.03 km; additional shape and thermal-model uncertainty). An alternative pole solution remains in the archive. Thermal size is used as a volume-scale approximation; neutral gray marks unavailable imagery.

## Evidence

The [kalypso results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **344.33 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Absolute rotational phase is illustrative.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 1733, pole ['168', '12'], [Model 1733](https://damit.cuni.cz/projects/damit/asteroid_models/view/1733)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1014 vertices and 2024 triangles. Its signed tetrahedral volume is 0.99999995444778367 source units³; an independent triangle-centroid divergence sum gives 0.99999995444778378. The existing recipe applies one uniform scale of 82.13099130422205 km per source unit so its volume-equivalent diameter is 101.9 km.

No unit-volume assumption is made. Radius above a 50.95 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (349°, 8°), with sidereal period 9.03506 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1019 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
