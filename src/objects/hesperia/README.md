# (69) Hesperia

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 319](https://damit.cuni.cz/projects/damit/asteroid_models/view/319) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **319**, version **2011-04-21**. DAMIT, Astronomical Institute of Charles University; Hanuš (2011), Hanuš et al. (2013); model 319, version 2011-04-21.

Convex light-curve reconstruction, 109 ± 11 km volume-equivalent diameter in the selected archive record. An alternative pole solution remains in the archive. No surface imagery exists; rotational phase is illustrative.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Hesperia's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 20 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #6a6965, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=69) lists, 14% ± 1%, from the IRAS Minor Planet Survey (PDS data set IRAS-A-FPA-3-RDR-IMPS-V6.0).

## Evidence

The hesperia results record a maximum sampled source-to-display distance of **503.80 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the color is one whole-disc mean. Alternative archive solutions: model 320, pole ['71', '-2'], [Model 320](https://damit.cuni.cz/projects/damit/asteroid_models/view/320)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 678075.60203524865 source units³; an independent triangle-centroid divergence sum gives 678075.60203524865. The existing recipe applies one uniform scale of 0.99999999839203824 km per source unit so its volume-equivalent diameter is 109 km.

No unit-volume assumption is made. Radius above a 54.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (250°, 17°), with sidereal period 5.65534 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to the fewest faces the error allowance permits, 406 of at most 800, and emits native PolyCSS `u` triangles from an atlas of 13,107,200 texels. The error allowance is 1090 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
