# MoM-z14

MoM-z14 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [MoM-z14 volume](../mom-z14-volume/README.md) bank, whose README holds the picture's source, the published shape, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Naidu et al. (2025), A Cosmic Miracle: A Remarkably Luminous Galaxy at z = 14.44 Confirmed with JWST, Open Journal of Astrophysics](https://arxiv.org/abs/2505.11263) | [Record](../../sources/publication-naidu-2025-mom-z14.json). Position 150.0933°, 2.2732° and redshift 14.44 ± 0.02: RA 150.0933255°, Dec 2.2731627° (SIMBAD, coordinate reference arXiv:2505.11263); abstract: z_spec = 14.44 +0.02 -0.02. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 10,382 Mpc, light travel time 13.50 billion years, age of the universe then 283 million years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/mom-z14.json) places the object at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts mom-z14` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the object at 14.6 kpc comoving, half the width of the picture that is drawn ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts mom-z14` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error is not carried into the distance; no uncertainty is invented.
- The framing radius is a presentation value, not a measured size of the object.
- The catalogue files it under galaxies with the label "Early galaxy": the app has no class of its own for a galaxy of the early universe.
