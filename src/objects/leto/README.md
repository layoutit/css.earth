# (68) Leto

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 290](https://damit.cuni.cz/projects/damit/asteroid_models/view/290) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **290**, version **2011-02-11**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2011), Hanuš (2011), Hanuš et al. (2013); model 290, version 2011-02-11.

Convex light-curve reconstruction, 148 ± 25 km volume-equivalent diameter in the selected archive record. No surface imagery exists; rotational phase is illustrative.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Leto's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 24 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #888377, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=68) lists, 22.8% ± 2.8%, from NEOWISE (Masiero et al. 2014, ApJ 791, 121; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

The leto results record a maximum sampled source-to-display distance of **393.81 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. The survey found no alternative archive solution for this target.

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1016 vertices and 2028 triangles. Its signed tetrahedral volume is 1697398.7793295216 source units³; an independent triangle-centroid divergence sum gives 1697398.7793295216. The existing recipe applies one uniform scale of 0.99999991017918988 km per source unit so its volume-equivalent diameter is 148 km.

No unit-volume assumption is made. Radius above a 74 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (103°, 43°), with sidereal period 14.8455 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1480 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
