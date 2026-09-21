# (306) Unitas

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 197](https://damit.cuni.cz/projects/damit/asteroid_models/view/197) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **197**, version **2009-02-26**. DAMIT, Astronomical Institute of Charles University; J. Ďurech (2007), M. Delbo and P. Tanga (2009), Ďurech et al. (2011); model 197, version 2009-02-26.

Convex light-curve reconstruction, 49 ± 5 km volume-equivalent diameter. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [unitas results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **221.05 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pole(79,−35) is preferred by both IRAS thermal fits and the 2004 occultation negative chord. Delbo and Tanga (2009) obtain a volume-equivalent thermal size range 55–57 km, represented in DAMIT as 56±1 km. The later Ďurech 2011 Table 3 fits the same pole family to five occultation chords at 49±5 km.

This explicit occultation volume scale is transferred uniformly to the archived shape; the distinct thermal estimate is retained as a comparison rather than silently averaged.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 198, pole ['253', '-17'], [Model 198](https://damit.cuni.cz/projects/damit/asteroid_models/view/198)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 91952.320092684939 source units³; an independent triangle-centroid divergence sum gives 91952.320092684939. The existing recipe applies one uniform scale of 0.87500000787523258 km per source unit so its volume-equivalent diameter is 49 km.

No unit-volume assumption is made. Radius above a 24.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (79°, -35°), with sidereal period 8.73875 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 490 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
