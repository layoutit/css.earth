# (434) Hungaria

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1151](https://damit.cuni.cz/projects/damit/asteroid_models/view/1151) |
| Physical scale | [Masiero et al. (2012), NEOWISE v2 row Mas12](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html) ([record](source/reference/calibration.json)) |

[DAMIT model 1151](https://damit.cuni.cz/projects/damit/asteroid_models/view/1151), version 2016-01-04, is a convex light-curve inversion mesh from [Hanuš et al. (2016), A&A 586, A108](https://damit.cuni.cz/projects/damit/references/view/161), *New and updated convex shape models of asteroids based on optical data from a large collaboration network*. The original 1022 vertices and 2040 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

Adopted diameter: **8.934 ± 0.748 km**, meaning NEOWISE best-fit effective spherical diameter, transferred approximately to mesh volume diameter, from [Masiero et al. (2012), NEOWISE v2 row Mas12](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html). The reference-sphere radius is 4.467 km. The NEOWISE v2 table holds one row for 434, fit code DV-I (beaming fixed). A thermal sphere diameter is an approximate mesh-volume scale.

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

The source's signed tetrahedral volume integral is 0.99999977845 source units cubed, giving a volume-equivalent diameter of 1.24070089017 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 7200.76859036996`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = 109°, β = 67° and sidereal period 26.4879 h. Converted with obliquity 23.439291111°, the equatorial pole is α = 192.07°, δ = 82.53°. The archived [IAUspin file](https://damit.cuni.cz/projects/damit/stored_files/open/4192/IAUspin.txt) is kept as a frame and rate cross-check. Model longitude zero is an inversion convention, not an observed landmark.

</details>
