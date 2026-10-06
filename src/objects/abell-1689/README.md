# Abell 1689

Abell 1689 as an object of the world: its place, its card and its list marker. It has no surface. Its second dataset is the [gas and mass](../abell-1689-chandra-layers/README.md) bank, the 2008 Chandra picture in its layers with a measured depth. Its first dataset shows the [Abell 1689 picture](../abell-1689-layers/README.md) bank, whose README holds the picture's source, registration, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [MCXC-II, Sadibekova et al. (2024)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/688/A187) | [Record](../../sources/mcxc-ii-2024.json). Row MCXC J1311.5-0120: J2000 position 197.875°, -1.3354° and redshift 0.1832 (spectroscopic; its reference is [1999ApJS..125...35S](https://ui.adsabs.harvard.edu/abs/1999ApJS..125...35S), [record](../../sources/publication-1999apjs-125-35s.json)). |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 776 Mpc and light travel time 2.33 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/abell-1689.json) places the cluster at the catalogue position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts abell-1689` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 363 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts abell-1689` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the cluster's motion are not carried; no uncertainty is invented.
- The framing radius is a presentation value, not a measured extent of the cluster.
- The cluster is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md): that catalogue places each centre at a Cosmicflows-4 group distance, which does not reach this far, so no R500 circle is drawn.
