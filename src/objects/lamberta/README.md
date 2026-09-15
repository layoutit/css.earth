# (187) Lamberta

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5914](https://damit.cuni.cz/projects/damit/asteroid_models/view/5914) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **5914**, version **2021-11-12**. DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5914, version 2021-11-12.

ADAM nonconvex reconstruction constrained by VLT/SPHERE images. Selected archive volume-equivalent diameter: 141 ±2 km. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [lamberta results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **1027.70 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral gray must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative.

Select Vernazza et al. (2021) ADAM model5914 over older convex1086. The VLT/SPHERE imaging study reports volume-equivalent141 ±2 km, agreeing with the selected archive diameter and raw volume141.094. MPCD is a promising refinement documented in the paper; its linked LAM release could not be retrieved during this survey.

The mounted source is the pinned ADAM mesh, not an unverified MPCD or reflectance product.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 1086, pole ['153', '-56'], [Model 1086](https://damit.cuni.cz/projects/damit/asteroid_models/view/1086)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 902 vertices and 1800 triangles. Its signed tetrahedral volume is 1470693.7403402955 source units³; an independent triangle-centroid divergence sum gives 1470693.7403402955. The existing recipe applies one uniform scale of 0.99933532370243183 km per source unit so its volume-equivalent diameter is 141 km.

No unit-volume assumption is made. Radius above a 70.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (115°, -80°), with sidereal period 10.667 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1410 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

The 800-face preparation uses Meshoptimizer absolute-error simplification without triangle regularization. The regularized candidate exceeded the unchanged 1,410 m sampled geometry limit; the selected option retained 800 closed faces and reduced the trial maximum sampled discrepancy to 1,028 m.

This is a sampled comparison against the published mesh, not an exhaustive geometric bound or an observation-accuracy claim.

</details>
