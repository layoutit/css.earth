# (23) Thalia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1858](https://damit.cuni.cz/projects/damit/asteroid_models/view/1858) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1858**, version **2017-09-21**. DAMIT, Astronomical Institute of Charles University; Viikinkoski et al. (2017); model 1858, version 2017-09-21.

Nonconvex model constrained by resolved imaging, 114 ± 8 km volume-equivalent diameter in the selected archive record. An alternative pole solution remains in the archive. Grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [thalia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

The second pole is selected because Viikinkoski et al. (2017), section 3, find its AO fit more likely; the competing pole is not ruled out.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 122, pole ['159', '-45'], [Model 122](https://damit.cuni.cz/projects/damit/asteroid_models/view/122;) model 123, pole ['343', '-69'], [Model 123](https://damit.cuni.cz/projects/damit/asteroid_models/view/123;) model 1857, pole ['158', '-46'], [Model 1857](https://damit.cuni.cz/projects/damit/asteroid_models/view/1857)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 782233.67278950289 source units³; an independent triangle-centroid divergence sum gives 782233.67278950289. The existing recipe applies one uniform scale of 0.99722285429188051 km per source unit so its volume-equivalent diameter is 114 km.

No unit-volume assumption is made. Radius above a 57 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (343°, -74°), with sidereal period 12.3124 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1140 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
