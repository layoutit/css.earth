# SMACS 0723

SMACS 0723 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [SMACS 0723 picture](../smacs-0723-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems. Its 93 flagged member galaxies are drawn as dots around the picture by the [members bank](../smacs-0723-members/README.md).

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, SMACS J0723.3-7327](https://ned.ipac.caltech.edu/byname?objname=SMACS%20J0723.3-7327) | [Record](../../sources/ned-smacs-0723.json). Position 110.8054°, -73.4569° (2024ApJ...964..146F) and redshift 0.391 ± 0.0007 (2025A&A...699A.105A), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 1,568 Mpc, light travel time 4.34 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/smacs-0723.json) places the cluster at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts smacs-0723` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 517.2 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts smacs-0723` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the cluster's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here.
- The framing radius is a presentation value, not a measured extent of the cluster.
- The cluster is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md): it is not in MCXC-II, and that catalogue places each centre at a Cosmicflows-4 group distance, which does not reach this far, so no R500 circle is drawn.
