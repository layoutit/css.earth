# 209P/LINEAR

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| View | Source | Meaning |
| --- | --- | --- |
| Shape approximation | [Schleicher & Knight (2016), §2.2, citing Howell et al. (2014)](https://doi.org/10.3847/0004-6256/152/4/89) | A smooth ellipsoid constrained by published radar dimensions; no photographic texture or resolved terrain. |
| Position | [JPL Horizons records](source/reference/) | Heliocentric ICRF, 3 September 2026 TT. |

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

The [two-comet report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/ENCKE-LINEAR.md) links the recorded
shape, source-restoration, delivery and browser checks, including the failed
checks and limits of that run.

## Known problems

Section 2.2 reports **3.9 × 2.7 × 2.6 km** as full radar dimensions, citing Howell et al. (2014). The ellipsoid semiaxes are therefore 1.95, 1.35 and 1.30 km.

The original DPS 2014 abstract 209.24 reports an earlier projected estimate of about 2.5 × 3 km and explicitly cautions that the images may not determine a detailed shape.

This package uses the later three-axis values as reported by Schleicher & Knight (2016), not an independently retrieved radar mesh. Their optical lightcurve supports the 10.93-hour period; no pole solution or absolute rotational phase is claimed.

The model is centered on the analytic ellipsoid, with X along its longest semiaxis and Z along the shortest.

The model axes have a fixed **illustrative** orientation (RA 0°, Dec 90°, meridian 0°), not a recovered inertial attitude.

The opt-in Shadows bank illustrates illumination on this attitude, not a reconstruction of the radar encounter.

No original radar surface mesh was identified in the surveyed releases. Delay-Doppler images constrain geometry; they are not optical surface maps.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

<a id="source-selection"></a>

Source selection and unresolved alternatives are recorded in the [investigation ledger](investigations.json).

<a id="dimensions-and-limits"></a>

<details>
<summary>Dimensions and limits</summary>

The camera reference radius is the cube root of the semiaxis product: 1.506967585 km. It only sets the package's length scale; the rendered geometry retains the three separate axes. The shared parameter loader's `published-semiaxes` convention converts kilometres directly to metres and rejects mixed thermal-radius inputs.

</details>

<a id="position-and-preparation"></a>

<details>
<summary>Position and preparation</summary>

Original JPL Horizons elements and independent geometric vectors are checked in under `source/reference/`, including exact request URLs. They use heliocentric ICRF kilometres at JD 2461286.5 (3 September 2026 TT; the queried TDB difference is below 2 ms). The scene holds this epoch. The nearby ±30-day vectors test the existing conic approximation; it is not a long-term propagation or outgassing model.

A subdivided octahedron gives 2,048 source triangles. The shared meshoptimizer recipe reduces it to 800 within a 100 m preparation tolerance. Closed topology and sampled distance to the analytic ellipsoid are checked independently. This geometric approximation tolerance is not observational accuracy. All grid textures, normals, lighting banks, thumbnails, navigation images and bindings are prepared before runtime.

</details>

The checked-in context PNG is regenerated and byte-checked by the existing radial snapshot recipe. Shared commands are in the [body contributor guide](../README.md).
