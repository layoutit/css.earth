# (167) Urda

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 172](https://damit.cuni.cz/projects/damit/asteroid_models/view/172) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **172**, version **2011-03-28**. DAMIT, Astronomical Institute of Charles University; Slivan et al. (2003), B. D. Warner (2008), Ďurech et al. (2011); model 172, version 2011-03-28.

Convex light-curve reconstruction. Selected archive volume-equivalent diameter: 44 ±15 km. An alternative pole remains possible. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [urda results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **178.81 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral gray must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative.

Select archive model 172 (249,-68), explicitly marked preferred. Ďurech et al. (2011), discussion and Fig.34, says it fits better but the rival cannot be rejected and size is not very accurate; one negative chord was visual.

Retain the direct occultation volume-equivalent 44 ±15 km estimate. The later Hanuš et al. (2018) VS-TPM 41.5 ±0.8 km at this pole is a comparison, not an independent local-shape accuracy claim.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 171, pole ['107', '-69'], [Model 171](https://damit.cuni.cz/projects/damit/asteroid_models/view/171)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 44602.235078373204 source units³; an independent triangle-centroid divergence sum gives 44602.235078373196. The existing recipe applies one uniform scale of 1.0000000225862542 km per source unit so its volume-equivalent diameter is 44 km.

No unit-volume assumption is made. Radius above a 22 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (249°, -68°), with sidereal period 13.0613 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 440 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
