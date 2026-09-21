# (135) Hertha

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1799](https://damit.cuni.cz/projects/damit/asteroid_models/view/1799) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1799**, version **2017-06-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1799, version 2017-06-14.

Nonconvex ADAM shape constrained by resolved AO imaging, light curves and occultations, 79 ± 2 km volume-equivalent diameter. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [hertha results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Hanuš 2017 fits optical light curves, two disk-resolved AO images and one 18-chord occultation. Archive D79±2 km is retained rather than paper ensemble D80±2 km. No resolved albedo or regolith map is supplied.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 162, pole ['272', '52'], [Model 162](https://damit.cuni.cz/projects/damit/asteroid_models/view/162)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 259354.97595498673 source units³; an independent triangle-centroid divergence sum gives 259354.97595498673. The existing recipe applies one uniform scale of 0.99845486434412345 km per source unit so its volume-equivalent diameter is 79 km.

No unit-volume assumption is made. Radius above a 39.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (276°, 53°), with sidereal period 8.4006 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 790 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
