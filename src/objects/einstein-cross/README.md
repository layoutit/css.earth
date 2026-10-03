# Einstein Cross

Einstein Cross as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Einstein Cross picture](../einstein-cross-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, Einstein Cross](https://ned.ipac.caltech.edu/byname?objname=Einstein%20Cross) | [Record](../../sources/ned-einstein-cross.json). Position 340.1261°, 3.3586° (1994AJ....107..461B) and redshift 1.695 (2017A&A...600A..79A), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 4,826 Mpc, light travel time 9.96 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/einstein-cross.json) places the quasar at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts einstein-cross` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the quasar at 287.6 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts einstein-cross` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the quasar's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here.
- The framing radius is a presentation value, not a measured extent of the quasar.
