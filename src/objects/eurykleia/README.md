# (195) Eurykleia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 3102](https://damit.cuni.cz/projects/damit/asteroid_models/view/3102) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **3102**, version **2019-06-24**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2019); model 3102, version 2019-06-24.

Convex light-curve reconstruction; 87 km volume-equivalent diameter (published 3-sigma range 78–98 km). Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [eurykleia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **328.16 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Marciniak 2019 Table 1 gives 51 dense lightcurves over seven apparitions. AM1 (101,+71) gives slightly better thermal chi-square than AM2 (0.51 vs 0.60), but neither pole is decisively rejected. Section 4.3 adopts 87 km with asymmetric 3-sigma range 78–98 km because WISE W4 fluxes lie systematically below the fitted model.

This published uncertainty supersedes the archive ±6 km simplification.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 3103, pole ['352', '83'], [Model 3103](https://damit.cuni.cz/projects/damit/asteroid_models/view/3103)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1018 vertices and 2032 triangles. Its signed tetrahedral volume is 344791.40013818286 source units³; an independent triangle-centroid divergence sum gives 344791.40013818286. The existing recipe applies one uniform scale of 0.99999996557302251 km per source unit so its volume-equivalent diameter is 87 km.

No unit-volume assumption is made. Radius above a 43.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (101°, 71°), with sidereal period 16.5218 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 870 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
