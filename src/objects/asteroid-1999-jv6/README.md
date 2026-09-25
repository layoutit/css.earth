# (85990) 1999 JV6

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 4390](https://damit.cuni.cz/projects/damit/asteroid_models/view/4390) |
| Physical scale | [DAMIT model 4390 calibrated size, Rożek et al. (2019), A&A 631, A149](https://damit.cuni.cz/projects/damit/asteroid_models/view/4390) ([record](source/reference/calibration.json)) |

[DAMIT model 4390](https://damit.cuni.cz/projects/damit/asteroid_models/view/4390), version 2020-01-28 (archive comment: "model reconstructed from lightcurves and radar observations"), is a nonconvex mesh fitted to light curves and radar delay-Doppler images from [Rożek et al. (2019), A&A 631, A149](https://damit.cuni.cz/projects/damit/references/view/647), *Shape model and spin-state analysis of PHA contact binary (85990) 1999 JV6 from combined radar and optical observations*. The original 1948 vertices and 3892 triangular faces are the source input. Large concavities appear where the data constrain them; craters, surface texture and the current rotation phase are not resolved. DAMIT also holds a convex light-curve model of the same asteroid, [model 4389](https://damit.cuni.cz/projects/damit/asteroid_models/view/4389); the radar-constrained model is the one that resolves its two lobes.

Adopted diameter: **0.448 ± 0.02 km**, meaning volume-equivalent diameter of the archived radar and light-curve model, from [DAMIT model 4390 calibrated size, Rożek et al. (2019), A&A 631, A149](https://damit.cuni.cz/projects/damit/asteroid_models/view/4390). The reference-sphere radius is 0.224 km. DAMIT marks model 4390 as size-calibrated (D = 0.448 km, σ = 0.02 km); radar delay-Doppler images fix the scale. NEOWISE lists 0.451 ± 0.026 km (JPL SBDB), consistent within the quoted error.

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

The source's signed tetrahedral volume integral is 0.047162271085 source units cubed, giving a volume-equivalent diameter of 0.448262108205 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 999.415279139989`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 132°, β = -86° and sidereal period 6.53679 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 96.00°, δ = -63.46°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/50444/IAUspin) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
