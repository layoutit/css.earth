# (832) Karin

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 390](https://damit.cuni.cz/projects/damit/asteroid_models/view/390) |
| Physical scale | [DAMIT model 390 calibrated size, Hanuš et al. (2015), Icarus 256, 101](https://damit.cuni.cz/projects/damit/asteroid_models/view/390) ([record](source/reference/calibration.json)) |

[DAMIT model 390](https://damit.cuni.cz/projects/damit/asteroid_models/view/390), version 2016-04-19, is a convex light-curve inversion mesh from [Hanuš et al. (2011), A&A 530, A134](https://damit.cuni.cz/projects/damit/references/view/141), *A study of asteroid pole-latitude distribution based on an extended set of shape models derived by the lightcurve inversion method*; [Hanuš et al. (2015), Icarus 256, 101](https://damit.cuni.cz/projects/damit/references/view/163), *Thermophysical modeling of asteroids from WISE thermal infrared data - Significance of the shape model and the pole orientation uncertainties*. The original 1022 vertices and 2040 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

The archive also holds model [391](https://damit.cuni.cz/projects/damit/asteroid_models/view/391) with pole λ = 59°, β = 44° and period 18.35121 h (fitted diameter 16.8 ± 1.5 km). Light curves do not tell the two poles apart; the selected one is not claimed to be unique.

Adopted diameter: **16.4 ± 1.3 km**, meaning thermophysical volume-equivalent diameter fitted with this shape model, from [DAMIT model 390 calibrated size, Hanuš et al. (2015), Icarus 256, 101](https://damit.cuni.cz/projects/damit/asteroid_models/view/390). The reference-sphere radius is 8.2 km. DAMIT marks model 390 as size-calibrated by the thermophysical fit of Hanuš et al. (2015): D = 16.4 ± 1.3 km, thermal inertia 170 (90–260), geometric albedo 0.21 ± 0.04. The mirror pole, model 391, fits D = 16.8 ± 1.5 km. NEOWISE lists 15.812 ± 0.111 km (Masiero et al. 2014) and 17.739 ± 0.894 km (Masiero et al. 2012).

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

The source's signed tetrahedral volume integral is 2309.5651706 source units cubed, giving a volume-equivalent diameter of 16.4000006936 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 999.999957709639`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 242°, β = 46° and sidereal period 18.35123 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 248.98°, δ = 24.58°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/1484/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
