# Earendel

Earendel as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Earendel picture](../earendel-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Welch et al. (2022), A highly magnified star at redshift 6.2, Nature 603, 815](https://arxiv.org/abs/2209.14866) | [Record](../../sources/publication-welch-2022-earendel.json). Position 24.3468°, -8.4645°: text: a highly magnified star sitting atop the lensing critical curve at RA, Dec = 01:37:23.232, -8:27:52.20 (J2000), designated WHL0137-LS. |
| [Pascale et al. (2025), Is Earendel a Star Cluster?: Metal Poor Globular Cluster Progenitors at z ~ 6, arXiv:2507.05483](https://arxiv.org/abs/2507.05483) | [Record](../../sources/publication-pascale-2025-earendel.json). Redshift 5.926 ± 0.013: abstract: a spectroscopic redshift of the Sunrise galaxy, z = 5.926 ± 0.013, from NIRSpec PRISM spectroscopy. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 8,393 Mpc, light travel time 12.84 billion years, age of the universe then 944 million years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/earendel.json) places the object at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts earendel` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the object at 248.6 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts earendel` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error is not carried into the distance; no uncertainty is invented.
- The framing radius is a presentation value, not a measured size of the object.
- The catalogue files it under galaxies with the label "Lensed star": the app has no class of its own for a single far star.
- Welch et al. (2022) report a single star; Pascale et al. (2025) find a small star cluster also fits. The card says "reported" and the factsheet carries both.
- The photometric redshift of 2022 (6.2 ± 0.1) and the spectroscopic one of 2025 (5.926 ± 0.013) differ; the object stands at the spectroscopic one.
