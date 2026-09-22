# (110) Lydia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 152](https://damit.cuni.cz/projects/damit/asteroid_models/view/152) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **152**, version **2009-02-26**. DAMIT, Astronomical Institute of Charles University; J. Ďurech (2007), M. Delbo and P. Tanga (2009); model 152, version 2009-02-26.

Convex light-curve reconstruction with the thermally preferred pole and a published 90–92 km diameter fit range. The archive mesh uses 91 km; another pole remains possible. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [lydia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **671.63 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Delbo and Tanga (2009) supplementary section on Lydia explicitly choose pole 1 (149.3,-55), matching model 152, because it fits slightly better (reduced chi-square 0.7 versus 0.76). The second pole remains possible. Its IRAS thermophysical diameter range is 90–92 km versus 94–97 km for pole 2; the archive stores 91±1 km.

DAMIT represents the published 90–92 km thermophysical fit range as 91±1 km. This is a fit range, not an independently stated one-sigma Gaussian confidence interval or a local shape-accuracy bound.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 153, pole ['331', '-61'], [Model 153](https://damit.cuni.cz/projects/damit/asteroid_models/view/153)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1597 vertices and 3190 triangles. Its signed tetrahedral volume is 394568.75938298897 source units³; an independent triangle-centroid divergence sum gives 394568.75938298897. The existing recipe applies one uniform scale of 1.0000000790258456 km per source unit so its volume-equivalent diameter is 91 km.

No unit-volume assumption is made. Radius above a 45.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (149°, -55°), with sidereal period 10.9258 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 910 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
