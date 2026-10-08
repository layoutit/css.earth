# (349) Dembowska

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 204](https://damit.cuni.cz/projects/damit/asteroid_models/view/204) |
| Physical scale | [DAMIT model 204, version 2008-02-21](https://damit.cuni.cz/projects/damit/asteroid_models/view/204) ([record](source/reference/calibration.json)) |

[DAMIT model 204](https://damit.cuni.cz/projects/damit/asteroid_models/view/204), version 2008-02-21, is a convex light-curve inversion mesh from [Torppa et al. (2003), Icarus 164, 346-383](https://damit.cuni.cz/projects/damit/references/view/106), *Shapes and rotational properties of thirty asteroids from photometric data*; [Hanuš et al. (2013), Icarus 226, 1045-1057](https://damit.cuni.cz/projects/damit/references/view/149), *Sizes of main-belt asteroids by combining shape models and Keck Adaptive Optics observations*. The original 1022 vertices and 2040 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

Adopted diameter: **162 ± 17 km**, meaning volume-equivalent diameter DAMIT lists for this size-calibrated model, from [DAMIT model 204, version 2008-02-21](https://damit.cuni.cz/projects/damit/asteroid_models/view/204). The reference-sphere radius is 81 km. DAMIT marks the model as size-calibrated and lists an equivalent diameter of 162 ± 17 km with it; the model references describe the scaling.

[Model fields and mesh measurements](source/reference/damit-model.json).

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Dembowska's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 31 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #b0a593, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=349) lists, 38.4% ± 2.5%, from the IRAS Minor Planet Survey (PDS data set IRAS-A-FPA-3-RDR-IMPS-V6.0).

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

The source's signed tetrahedral volume integral is 2226094.8229 source units cubed, giving a volume-equivalent diameter of 161.999999215 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 1000.00000484688`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 322°, β = 18° and sidereal period 4.701204 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 318.63°, δ = 2.90°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/604/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
