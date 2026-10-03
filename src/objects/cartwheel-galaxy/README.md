# Cartwheel Galaxy

Cartwheel Galaxy as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Cartwheel Galaxy picture](../cartwheel-galaxy-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [NED, ESO 350- G 040](https://ned.ipac.caltech.edu/byname?objname=ESO%20350-%20G%20040) | [Record](../../sources/ned-cartwheel-galaxy.json). Position 9.4214°, -33.7163° (2013wise.rept....1C) and redshift 0.030187 ± 0.00001 (1998A&A...330..881A), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 133 Mpc, light travel time 0.43 billion years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/cartwheel-galaxy.json) places the galaxy at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts cartwheel-galaxy` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the galaxy at 41.6 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts cartwheel-galaxy` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error and the galaxy's motion are not carried; no uncertainty is invented.
- Position and redshift are NED's preferred values; the papers behind its reference codes were not read here.
- The framing radius is a presentation value, not a measured extent of the galaxy.
