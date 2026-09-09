# Jupiter Trojan population

This PR adds ten Jupiter Trojans: Diomedes, Ajax, Ilioneus, Pyrrhus, Eumelos, Lycomedes, Demodokus, Menelaus, Agenor and Mentor. This takes the seven registered Jupiter Trojan primaries to seventeen. Each uses the established published-mesh recipe, with the shared **Shape** grid and shape-derived **Elevation** view. Shadows and asteroid orbits start off. The shared application mounts one selected body at a time.

## Added bodies

These are convex light-curve reconstructions. No new object has a resolved global image map. Diameters below determine a uniform physical scale; quoted errors are source fit errors, not local shape accuracy or total uncertainty.

| Number | Body | Camp | DAMIT model | Diameter (km) | Size interpretation |
| --- | --- | --- | --- | ---: | --- |
| 1437 | [Diomedes](../src/planets/diomedes/SOURCE.md) | L4 | [ 4215 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/4215) | 118.8 ± 0.6 | Occultation fit to this mesh |
| 1404 | [Ajax](../src/planets/ajax/SOURCE.md) | L4 | [ 3327 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/3327) | 83.99 ± 1.279 | Approximate thermal-size transfer |
| 5130 | [Ilioneus](../src/planets/ilioneus/SOURCE.md) | L5 | [ 4172 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/4172) | 60.711 ± 0.982 | Approximate thermal-size transfer |
| 5283 | [Pyrrhus](../src/planets/pyrrhus/SOURCE.md) | L4 | [ 4373 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/4373) | 48.356 ± 0.423 | Approximate thermal-size transfer |
| 5436 | [Eumelos](../src/planets/eumelos/SOURCE.md) | L4 | [ 3920 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/3920) | 37.696 ± 0.329 | Approximate thermal-size transfer |
| 9694 | [Lycomedes](../src/planets/lycomedes/SOURCE.md) | L4 | [ 4284 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/4284) | 31.736 ± 0.243 | Approximate thermal-size transfer |
| 11429 | [Demodokus](../src/planets/demodokus/SOURCE.md) | L4 | [ 3896 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/3896) | 37.63 ± 1.307 | Approximate thermal-size transfer |
| 1647 | [Menelaus](../src/planets/menelaus/SOURCE.md) | L4 | [ 8131 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/8131) | 42.716 ± 0.517 | Approximate thermal-size transfer |
| 1873 | [Agenor](../src/planets/agenor/SOURCE.md) | L5 | [ 4273 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/4273) | 50.799 ± 1.181 | Approximate thermal-size transfer |
| 3451 | [Mentor](../src/planets/mentor/SOURCE.md) | L5 | [ 4281 ](https://damit.cuni.cz/projects/damit/asteroid_models/view/4281) | 126.288 ± 1.642 | Approximate thermal-size transfer |

## Scientific interpretation

**Diomedes:** Dutra et al. (2025) fit the same 574-vertex, 1,144-facet DAMIT model to three stellar-occultation chords. Their volume-equivalent radius is 59.4 ± 0.3 km; this presentation uses twice that radius, a pole of (153.73°, 12.69°) in ecliptic J2000, and sidereal period 24.4984 h. The raw shape is preserved, and the original archive spin is recorded separately from the refined fit. [Publication](https://doi.org/10.1098/rsta.2024.0187), [author manuscript](https://arxiv.org/abs/2412.01568).

**Other nine:** published DAMIT shape and sidereal spin plus the official NEOWISE v2 `Gr12b` effective spherical diameter. Each selected catalog row has a fitted diameter (`D` in `FIT_CODE`). A thermal sphere diameter is an approximate mesh-volume scale, and the visible lens description says so. Formal fit errors exclude additional shape, spin and thermal-model effects. The source query, returned rows, definitions and original paper are pinned. [IRSA definitions](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html), [Grav et al. 2012](https://arxiv.org/abs/1209.1549).

The model's +Z spin axis and +X reference meridian are retained. Alternative poles remain possible where the archive lists them. Absolute rotational phase and accelerated display spin are illustrative. Convex inversion does not resolve concavities, regolith or craters. Elevation is the model's radius minus its declared volume-equivalent reference sphere, in kilometres; it is a shape-derived scalar rather than gravitational height or an independent terrain measurement.

## Source selection and remaining gaps

- The Hanuš et al. (2023) population survey adopts the existing models for Ajax, Ilioneus, Pyrrhus, Eumelos, Lycomedes and Demodokus in Table B.3. Menelaus uses its 2022 archive model from the Gaia DR3 study.
- Agenor and Mentor have revised 2023 solutions, but their numerical replacement meshes are unresolved in the current public target query. This PR identifies the downloadable older archive model and preserves its matching pole; it does not combine newer poles with old geometry.
- Agamemnon and Nestor are deferred: the 2023 study calls their older archive pole solutions inconsistent. The newer downloadable meshes are not qualified.
- Deiphobus, Antenor and Priamus have published newer reconstructions; the bounded survey did not locate their original numerical mesh release. Paper illustrations are not converted into geometry.
- The bounded non-Jovian Trojan survey did not qualify a numeric mesh for an Earth, Mars or Neptune Trojan. This does not establish that no data exist; these populations remain gaps.

[Hanuš et al. 2023](https://arxiv.org/abs/2308.05380), [CDS source tables](https://cdsarc.cds.unistra.fr/ftp/J/A+A/679/A56/ReadMe).

## Preparation and validation

The original counted meshes have 570–574 vertices and 1,136–1,144 faces. Intake independently checks coordinate anchors, connectivity, positive volume, closed consistent winding and genus-zero topology. The existing `source-meshoptimizer` recipe targets 800 native PolyCSS `u` triangles with 128 px raster cells, using the source-size-dependent error allowance. Geometry, scalar atlas values and lighting are prepared before runtime.

**Qualification is in progress.** Source intake and Horizons queries are complete. Preparation, source-to-result comparisons, package tests, fresh asset installation and focused browser checks remain to be recorded here before delivery. No full-catalog browser pass is claimed.
