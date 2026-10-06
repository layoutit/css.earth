# El Gordo

El Gordo as an object of the world: its place, its card and its list marker. It has no surface. Its second dataset is the [gas and mass](../el-gordo-hubble-layers/README.md) bank, the 2014 Hubble release in its layers with a modelled depth. Its first dataset shows the [El Gordo picture](../el-gordo-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, ACT-CL J0102-4915](https://ned.ipac.caltech.edu/byname?objname=ACT-CL%20J0102-4915) | [Record](../../sources/ned-el-gordo.json). Position 15.7188°, -49.2494° (2015MNRAS.450.3675S) and redshift 0.87008 ± 0.0001 (2018ApJ...855...26A), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 3,060 Mpc, light travel time 7.37 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/el-gordo.json) places the cluster at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts el-gordo` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 984.1 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts el-gordo` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the cluster's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here.
- The framing radius is a presentation value, not a measured extent of the cluster.
- The cluster is not a row of the [nearby cluster catalogue](../galaxy-clusters/README.md): it is not in MCXC-II, and that catalogue places each centre at a Cosmicflows-4 group distance, which does not reach this far, so no R500 circle is drawn.
