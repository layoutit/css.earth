# MACS J0025

MACS J0025 (MACS J0025.4-1222, the "Baby Bullet") as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [gas and mass](../macs-j0025-layers/README.md) bank, whose README holds the pictures' source, registration, method, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, MACS J0025.4-1222](https://ned.ipac.caltech.edu/byname?objname=MACS%20J0025.4-1222) | [Record](../../sources/ned-macs-j0025.json). Position 6.3724°, -12.3770° (2011MNRAS.410.1939Z) and redshift 0.584 (2024A&A...690A.322K), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 2,222 Mpc, light travel time 5.78 billion years. |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/macs-j0025.json) places the cluster at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift. The distance is the flat cosmology with Astropy's `Planck18` parameters, integrated for this page; the same integration gives the Bullet Cluster's and El Gordo's recorded distances to 14 digits.
2. `node packages/bake/cli/prepare-object.mts macs-j0025` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 1041.1 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts macs-j0025` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the cluster's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here. Bradač et al. (2008) use 0.586.
- The framing radius is a presentation value, not a measured extent of the cluster.
- The cluster is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md), which does not reach this far, so no R500 circle is drawn.
