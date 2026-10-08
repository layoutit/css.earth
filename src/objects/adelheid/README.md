# (276) Adelheid

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 189](https://damit.cuni.cz/projects/damit/asteroid_models/view/189) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **189**, version **2011-03-28**. DAMIT, Astronomical Institute of Charles University; A. Marciniak (2007), Ďurech et al. (2011), Hanuš et al. (2013); model 189, version 2011-03-28.

Convex light-curve reconstruction, 104 ± 11 km volume-equivalent diameter. Both pole solutions remain possible. No surface imagery exists; rotational phase is illustrative.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Adelheid's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 31 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #41403d, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=276) lists, 5.1% ± 0.6%, from NEOWISE (Masiero et al. 2014, ApJ 791, 121; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

The adelheid results record a maximum sampled source-to-display distance of **657.90 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The selected convex pole(9,−4) remains one of two possible orientations. Ďurech 2011 fits three occultation chords (two close together) at 125±15 km and cannot distinguish the poles. Hanuš 2013 Table 3 obtains volume-equivalent 104±11 km for this pole from one Keck AO observation, matching the later archive comment.

This newer resolved-image scale is explicitly transferred to the original mesh, rather than treating the archived 125 km coordinates as final physical kilometers. One-image size and local morphology remain uncertain.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. Alternative archive solutions: model 190, pole ['199', '-20'], [Model 190](https://damit.cuni.cz/projects/damit/asteroid_models/view/190)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1598 vertices and 3192 triangles. Its signed tetrahedral volume is 1022653.8517369278 source units³; an independent triangle-centroid divergence sum gives 1022653.8517369275. The existing recipe applies one uniform scale of 0.83200000185859968 km per source unit so its volume-equivalent diameter is 104 km.

No unit-volume assumption is made. Radius above a 52 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (9°, -4°), with sidereal period 6.3192 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to the fewest faces the error allowance permits, 578 of at most 800, and emits native PolyCSS `u` triangles from an atlas of 13,107,200 texels. The error allowance is 1040 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
