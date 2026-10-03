# Abell S1063

Abell S1063 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Abell S1063 picture](../abell-s1063-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems. Its 153 flagged member galaxies are drawn as dots around the picture by the [members bank](../abell-s1063-members/README.md).

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, Abell S1063](https://ned.ipac.caltech.edu/byname?objname=Abell%20S1063) | [Record](../../sources/ned-abell-s1063.json). Position 342.1907°, -44.5269° (2015ApJS..216...27B) and redshift 0.3517 ± 0.0049 (2024MNRAS.531.3973K), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 1,425 Mpc, light travel time 4.00 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/abell-s1063.json) places the cluster at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts abell-s1063` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 430.0 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts abell-s1063` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the cluster's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here.
- The framing radius is a presentation value, not a measured extent of the cluster.
- The cluster is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md): it is not in MCXC-II, and that catalogue places each centre at a Cosmicflows-4 group distance, which does not reach this far, so no R500 circle is drawn.
