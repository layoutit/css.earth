# (419) Aurelia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1834](https://damit.cuni.cz/projects/damit/asteroid_models/view/1834) |
| Physical scale | [DAMIT model 1834 calibrated size, Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/asteroid_models/view/1834) ([record](source/reference/calibration.json)) |

[DAMIT model 1834](https://damit.cuni.cz/projects/damit/asteroid_models/view/1834), version 2017-06-19, is a nonconvex mesh fitted to light curves, adaptive-optics images and stellar occultations from [Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/references/view/169), *Volumes and bulk densities of forty asteroids from ADAM shape modeling*. The original 402 vertices and 800 triangular faces are the source input. Large concavities appear where the data constrain them; craters, surface texture and the current rotation phase are not resolved.

The archive also holds model [1833](https://damit.cuni.cz/projects/damit/asteroid_models/view/1833) with pole λ = 354°, β = 44° and period 16.7809 h (fitted diameter 121 ± 3 km). Light curves do not tell the two poles apart; the selected one is not claimed to be unique.

Adopted diameter: **125 ± 3 km**, meaning volume-equivalent diameter of the archived ADAM model, from [DAMIT model 1834 calibrated size, Hanuš et al. (2017), A&A 601, A114](https://damit.cuni.cz/projects/damit/asteroid_models/view/1834). The reference-sphere radius is 62.5 km. DAMIT marks model 1834 as size-calibrated (D = 125 km, σ = 3 km), the volume-equivalent diameter of this ADAM solution. Hanuš et al. (2017) Table 4 lists 125 ± 3 km for the publication fit; the archived release is kept as archived. The fit used 47 light curves, 1 adaptive-optics image and 1 occultation (Table 3). Both pole solutions reproduce the adaptive-optics and occultation data; the paper says the second pole (this model) "might be preferred" but does not reject the first.

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

The source's signed tetrahedral volume integral is 1021830.8930 source units cubed, giving a volume-equivalent diameter of 124.966460369 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 1000.26838906366`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 174°, β = 36° and sidereal period 16.7809 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 190.99°, δ = 34.95°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/4346/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
