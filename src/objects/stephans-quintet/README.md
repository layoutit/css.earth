# Stephan's Quintet

Stephan's Quintet as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Stephan's Quintet picture](../stephans-quintet-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, HCG 092](https://ned.ipac.caltech.edu/byname?objname=HCG%20092) | [Record](../../sources/ned-stephans-quintet.json). Position 338.9896°, 33.9600° (2012AJ....143..144S) and redshift 0.0215 (1992ApJ...399..353H), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 95 Mpc, light travel time 0.31 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/stephans-quintet.json) places the group at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts stephans-quintet` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the group at 83.8 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts stephans-quintet` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the group's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here.
- The framing radius is a presentation value, not a measured extent of the group.
- The group is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md): it is not in MCXC-II, so no R500 circle is drawn.
