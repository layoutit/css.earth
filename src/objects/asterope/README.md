# (233) Asterope

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1823](https://damit.cuni.cz/projects/damit/asteroid_models/view/1823) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1823**, version **2017-06-16**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1823, version 2017-06-16.

Nonconvex ADAM reconstruction constrained by adaptive optics and occultation; 107 km volume-equivalent diameter (±3 km). Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [asterope results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Hanuš 2017 ADAM uses 13 lightcurves, one adaptive-optics image and one occultation; disk-resolved/occultation data reject the alternate convex pole. The selected archived ADAM mesh has pole(318,+61) and volume-equivalent diameter 106.926418 km, matching its rounded archive 107±3 km. The paper reports an ensemble 106±3 km and pole(316,+58), within the stated model uncertainties.

Use the pinned archive solution, not an assertion that the paper’s ensemble is exactly 107 km. AO and occultation constrain broad shape; no resolved global reflectance or regolith texture is supplied.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 1093, pole ['322', '59'], [Model 1093](https://damit.cuni.cz/projects/damit/asteroid_models/view/1093)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 640108.62323457503 source units³; an independent triangle-centroid divergence sum gives 640108.62323457515. The existing recipe applies one uniform scale of 1.0006881550930256 km per source unit so its volume-equivalent diameter is 107 km.

No unit-volume assumption is made. Radius above a 53.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (318°, 61°), with sidereal period 19.698 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1070 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
