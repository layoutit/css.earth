# Abell 2744

Abell 2744 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Abell 2744 picture](../abell-2744-layers/README.md) bank, whose README holds the picture's source, registration, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [MCXC-II, Sadibekova et al. (2024)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/688/A187) | [Record](../../sources/mcxc-ii-2024.json). Row MCXC J0014.3-3023: J2000 position 3.5783°, -30.3834° and redshift 0.3066 (spectroscopic; its reference is [2004A&A...425..367B](https://ui.adsabs.harvard.edu/abs/2004A&A...425..367B), [record](../../sources/publication-2004a-a-425-367b.json)). |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 1,258 Mpc and light travel time 3.59 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/abell-2744.json) places the cluster at the catalogue position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts abell-2744` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 818 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts abell-2744` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the cluster's motion are not carried; no uncertainty is invented.
- The framing radius is a presentation value, not a measured extent of the cluster.
- The cluster is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md): that catalogue places each centre at a Cosmicflows-4 group distance, which does not reach this far, so no R500 circle is drawn.
