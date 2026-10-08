# (34) Circe

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 129](https://damit.cuni.cz/projects/damit/asteroid_models/view/129) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **129**, version **2011-03-28**. DAMIT, Astronomical Institute of Charles University; J. Ďurech et al. (2009), Ďurech et al. (2011), Hanuš et al. (2013); model 129, version 2011-03-28.

Convex light-curve reconstruction, 107 ± 10 km volume-equivalent diameter in the selected archive record. An alternative pole solution remains in the archive. No surface imagery exists; rotational phase is illustrative.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Circe's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 20 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #292a28, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=34) lists, 2.3% ± 0.6%, from NEOWISE (Nugent et al. 2016, AJ 152, 63; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

The circe results record a maximum sampled source-to-display distance of **260.29 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. Alternative archive solutions: model 128, pole ['94', '35'], [Model 128](https://damit.cuni.cz/projects/damit/asteroid_models/view/128)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 900 vertices and 1796 triangles. Its signed tetrahedral volume is 641430.95675392763 source units³; an independent triangle-centroid divergence sum gives 641430.95675392763. The existing recipe applies one uniform scale of 1.0000000301936045 km per source unit so its volume-equivalent diameter is 107 km.

No unit-volume assumption is made. Radius above a 53.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (275°, 51°), with sidereal period 12.1746 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to the fewest faces the error allowance permits, 354 of at most 800, and emits native PolyCSS `u` triangles from an atlas of 13,107,200 texels. The error allowance is 1070 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
