# (38) Leda

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 720](https://damit.cuni.cz/projects/damit/asteroid_models/view/720) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **720**, version **2013-10-16**. DAMIT, Astronomical Institute of Charles University; Franco et al. (2013); model 720, version 2013-10-16.

Convex light-curve reconstruction with approximate thermal size: 114.22 km effective diameter (catalog ±1.52 km; additional shape and thermal-model uncertainty). An alternative pole solution remains in the archive. Thermal size is used as a volume-scale approximation; neutral gray marks unavailable imagery.

## Evidence

The [leda-38 results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **492.00 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Absolute rotational phase is illustrative.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 721, pole ['345', '-4'], [Model 721](https://damit.cuni.cz/projects/damit/asteroid_models/view/721)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1021 vertices and 2038 triangles. Its signed tetrahedral volume is 1.0000000453178759 source units³; an independent triangle-centroid divergence sum gives 1.0000000453178759. The existing recipe applies one uniform scale of 92.060859103213076 km per source unit so its volume-equivalent diameter is 114.22 km.

No unit-volume assumption is made. Radius above a 57.11 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (161°, -15°), with sidereal period 12.8361 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1142.2 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
