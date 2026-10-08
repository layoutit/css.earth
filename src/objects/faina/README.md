# (751) Faina

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 6183](https://damit.cuni.cz/projects/damit/asteroid_models/view/6183) |
| Physical scale | [JPL Small-Body Database, physical parameters of (751) Faina](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=751) ([record](source/reference/calibration.json)) |

[DAMIT model 6183](https://damit.cuni.cz/projects/damit/asteroid_models/view/6183), version 2022-02-14, is a convex light-curve inversion mesh from [Hanuš et al. (2021), Astronomy and Astrophysics 654, A48](https://damit.cuni.cz/projects/damit/references/view/662), *V-band photometry of asteroids from ASAS-SN. Finding asteroids with slow spin*. The original 1011 vertices and 2018 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

The archive also holds model [6184](https://damit.cuni.cz/projects/damit/asteroid_models/view/6184) with pole λ = 339°, β = -10° and period 23.673 h. Light curves do not tell the two poles apart; the selected one is not claimed to be unique.

Adopted diameter: **113.699 ± 2.449 km**, meaning effective diameter of a sphere fitted to thermal infrared measurements, from [JPL Small-Body Database, physical parameters of (751) Faina](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=751). The reference-sphere radius is 56.8495 km. JPL lists a diameter of 113.699 ± 2.449 km, from NEOWISE (Masiero et al. 2014, ApJ 791, 121; PDS bundle neowise_diameters_albedos 2.0). The thermal sphere diameter is transferred to the mesh as its volume-equivalent diameter.

[Model fields and mesh measurements](source/reference/damit-model.json).

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Faina's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 20 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #2d2e2c, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=751) lists, 2.7% ± 1.3%, from NEOWISE (Masiero et al. 2017, AJ 154, 168; PDS bundle neowise_diameters_albedos 2.0).

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

The source's signed tetrahedral volume integral is 1.0000001869 source units cubed, giving a volume-equivalent diameter of 1.24070105908 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 91640.9308817835`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 158°, β = 25° and sidereal period 23.6727 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 170.32°, δ = 31.52°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/66409/IAUspin) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
