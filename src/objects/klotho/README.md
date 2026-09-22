# (97) Klotho

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 321](https://damit.cuni.cz/projects/damit/asteroid_models/view/321) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **321**, version **2011-04-21**. DAMIT, Astronomical Institute of Charles University; Hanuš (2011), Hanuš et al. (2013); model 321, version 2011-04-21.

Convex light-curve reconstruction, 85 ± 9 km volume-equivalent diameter in the selected archive record. Grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [klotho results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **281.96 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. The survey found no alternative archive solution for this target.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 321555.1345665133 source units³; an independent triangle-centroid divergence sum gives 321555.1345665133. The existing recipe applies one uniform scale of 0.99999996216075637 km per source unit so its volume-equivalent diameter is 85 km.

No unit-volume assumption is made. Radius above a 42.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (359°, 30°), with sidereal period 35.251 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 850 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
