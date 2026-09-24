# 2P/Encke

The navigation snapshot uses the same retained shape and viewing direction, with prepared full-phase lighting (35% ambient, 65% diffuse). Its neutral gray material remains a display convention without observed surface detail. The snapshot recipe is recorded in [the source manifest](source/manifest.json); the selected-body geometry and scientific assets are unchanged.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| View | Source | Meaning |
| --- | --- | --- |
| Shape approximation | [Harmon & Nolan (2005), Table 3, SAM1](https://doi.org/10.1016/j.icarus.2005.01.012) | A smooth ellipsoid constrained by published radar dimensions; no photographic texture or resolved terrain. |
| Position | [JPL Horizons records](source/reference/) | Heliocentric ICRF, 3 September 2026 TT. |

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

The [two-comet report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/ENCKE-LINEAR.md) links the recorded
shape, source-restoration, delivery and browser checks, including the failed
checks and limits of that run.

## Known problems

Table 3 gives **a = 4.58 km** and **a/b = 2.60** for the 11.1-hour SAM1 case. Here a is a semiaxis, so the full length is 9.16 km and both short dimensions are 3.5230769 km.

The paper also considers a/b = 2.04 and a slower SAM2 solution. The selected case gives the closest match to the reported infrared size, but does not establish a unique shape.

Its projected-area effective radius is not a measured volume: this package uses the absolute model axes directly. No uniform spin is inferred from the dominant tumbling period.

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

The camera reference radius is the cube root of the semiaxis product: 2.422236697 km. It only sets the package's length scale; the rendered geometry retains the three separate axes. The shared parameter loader's `published-semiaxes` convention converts kilometres directly to metres and rejects mixed thermal-radius inputs.

</details>

<a id="position-and-preparation"></a>

<details>
<summary>Position and preparation</summary>

Original JPL Horizons elements and independent geometric vectors are checked in under `source/reference/`, including exact request URLs. They use heliocentric ICRF kilometres at JD 2461286.5 (3 September 2026 TT; the queried TDB difference is below 2 ms). The scene holds this epoch. The nearby ±30-day vectors test the existing conic approximation; it is not a long-term propagation or outgassing model.

A subdivided octahedron gives 2,048 source triangles. The shared meshoptimizer recipe reduces it to 800 within a 100 m preparation tolerance. Closed topology and sampled distance to the analytic ellipsoid are checked independently. This geometric approximation tolerance is not observational accuracy. All grid textures, normals, lighting banks, thumbnails, navigation images and bindings are prepared before runtime.

</details>

The checked-in context PNG is regenerated and byte-checked by the existing radial snapshot recipe. Shared commands are in the [body contributor guide](../README.md).
