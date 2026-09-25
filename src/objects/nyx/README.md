# (3908) Nyx

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 278](https://damit.cuni.cz/projects/damit/asteroid_models/view/278) |
| Physical scale | [Benner et al. (2002), Icarus 158, 379](https://doi.org/10.1006/icar.2002.6869) ([record](source/reference/calibration.json)) |

[DAMIT model 278](https://damit.cuni.cz/projects/damit/asteroid_models/view/278), version 2007-02-27, is a nonconvex mesh fitted to light curves from [Kaasalainen et al. (2004), Icarus 167, 178](https://damit.cuni.cz/projects/damit/references/view/107), *Photometry and models of eight near-Earth asteroids*. The original 258 vertices and 512 triangular faces are the source input. Large concavities appear where the data constrain them; craters, surface texture and the current rotation phase are not resolved. DAMIT also holds a convex model from the same paper, [model 277](https://damit.cuni.cz/projects/damit/asteroid_models/view/277), with pole (292°, 71°).

Adopted diameter: **1 ± 0.15 km**, meaning radar-derived diameter, from [Benner et al. (2002), Icarus 158, 379](https://doi.org/10.1006/icar.2002.6869). The reference-sphere radius is 0.5 km. JPL SBDB lists the diameter 1.0 ± 0.15 km with the reference Benner et al. (2002), Icarus 158, 379-388, from Arecibo and Goldstone radar. The radar diameter is transferred to the light-curve mesh volume; it is not a fit to this mesh.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Checked 2026-09-25 by `tools/objects/source-authoring/damit-asteroids/author.mts` from the pinned [inputs](../../../tools/objects/source-authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic 2. The shape, spin, JPL records and every derived record are declared in the [input manifest](source/manifest.json).

## Known problems

- No registered surface imagery exists for this asteroid; the shape shows the shared neutral gray. The nonconvex model leaves craters and fine relief unresolved.
- Transferring a radar diameter measured independently of this mesh to its volume is approximate.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is 0.99999995998 source units cubed, giving a volume-equivalent diameter of 1.24070096525 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 805.995987761541`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 290°, β = 68° and sidereal period 4.42601 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 280.49°, δ = 45.29°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/932/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
