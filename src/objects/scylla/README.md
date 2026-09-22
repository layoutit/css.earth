# (155) Scylla

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 920](https://damit.cuni.cz/projects/damit/asteroid_models/view/920) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **920**, version **2016-01-04**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2016); model 920, version 2016-01-04.

Convex light-curve reconstruction with approximate thermal size: 39.21 km (catalog ±0.97 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. Neutral gray marks unavailable imagery.

## Evidence

The [scylla results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **113.79 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Select second archive pole 920 (356,53). Hanuš et al. (2018), Table A.3, rejects the revised (190,65) family and favors revised (346,41), corresponding to the selected broad family rather than archive 919 (201,69).

The publication revised the nominal shape; its exact revised mesh is not located in the surveyed DAMIT listing, so the 39.0 ±0.8 km VS-TPM size is not silently assigned to the old mesh. AKARI 39.21 ±0.97 km is retained only as an explicit display-scale approximation.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 919, pole ['201', '69'], [Model 919](https://damit.cuni.cz/projects/damit/asteroid_models/view/919)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 0.99999991221532536 source units³; an independent triangle-centroid divergence sum gives 0.99999991221532536. The existing recipe applies one uniform scale of 31.603103183248958 km per source unit so its volume-equivalent diameter is 39.21 km.

No unit-volume assumption is made. Radius above a 19.605 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (356°, 53°), with sidereal period 7.95879 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 392.1 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
