# (118) Peitho

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 4397](https://damit.cuni.cz/projects/damit/asteroid_models/view/4397) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **4397**, version **2020-04-26**. DAMIT, Astronomical Institute of Charles University; DAMIT archive (no linked publication in this model record); model 4397, version 2020-04-26.

Convex light-curve reconstruction with approximate thermal size: 43.99 km effective diameter (catalog ±0.75 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. The pole follows the archive’s occultation match. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [peitho results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **190.93 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Selected 2020 archive update 4397 states this pole agrees with occultation. It closely matches published ATLAS model4475/pole(176,59), but the update links no publication itself; it is credited to the archive.

The prior opposite pole 4474 remains listed as a comparison, not an equally supported orientation.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 4474, pole ['346', '34'], [Model 4474](https://damit.cuni.cz/projects/damit/asteroid_models/view/4474;) model 4475, pole ['176', '59'], [Model 4475](https://damit.cuni.cz/projects/damit/asteroid_models/view/4475)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1009 vertices and 2014 triangles. Its signed tetrahedral volume is 0.99999983232471257 source units³; an independent triangle-centroid divergence sum gives 0.99999983232471257. The existing recipe applies one uniform scale of 35.45576501027756 km per source unit so its volume-equivalent diameter is 43.99 km.

No unit-volume assumption is made. Radius above a 21.995 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (179°, 60°), with sidereal period 7.8064 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 439.9 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
