# (663) Gerlinde

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5661](https://damit.cuni.cz/projects/damit/asteroid_models/view/5661) |
| Physical scale | [JPL Small-Body Database, physical parameters of (663) Gerlinde](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=663) ([record](source/reference/calibration.json)) |

[DAMIT model 5661](https://damit.cuni.cz/projects/damit/asteroid_models/view/5661), version 2019-10-23, is a convex light-curve inversion mesh from [Ďurech et al. (2020), Astronomy and Astrophysics 643, A59](https://damit.cuni.cz/projects/damit/references/view/658), *Asteroid models reconstructed from ATLAS photometry*. The original 574 vertices and 1144 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

Adopted diameter: **107.795 ± 1.571 km**, meaning effective diameter of a sphere fitted to thermal infrared measurements, from [JPL Small-Body Database, physical parameters of (663) Gerlinde](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=663). The reference-sphere radius is 53.8975 km. JPL lists a diameter of 107.795 ± 1.571 km, from NEOWISE (Masiero et al. 2012, ApJ 759, L8; PDS bundle neowise_diameters_albedos 2.0). The thermal sphere diameter is transferred to the mesh as its volume-equivalent diameter.

[Model fields and mesh measurements](source/reference/damit-model.json).

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Gerlinde's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 24 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #32312f, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=663) lists, 3.1% ± 0.4%, from NEOWISE (Masiero et al. 2012, ApJ 759, L8; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

Checked 2026-10-08 by `packages/bake/authoring/damit-asteroids/author.mts` from the pinned [inputs](../../../packages/bake/authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic 2. The shape, spin, JPL records and every derived record are declared in the [input manifest](source/manifest.json).

## Known problems

- No registered surface imagery exists for this asteroid; the shape shows one whole-disc color. Convex inversion leaves concavities and fine relief unresolved.
- Transferring a thermal sphere diameter to the mesh volume is approximate. The quoted fit error excludes shape, spin and thermal-model systematics.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Credits](NOTICE.md)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is 0.99999976918 source units cubed, giving a volume-equivalent diameter of 1.24070088634 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 86882.3430264599`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 229°, β = 31° and sidereal period 10.2536 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 234.84°, δ = 12.43°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/60914/IAUspin) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
