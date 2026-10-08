# (117) Lomia

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 838](https://damit.cuni.cz/projects/damit/asteroid_models/view/838) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **838**, version **2016-01-04**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2016); model 838, version 2016-01-04.

Convex light-curve reconstruction with approximate thermal size: 144.92 km effective diameter (catalog ±1.86 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. No surface imagery exists; rotational phase is illustrative.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Lomia's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 16 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #2e2e2c, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=117) lists, 2.7% ± 0.4%, from NEOWISE (Masiero et al. 2012, ApJ 759, L8; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

The lomia results record a maximum sampled source-to-display distance of **475.46 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Hanuš 2016 Table 2 reports 19 dense curves across four apparitions plus 459 sparse measurements. The selected (117,-19) pole matches the published second family (117,-18).

The other archive pole (323,-57) differs from the paper table (312,-40); it is retained as an archive alternative rather than substituted. Hanuš 2021 sparse-only comparison shifts the pole latitude, so absolute attitude remains model-dependent.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. Alternative archive solutions: model 839, pole ['323', '-57'], [Model 839](https://damit.cuni.cz/projects/damit/asteroid_models/view/839)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.0000000735507539 source units³; an independent triangle-centroid divergence sum gives 1.0000000735507539. The existing recipe applies one uniform scale of 116.80493412433646 km per source unit so its volume-equivalent diameter is 144.92 km.

No unit-volume assumption is made. Radius above a 72.46 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (117°, -19°), with sidereal period 9.12417 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to the fewest faces the error allowance permits, 406 of at most 800, and emits native PolyCSS `u` triangles from an atlas of 13,107,200 texels. The error allowance is 1449.2 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
