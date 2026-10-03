# TON 618

TON 618 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [TON 618 picture](../ton-618-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Lyke et al. (2020), The Sloan Digital Sky Survey Quasar Catalog: Sixteenth Data Release, ApJS 250, 8](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/289) | [Record](../../sources/sdss-dr16q-2020.json). Position 187.1040°, 31.4771° and redshift 2.22: row SDSS J122824.96+312837.6: RAJ2000 187.104039, DEJ2000 31.477127; row SDSS J122824.96+312837.6: z 2.22, source VI (visual inspection). |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 5,616 Mpc, light travel time 10.83 billion years, age of the universe then 2,954 million years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/ton-618.json) places the object at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts ton-618` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the object at 816.8 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts ton-618` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error is not carried into the distance; no uncertainty is invented.
- The framing radius is a presentation value, not a measured size of the object.
- The catalogue files it under galaxies with the label "Quasar": the app has no class of its own for a quasar.
