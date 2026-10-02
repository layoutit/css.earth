# Abell 370

Abell 370 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Abell 370 picture](../abell-370-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, Abell 0370](https://ned.ipac.caltech.edu/byname?objname=Abell%200370) | [Record](../../sources/ned-abell-370.json). Position 39.9714°, -1.5822° (2012ApJS..199...34W) and redshift 0.3751 ± 0.0009 (2016MNRAS.461..248S), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 1,511 Mpc, light travel time 4.21 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/abell-370.json) places the cluster at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts abell-370` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 457.5 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts abell-370` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the cluster's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here.
- The framing radius is a presentation value, not a measured extent of the cluster.
- The cluster is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md): it is not in MCXC-II, and that catalogue places each centre at a Cosmicflows-4 group distance, which does not reach this far, so no R500 circle is drawn.
