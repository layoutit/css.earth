# (1862) Apollo

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 273](https://damit.cuni.cz/projects/damit/asteroid_models/view/273) |
| Physical scale | [Rozitis et al. (2013), A&A 555, A20, Table 3 ('Original' shape variant)](https://arxiv.org/abs/1305.3109) ([record](source/reference/calibration.json)) |

[DAMIT model 273](https://damit.cuni.cz/projects/damit/asteroid_models/view/273), version 2007-08-29, is a convex light-curve inversion mesh from [Kaasalainen et al. (2007), Nature 446, 420](https://damit.cuni.cz/projects/damit/references/view/114), *Acceleration of the rotation of asteroid 1862 Apollo by radiation torques*; [Ďurech et al. (2008), A&A 488, 345](https://damit.cuni.cz/projects/damit/references/view/118), *New photometric observations of asteroids (1862) Apollo and (25143) Itokawa - an analysis of YORP effect*. The original 1022 vertices and 2040 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

Adopted diameter: **1.68 ± 0.09 km**, meaning thermophysical effective diameter fitted with this shape model, from [Rozitis et al. (2013), A&A 555, A20, Table 3 ('Original' shape variant)](https://arxiv.org/abs/1305.3109). The reference-sphere radius is 0.84 km. Table 2 lists the fitted shape as 1022 vertices and 2040 facets with pole (48°, −72°) and period 3.065448 h from Ďurech et al. (2008a), the same counts, pole and period as DAMIT model 273. Table 3 gives 1.68 ± 0.09 km for this 'Original' shape. The paper notes that this size overestimates the radar maximum equatorial diameter (2.07 ± 0.07 km) by a factor of 1.17 and prefers a reshaped variant at 1.55 ± 0.07 km; that variant mesh is not archived.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Checked 2026-09-21 by `tools/objects/source-authoring/damit-asteroids/author.mts` from the pinned [inputs](../../../tools/objects/source-authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic 2. The shape, spin, JPL records and every derived record are pinned by bytes and SHA-256 in the [input manifest](source/manifest.json).

## Known problems

- The grid marks unmapped coverage: no registered surface imagery exists for this asteroid. Convex inversion leaves concavities and fine relief unresolved.
- The scale inherits the quoted uncertainty of its published fit.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. The measured YORP spin-up (5.5e-8 rad/day²) is recorded but not propagated. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is 0.99999975837 source units cubed, giving a volume-equivalent diameter of 1.24070088187 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 1354.07335043571`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 48°, β = -72° and sidereal period 3.065448 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 70.66°, δ = -51.37°. Model longitude zero is an inversion convention, not an observed landmark.

</details>
