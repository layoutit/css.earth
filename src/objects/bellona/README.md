# (28) Bellona

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1839](https://damit.cuni.cz/projects/damit/asteroid_models/view/1839) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1839**, version **2017-09-21**. DAMIT, Astronomical Institute of Charles University; Viikinkoski et al. (2017); model 1839, version 2017-09-21.

Nonconvex model constrained by resolved imaging, 133 ± 7 km volume-equivalent diameter in the selected archive record. Grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [bellona results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

The original ADAM study used only one AO observation for this body, limiting the shape constraints.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 287, pole ['102', '-8'], [Model 287](https://damit.cuni.cz/projects/damit/asteroid_models/view/287)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 1238792.6848966654 source units³; an independent triangle-centroid divergence sum gives 1238792.6848966652. The existing recipe applies one uniform scale of 0.99812508625558016 km per source unit so its volume-equivalent diameter is 133 km.

No unit-volume assumption is made. Radius above a 66.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (98°, -10°), with sidereal period 15.7079 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1330 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
