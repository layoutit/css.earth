# (149) Medusa

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 570](https://damit.cuni.cz/projects/damit/asteroid_models/view/570) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **570**, version **2013-02-11**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2013); model 570, version 2013-02-11.

Convex light-curve reconstruction with approximate thermal size: 21.41 km (catalog ±0.35 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. Neutral gray marks unavailable imagery.

## Evidence

The [medusa results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **57.14 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Two 2013 convex archive solutions remain. Archive model 570 pole (173,-78) differs from the nominal table pole (156,-76) in Hanuš et al. (2013); the alternate archive pole (306,-67) likewise differs from nominal (333,-73).

The archived solution, not an exact paper-table attitude, owns this presentation. Fine structure and a preferred pole are not established.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 571, pole ['306', '-67'], [Model 571](https://damit.cuni.cz/projects/damit/asteroid_models/view/571)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 0.9999998108064263 source units³; an independent triangle-centroid divergence sum gives 0.99999981080642641. The existing recipe applies one uniform scale of 17.256374956011459 km per source unit so its volume-equivalent diameter is 21.41 km.

No unit-volume assumption is made. Radius above a 10.705 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (173°, -78°), with sidereal period 26.0455 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 214.1 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
