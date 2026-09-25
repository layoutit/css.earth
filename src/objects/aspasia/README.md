# (409) Aspasia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 715](https://damit.cuni.cz/projects/damit/asteroid_models/view/715) |
| Physical scale | [DAMIT model 715 calibrated size, Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/asteroid_models/view/715) ([record](source/reference/calibration.json)) |

[DAMIT model 715](https://damit.cuni.cz/projects/damit/asteroid_models/view/715), version 2017-06-19, is a nonconvex mesh fitted to light curves, adaptive-optics images and stellar occultations from [Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/references/view/169), *Volumes and bulk densities of forty asteroids from ADAM shape modeling*; [Hanuš et al. (2013), Icarus 226, 1045](https://damit.cuni.cz/projects/damit/references/view/149), *Sizes of main-belt asteroids by combining shape models and Keck Adaptive Optics observations*. The original 402 vertices and 800 triangular faces are the source input. Large concavities appear where the data constrain them; craters, surface texture and the current rotation phase are not resolved.

Adopted diameter: **164 ± 3 km**, meaning volume-equivalent diameter of the archived ADAM model, from [DAMIT model 715 calibrated size, Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/asteroid_models/view/715). The reference-sphere radius is 82 km. DAMIT marks model 715 as size-calibrated (D = 164 km, σ = 3 km), the volume-equivalent diameter of this ADAM solution. Hanuš et al. (2017) Table 4 lists 164 ± 3 km for the publication fit; the archived release is kept as archived. The fit used 22 light curves, 9 adaptive-optics images and 3 occultations (Table 3).

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

The source's signed tetrahedral volume integral is 2321042.4535 source units cubed, giving a volume-equivalent diameter of 164.271221782 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 998.348939157290`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 4°, β = 29° and sidereal period 9.02145 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 351.08°, δ = 27.97°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/659/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
