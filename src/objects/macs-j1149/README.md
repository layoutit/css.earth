# MACS J1149

MACS J1149 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [MACS J1149 picture](../macs-j1149-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems. Its 179 flagged member galaxies are drawn as dots around the picture by the [members bank](../macs-j1149-members/README.md).

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, MACS J1149.5+2223](https://ned.ipac.caltech.edu/byname?objname=MACS%20J1149.5%2B2223) | [Record](../../sources/ned-macs-j1149.json). Position 177.3962°, 22.4030° (2011MNRAS.410.1939Z) and redshift 0.54220 ± 0.00047 (2025A&A...693A...2S), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 2,086 Mpc, light travel time 5.50 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/macs-j1149.json) places the cluster at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts macs-j1149` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 576.6 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts macs-j1149` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the cluster's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here.
- The framing radius is a presentation value, not a measured extent of the cluster.
- The cluster is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md): it is not in MCXC-II, and that catalogue places each centre at a Cosmicflows-4 group distance, which does not reach this far, so no R500 circle is drawn.
