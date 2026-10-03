# 3C 273

3C 273 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [3C 273 picture](../quasar-3c-273-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Gaia Collaboration (2023), Gaia Data Release 3, A&A 674, A1](https://doi.org/10.1051/0004-6361/202243940) | [Record](../../sources/gaia-2023-dr3.json). Position 187.2779°, 2.0524°: SIMBAD 3C 273: RA 187.27791594049°, Dec 2.05238823055°, coordinate reference 2020yCat.1350....0G (Gaia EDR3). |
| [Koss et al. (2022), BASS XXII: The BASS DR2 AGN Catalog and Data, ApJS 261, 2](https://ui.adsabs.harvard.edu/abs/2022ApJS..261....2K) | [Record](../../sources/doi-10-3847-1538-4365-ac6c05.json). Redshift 0.1576: SIMBAD 3C 273: redshift 0.15756751 ± 0.0005, reference 2022ApJS..261....2K. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 672 Mpc, light travel time 2.04 billion years, age of the universe then 11,750 million years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/quasar-3c-273.json) places the object at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts quasar-3c-273` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the object at 113.0 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts quasar-3c-273` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error is not carried into the distance; no uncertainty is invented.
- The framing radius is a presentation value, not a measured size of the object.
- The catalogue files it under galaxies with the label "Quasar": the app has no class of its own for a quasar.
