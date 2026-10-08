# (227) Philosophia

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1873](https://damit.cuni.cz/projects/damit/asteroid_models/view/1873) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1873**, version **2018-03-22**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2018); model 1873, version 2018-03-22.

Convex light-curve reconstruction; 101 km volume-equivalent diameter (±5 km). No surface imagery exists; rotational phase is illustrative.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Philosophia's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 38 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #484845, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=227) lists, 6.5% ± 0.4%, from NEOWISE (Masiero et al. 2014, ApJ 791, 121; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

The philosophia results record a maximum sampled source-to-display distance of **458.58 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Marciniak 2018 section 5.2 and Table 7 select the convex pole(95,+19) as the best thermal fit (chi-square 1.2). Table 7 reports 101±5 km equivalent-volume diameter, with errors spanning the full 3-sigma range. This primary publication scale supersedes DAMIT’s107±5 km field. The paper also presents SAGE nonconvex alternatives, but the selected convex solution gives the best thermal fit; no multichord occultation supports those concavities.

Shape and thermal fit are explicitly the least constrained of the five studied targets; neither is a resolved terrain map.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. Alternative archive solutions: model 1874, pole ['272', '-1'], [Model 1874](https://damit.cuni.cz/projects/damit/asteroid_models/view/1874)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 641431.04283826763 source units³; an independent triangle-centroid divergence sum gives 641431.04283826763. The existing recipe applies one uniform scale of 0.94392521991833334 km per source unit so its volume-equivalent diameter is 101 km.

No unit-volume assumption is made. Radius above a 50.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (95°, 19°), with sidereal period 26.4614 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to the fewest faces the error allowance permits, 418 of at most 800, and emits native PolyCSS `u` triangles from an atlas of 13,107,200 texels. The error allowance is 1010 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
