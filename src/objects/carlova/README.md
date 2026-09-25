# (360) Carlova

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1811](https://damit.cuni.cz/projects/damit/asteroid_models/view/1811) |
| Physical scale | [DAMIT model 1811 calibrated size, Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/asteroid_models/view/1811) ([record](source/reference/calibration.json)) |

[DAMIT model 1811](https://damit.cuni.cz/projects/damit/asteroid_models/view/1811), version 2017-06-16, is a nonconvex mesh fitted to light curves, adaptive-optics images and stellar occultations from [Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/references/view/169), *Volumes and bulk densities of forty asteroids from ADAM shape modeling*. The original 402 vertices and 800 triangular faces are the source input. Large concavities appear where the data constrain them; craters, surface texture and the current rotation phase are not resolved.

Adopted diameter: **137 ± 3 km**, meaning volume-equivalent diameter of the archived ADAM model, from [DAMIT model 1811 calibrated size, Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/asteroid_models/view/1811). The reference-sphere radius is 68.5 km. DAMIT marks model 1811 as size-calibrated (D = 137 km, σ = 3 km), the volume-equivalent diameter of this ADAM solution. Hanuš et al. (2017) Table 4 lists 135 ± 3 km for the publication fit; the archived release is kept as archived. The fit used 9 light curves, 2 adaptive-optics images and 1 occultation (Table 3).

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Checked 2026-09-25 by `tools/objects/source-authoring/damit-asteroids/author.mts` from the pinned [inputs](../../../tools/objects/source-authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic 2. The shape, spin, JPL records and every derived record are declared in the [input manifest](source/manifest.json).

## Known problems

- No registered surface imagery exists for this asteroid; the shape shows the shared neutral gray. The nonconvex model leaves craters and fine relief unresolved.
- The scale inherits the quoted uncertainty of its published fit.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is 1336869.2985 source units cubed, giving a volume-equivalent diameter of 136.677421131 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 1002.36014746257`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 355°, β = 55° and sidereal period 6.189593 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 326.96°, δ = 47.03°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/613/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
