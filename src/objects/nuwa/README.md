# (150) Nuwa

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1185](https://damit.cuni.cz/projects/damit/asteroid_models/view/1185) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1185**, version **2016-01-04**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2016); model 1185, version 2016-01-04.

Convex light-curve reconstruction with approximate thermal size: 139.65 km (catalog ±2.09 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. No surface imagery exists.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Nuwa's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 13 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #41403e, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=150) lists, 5.2% ± 0.7%, from NEOWISE (Masiero et al. 2014, ApJ 791, 121; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

The nuwa results record a maximum sampled source-to-display distance of **480.15 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Select nominal 2016 convex model 1185 (359,25), with 1186 (177,22) retained as an unresolved mirror pole. Hanuš et al. (2016), table of new models, gives 33 dense light curves across five apparitions and sparse data.

No calibrated size is in the selected release; AKARI remains an explicit separate thermal-volume approximation.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. Alternative archive solutions: model 1186, pole ['177', '22'], [Model 1186](https://damit.cuni.cz/projects/damit/asteroid_models/view/1186)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 0.99999991754790063 source units³; an independent triangle-centroid divergence sum gives 0.99999991754790063. The existing recipe applies one uniform scale of 112.55734128272978 km per source unit so its volume-equivalent diameter is 139.65 km.

No unit-volume assumption is made. Radius above a 69.825 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (359°, 25°), with sidereal period 8.13456 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to the fewest faces the error allowance permits, 378 of at most 800, and emits native PolyCSS `u` triangles from an atlas of 13,107,200 texels. The error allowance is 1396.5 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
