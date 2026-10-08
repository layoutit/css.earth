# (59) Elpis

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 6156](https://damit.cuni.cz/projects/damit/asteroid_models/view/6156) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **6156**, version **2022-02-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2021); model 6156, version 2022-02-14.

Convex light-curve reconstruction with approximate thermal size: 156.18 km effective diameter (catalog ±2.31 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation; no surface imagery exists.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Elpis's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 31 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #3c3b39, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=59) lists, 4.4% ± 0.7%, from NEOWISE (Masiero et al. 2014, ApJ 791, 121; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

The elpis results record a maximum sampled source-to-display distance of **715.29 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Absolute rotational phase is illustrative.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. The survey found no alternative archive solution for this target.

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.0000000565150609 source units³; an independent triangle-centroid divergence sum gives 1.0000000565150609. The existing recipe applies one uniform scale of 125.88044931776574 km per source unit so its volume-equivalent diameter is 156.18 km.

No unit-volume assumption is made. Radius above a 78.09 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (300°, -55°), with sidereal period 13.6747 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to the fewest faces the error allowance permits, 424 of at most 800, and emits native PolyCSS `u` triangles from an atlas of 13,107,200 texels. The error allowance is 1561.8 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
