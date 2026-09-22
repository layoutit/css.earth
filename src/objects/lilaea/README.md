# (213) Lilaea

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 9003](https://damit.cuni.cz/projects/damit/asteroid_models/view/9003) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **9003**, version **2022-11-29**. DAMIT, Astronomical Institute of Charles University; Ďurech & Hanuš (2023); model 9003, version 2022-11-29.

Convex light-curve reconstruction with approximate thermal size: 76.31 km effective diameter (catalog ±0.97 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [lilaea results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **129.35 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Gaia DR3 inversion provides a low-resolution convex shape from sparse disk-integrated observations. The linked CDS release provides spin parameters and observation counts, not an imagery product or independent size calibration. The selected DAMIT release has one pole solution.

The thermal scale is approximate. Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. The survey found no alternative archive solution for this target.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 1.0000001088520782 source units³; an independent triangle-centroid divergence sum gives 1.0000001088520782. The existing recipe applies one uniform scale of 61.505550773829476 km per source unit so its volume-equivalent diameter is 76.31 km.

No unit-volume assumption is made. Radius above a 38.155 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (173°, 76°), with sidereal period 12.0395 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 763.1 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
