# (196) Philomela

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 178](https://damit.cuni.cz/projects/damit/asteroid_models/view/178) |
| Physical scale | [JPL Small-Body Database, physical parameters of (196) Philomela](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=196) ([record](source/reference/calibration.json)) |

[DAMIT model 178](https://damit.cuni.cz/projects/damit/asteroid_models/view/178), version 2007-02-27, is a convex light-curve inversion mesh from [J. Ďurech (2007), Astron. Astrophys. 465, 331](https://damit.cuni.cz/projects/damit/references/view/113), *Physical models of ten asteroids from an observers' collaboration network*. The original 1598 vertices and 3192 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

The archive also holds model [179](https://damit.cuni.cz/projects/damit/asteroid_models/view/179) with pole λ = 276°, β = -49° and period 8.332827 h. Light curves do not tell the two poles apart; the selected one is not claimed to be unique.

Adopted diameter: **144.626 ± 4.085 km**, meaning effective diameter of a sphere fitted to thermal infrared measurements, from [JPL Small-Body Database, physical parameters of (196) Philomela](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=196). The reference-sphere radius is 72.313 km. JPL lists a diameter of 144.626 ± 4.085 km, from NEOWISE (Masiero et al. 2014, ApJ 791, 121; PDS bundle neowise_diameters_albedos 2.0). The thermal sphere diameter is transferred to the mesh as its volume-equivalent diameter.

[Model fields and mesh measurements](source/reference/damit-model.json).

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Philomela's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 18 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #a49d90, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=196) lists, 34.2% ± 4%, from NEOWISE (Masiero et al. 2012, ApJ 759, L8; PDS bundle neowise_diameters_albedos 2.0).

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

The source's signed tetrahedral volume integral is 1.0000000134 source units cubed, giving a volume-equivalent diameter of 1.24070098733 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 116567.973651376`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 111°, β = -41° and sidereal period 8.332826 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 106.60°, δ = -18.76°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/492/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
