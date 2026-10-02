# GN-z11

GN-z11 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [GN-z11 picture](../gn-z11-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Oesch et al. (2016), A Remarkably Luminous Galaxy at z = 11.1 Measured with Hubble Space Telescope Grism Spectroscopy, ApJ 819, 129](https://arxiv.org/abs/1603.00461) | [Record](../../sources/publication-oesch-2016-gn-z11.json). Position 189.1061°, 62.2421°: text: GN-z11 lies at (RA, DEC) = (12:36:25.46, +62:14:31.4). |
| [Bunker et al. (2023), JADES NIRSpec Spectroscopy of GN-z11, A&A 677, A88](https://arxiv.org/abs/2302.07256) | [Record](../../sources/publication-bunker-2023-gn-z11.json). Redshift 10.603: abstract: we derive a redshift of z = 10.603. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 9,762 Mpc, light travel time 13.35 billion years, age of the universe then 435 million years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/gn-z11.json) places the object at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts gn-z11` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the object at 17.4 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts gn-z11` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error is not carried into the distance; no uncertainty is invented.
- The framing radius is a presentation value, not a measured size of the object.
- The catalogue files it under galaxies with the label "Early galaxy": the app has no class of its own for a galaxy of the early universe.
