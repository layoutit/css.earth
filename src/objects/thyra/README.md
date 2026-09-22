# (115) Thyra

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 154](https://damit.cuni.cz/projects/damit/asteroid_models/view/154) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **154**, version **2009-02-26**. DAMIT, Astronomical Institute of Charles University; T. Michalowski (2004), M. Delbo and P. Tanga (2009); model 154, version 2009-02-26.

Convex light-curve reconstruction with a published 90–94 km diameter fit range; the archive mesh uses 92 km. Unusual scattering parameters make its vertical shape uncertain. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [thyra results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **347.33 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The archive warns that unusual Hapke parameters were needed to keep the shape from becoming too high. This limits confidence in the vertical dimension. Delbo and Tanga (2009) give a 90–94 km thermophysical size range for this pole family, represented in DAMIT as 92 ± 2 km.

The material roughness is not constrained; no Hapke-derived texture is synthesized.

DAMIT represents the published 90–94 km thermophysical fit range as 92±2 km. This is a fit range, not an independently stated one-sigma Gaussian confidence interval or a local shape-accuracy bound.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. The survey found no alternative archive solution for this target.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1021 vertices and 2038 triangles. Its signed tetrahedral volume is 407720.05092013458 source units³; an independent triangle-centroid divergence sum gives 407720.05092013447. The existing recipe applies one uniform scale of 1.0000000265320557 km per source unit so its volume-equivalent diameter is 92 km.

No unit-volume assumption is made. Radius above a 46 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (35°, 33°), with sidereal period 7.23996 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 920 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
