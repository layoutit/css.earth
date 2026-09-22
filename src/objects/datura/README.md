# (1270) Datura

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 266](https://damit.cuni.cz/projects/damit/asteroid_models/view/266) |
| Physical scale | [Masiero et al. (2012), NEOWISE v2 row Mas12](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html) ([record](source/reference/calibration.json)) |

[DAMIT model 266](https://damit.cuni.cz/projects/damit/asteroid_models/view/266), version 2009-06-15 (archive comment: "preferred solution"), is a convex light-curve inversion mesh from [Vokrouhlický et al. (2009), A&A 507, 495](https://damit.cuni.cz/projects/damit/references/view/130), *Datura family: the 2009 update*. The original 1022 vertices and 2040 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

The archive also holds model [267](https://damit.cuni.cz/projects/damit/asteroid_models/view/267) with pole λ = 264°, β = 76° and period 3.358101 h. Light curves do not tell the two poles apart; the selected one is not claimed to be unique.

Adopted diameter: **8.203 ± 0.152 km**, meaning NEOWISE best-fit effective spherical diameter, transferred approximately to mesh volume diameter, from [Masiero et al. (2012), NEOWISE v2 row Mas12](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html). The reference-sphere radius is 4.1015 km. The NEOWISE v2 table holds one row for 1270, fit code DVBI (diameter, visible albedo, beaming and infrared albedo fitted). A thermal sphere diameter is an approximate mesh-volume scale.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Checked 2026-09-21 by `tools/objects/source-authoring/damit-asteroids/author.mts` from the pinned [inputs](../../../tools/objects/source-authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic 2. The shape, spin, JPL records, NEOWISE row and every derived record are pinned by bytes and SHA-256 in the [input manifest](source/manifest.json).

## Known problems

- The grid marks unmapped coverage: no registered surface imagery exists for this asteroid. Convex inversion leaves concavities and fine relief unresolved.
- Transferring a thermal sphere diameter to the mesh volume is approximate. The quoted fit error excludes shape, spin and thermal-model systematics.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is 0.99999995261 source units cubed, giving a volume-equivalent diameter of 1.24070096220 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 6611.58510384511`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 60°, β = 76° and sidereal period 3.3581 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 301.98°, δ = 76.80°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/893/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
