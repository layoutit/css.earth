# (74) Galatea

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 6181](https://damit.cuni.cz/projects/damit/asteroid_models/view/6181) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **6181**, version **2022-02-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2021); model 6181, version 2022-02-14.

Convex light-curve reconstruction with approximate thermal size: 113.09 km effective diameter (catalog ±2.15 km; additional shape and thermal-model uncertainty). An alternative pole solution remains in the archive. Thermal size is used as a volume-scale approximation; no surface imagery exists.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Galatea's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 24 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #3b3b39, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=74) lists, 4.3% ± 0.2%, from the IRAS Minor Planet Survey (PDS data set IRAS-A-FPA-3-RDR-IMPS-V6.0).

## Evidence

The galatea-74 results record a maximum sampled source-to-display distance of **419.02 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Absolute rotational phase is illustrative.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. Alternative archive solutions: model 6182, pole ['109', '1'], [Model 6182](https://damit.cuni.cz/projects/damit/asteroid_models/view/6182)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 0.99999993008496102 source units³; an independent triangle-centroid divergence sum gives 0.99999993008496124. The existing recipe applies one uniform scale of 91.150087164115305 km per source unit so its volume-equivalent diameter is 113.09 km.

No unit-volume assumption is made. Radius above a 56.545 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (289°, 14°), with sidereal period 17.2675 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to the fewest faces the error allowance permits, 384 of at most 800, and emits native PolyCSS `u` triangles from an atlas of 13,107,200 texels. The error allowance is 1130.9 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
