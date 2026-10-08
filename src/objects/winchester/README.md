# (747) Winchester

The shape is painted in one measured whole-disc color at the measured brightness; no surface detail is mapped.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 247](https://damit.cuni.cz/projects/damit/asteroid_models/view/247) |
| Physical scale | [DAMIT model 247, version 2011-02-18](https://damit.cuni.cz/projects/damit/asteroid_models/view/247) ([record](source/reference/calibration.json)) |

[DAMIT model 247](https://damit.cuni.cz/projects/damit/asteroid_models/view/247), version 2011-02-18, is a convex light-curve inversion mesh from [A. Marciniak et al. (2009), Astron. Astrophys. 498, 313](https://damit.cuni.cz/projects/damit/references/view/129), *Photometry and models of selected main belt asteroids VI. 160 Una, 747 Winchester, and 849 Ara*; [Ďurech et al. (2011), Icarus 214, 652](https://damit.cuni.cz/projects/damit/references/view/139), *Combining asteroid models derived by lightcurve inversion with asteroidal occultation silhouettes*. The original 1022 vertices and 2040 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

Adopted diameter: **171 ± 15 km**, meaning volume-equivalent diameter DAMIT lists for this size-calibrated model, from [DAMIT model 247, version 2011-02-18](https://damit.cuni.cz/projects/damit/asteroid_models/view/247). The reference-sphere radius is 85.5 km. DAMIT marks the model as size-calibrated and lists an equivalent diameter of 171 ± 15 km with it; the model references describe the scaling.

[Model fields and mesh measurements](source/reference/damit-model.json).

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Winchester's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 29 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #403f3d, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=747) lists, 5% ± 0.2%, from the IRAS Minor Planet Survey (PDS data set IRAS-A-FPA-3-RDR-IMPS-V6.0).

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

The source's signed tetrahedral volume integral is 2618104.1804 source units cubed, giving a volume-equivalent diameter of 170.999996149 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 1000.00002252238`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 304°, β = -60° and sidereal period 9.4148 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 352.70°, δ = -73.63°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/808/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
