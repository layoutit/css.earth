# (158) Koronis

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 167](https://damit.cuni.cz/projects/damit/asteroid_models/view/167) |
| Physical scale | [DAMIT model 167 calibrated size, Ďurech et al. (2011), Icarus 214, 652](https://damit.cuni.cz/projects/damit/asteroid_models/view/167) ([record](source/reference/calibration.json)) |

[DAMIT model 167](https://damit.cuni.cz/projects/damit/asteroid_models/view/167), version 2011-03-28 (archive comment: "preliminary model"), is a convex light-curve inversion mesh from [Slivan et al. (2003), Icarus 162, 285](https://damit.cuni.cz/projects/damit/references/view/105), *Spin vectors in the Koronis family: Comprehensive results from two independent analyses of 213 rotation lightcurves*; [Ďurech et al. (2011), Icarus 214, 652](https://damit.cuni.cz/projects/damit/references/view/139), *Combining asteroid models derived by lightcurve inversion with asteroidal occultation silhouettes*. The original 1022 vertices and 2040 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

Adopted diameter: **38 ± 5 km**, meaning occultation-constrained volume-equivalent diameter, from [DAMIT model 167 calibrated size, Ďurech et al. (2011), Icarus 214, 652](https://damit.cuni.cz/projects/damit/asteroid_models/view/167). The reference-sphere radius is 19 km. DAMIT marks model 167 as size-calibrated (D = 38 km, σ = 5 km) and archives the 2005-12-13 occultation fit to this mesh. DAMIT labels the model 'preliminary'. NEOWISE lists 39.025 ± 0.462 km (Masiero et al. 2014), consistent within the quoted error.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Checked 2026-09-21 by `tools/objects/source-authoring/damit-asteroids/author.mts` from the pinned [inputs](../../../tools/objects/source-authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic 2. The shape, spin, JPL records and every derived record are pinned by bytes and SHA-256 in the [input manifest](source/manifest.json).

## Known problems

- The grid marks unmapped coverage: no registered surface imagery exists for this asteroid. Convex inversion leaves concavities and fine relief unresolved.
- The scale inherits the quoted uncertainty of its published fit.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is 28730.910805 source units cubed, giving a volume-equivalent diameter of 37.9999994667 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 1000.00001403442`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 30°, β = -64° and sidereal period 14.20569 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 55.80°, δ = -47.51°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/445/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
