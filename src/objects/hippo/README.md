# (426) Hippo

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 16298](https://damit.cuni.cz/projects/damit/asteroid_models/view/16298) |
| Physical scale | [DAMIT model 16298, version 2023-10-03](https://damit.cuni.cz/projects/damit/asteroid_models/view/16298) ([record](source/reference/calibration.json)) |

[DAMIT model 16298](https://damit.cuni.cz/projects/damit/asteroid_models/view/16298), version 2023-10-03 (archive comment: "preferred"), is a convex light-curve inversion mesh from [Marciniak et al. (2023), Astronomy and Astrophysics 679, A60](https://damit.cuni.cz/projects/damit/references/view/667), *Scaling slowly rotating asteroids with stellar occultations*. The original 1018 vertices and 2032 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

The archive also holds model [16297](https://damit.cuni.cz/projects/damit/asteroid_models/view/16297) with pole λ = 62°, β = -49° and period 67.5038 h (fitted diameter 129 ± 19 km). Light curves do not tell the two poles apart; the selected one is not claimed to be unique.

Adopted diameter: **122 ± 4 km**, meaning volume-equivalent diameter DAMIT lists for this size-calibrated model, from [DAMIT model 16298, version 2023-10-03](https://damit.cuni.cz/projects/damit/asteroid_models/view/16298). The reference-sphere radius is 61 km. DAMIT marks the model as size-calibrated and lists an equivalent diameter of 122 ± 4 km with it; the model references describe the scaling.

[Model fields and mesh measurements](source/reference/damit-model.json).

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Hippo's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 22 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #393836, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=426) lists, 4% ± 0.9%, from NEOWISE (Masiero et al. 2012, ApJ 759, L8; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

Checked 2026-10-08 by `packages/bake/authoring/damit-asteroids/author.mts` from the pinned [inputs](../../../packages/bake/authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic 2. The shape, spin, JPL records and every derived record are declared in the [input manifest](source/manifest.json).

## Known problems

- No registered surface imagery exists for this asteroid; the shape shows one whole-disc color. Convex inversion leaves concavities and fine relief unresolved.
- The scale inherits the quoted uncertainty of its published fit.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Credits](NOTICE.md)

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is 950775.77908 source units cubed, giving a volume-equivalent diameter of 121.999999556 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 1000.00000364190`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 223°, β = -89° and sidereal period 67.5041 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 91.89°, δ = -67.23°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/128020/IAUspin) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
