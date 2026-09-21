# (302) Clarissa

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 296](https://damit.cuni.cz/projects/damit/asteroid_models/view/296) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **296**, version **2011-02-17**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2011), Hanuš (2011); model 296, version 2011-02-17.

Convex light-curve reconstruction, 43 ± 4 km volume-equivalent diameter. This pole gives the preferred occultation fit; the rival pole remains possible. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [clarissa results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **130.09 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Ďurech 2011 describes this as a very elongated convex model. Both poles fit the 2004 occultation; selected pole(28,−72) fits particularly well and is preferred in DAMIT, but its rival is not rejected. Three video chords have reported timing errors of tenths of a second.

Table 3 gives volume-equivalent 43±4 km for this pole; local surface relief is unresolved.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 297, pole ['190', '-72'], [Model 297](https://damit.cuni.cz/projects/damit/asteroid_models/view/297)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 41629.777050978482 source units³; an independent triangle-centroid divergence sum gives 41629.777050978482. The existing recipe applies one uniform scale of 0.99999992633890256 km per source unit so its volume-equivalent diameter is 43 km.

No unit-volume assumption is made. Radius above a 21.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (28°, -72°), with sidereal period 14.4767 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 430 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
