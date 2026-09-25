# (3103) Eger

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 458](https://damit.cuni.cz/projects/damit/asteroid_models/view/458) |
| Physical scale | [Trilling et al. (2010), AJ 140, 770](https://doi.org/10.1088/0004-6256/140/3/770) ([record](source/reference/calibration.json)) |

[DAMIT model 458](https://damit.cuni.cz/projects/damit/asteroid_models/view/458), version 2012-09-20, is a nonconvex mesh fitted to light curves, including ones at phase angles above 75 degrees from [Ďurech et al. (2012), A&A 547, A10](https://damit.cuni.cz/projects/damit/references/view/144), *Analysis of the rotation period of asteroids (1865) Cerberus, (2100) Ra-Shalom, and (3103) Eger - search for the YORP effect*. The original 402 vertices and 800 triangular faces are the source input. Large concavities appear where the data constrain them; craters, surface texture and the current rotation phase are not resolved. The authors needed a nonconvex model because no convex one fitted the high-phase light curves, and they call this mesh one of many similar solutions whose main concavity is likely real. DAMIT's later [model 459](https://damit.cuni.cz/projects/damit/asteroid_models/view/459) (Ďurech et al. 2018) is convex.

Adopted diameter: **1.79 ± 0.36 km**, meaning thermal-model effective diameter, from [Trilling et al. (2010), AJ 140, 770](https://doi.org/10.1088/0004-6256/140/3/770). The reference-sphere radius is 0.895 km. Trilling et al. (2010) Table 1 lists D = 1.79 km for (3103) Eger from Warm Spitzer; section 4 estimates the total diameter uncertainty at about 20%, taken here as 0.36 km. Ďurech et al. (2012) scaled this mesh to the same diameter (1.78 km in their text).

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Checked 2026-09-25 by `tools/objects/source-authoring/damit-asteroids/author.mts` from the pinned [inputs](../../../tools/objects/source-authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic 2. The shape, spin, JPL records and every derived record are declared in the [input manifest](source/manifest.json).

## Known problems

- No registered surface imagery exists for this asteroid; the shape shows the shared neutral gray. The nonconvex model leaves craters and fine relief unresolved.
- Transferring a thermal sphere diameter to the mesh volume is approximate. The quoted fit error excludes shape, spin and thermal-model systematics.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. The measured YORP spin-up (1.4e-8 rad/day²) is recorded but not propagated. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is 1.0000000497 source units cubed, giving a volume-equivalent diameter of 1.24070100237 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 1442.73277492642`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 219°, β = -70° and sidereal period 5.710153 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 146.44°, δ = -71.40°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/1785/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
