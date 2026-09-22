# (106) Dione

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5942](https://damit.cuni.cz/projects/damit/asteroid_models/view/5942) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **5942**, version **2022-02-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2021); model 5942, version 2022-02-14.

Convex light-curve reconstruction with approximate thermal size: 153.42 km effective diameter (catalog ±2.38 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [dione-106 results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **580.01 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Hanuš 2021 TableA.2 reports 379 ASAS-SN detections and poles (57,12)/(237,1). The archived (237,1) solution is retained without claiming the opposite pole is ruled out.

The numbered ID dione-106 avoids Saturn moon Dione.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 5943, pole ['57', '12'], [Model 5943](https://damit.cuni.cz/projects/damit/asteroid_models/view/5943)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1021 vertices and 2038 triangles. Its signed tetrahedral volume is 1.000000067862713 source units³; an independent triangle-centroid divergence sum gives 1.000000067862713. The existing recipe applies one uniform scale of 123.65589999539515 km per source unit so its volume-equivalent diameter is 153.42 km.

No unit-volume assumption is made. Radius above a 76.71 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (237°, 1°), with sidereal period 16.2133 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1534.2 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
