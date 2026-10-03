# JADES-GS-z14-0

JADES-GS-z14-0 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [JADES-GS-z14-0 picture](../jades-gs-z14-0-layers/README.md) bank, whose README holds the picture's source, placement, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Carniani et al. (2024), Spectroscopic confirmation of two luminous galaxies at z ~ 14, Nature 633, 318](https://arxiv.org/abs/2405.18485) | [Record](../../sources/publication-carniani-2024-z14.json). Position 53.0829°, -27.8556°: Extended Data Table: extended ID JADES-GS-53.08294-27.85563, RA 3:32:19.905, Dec -27:51:20.27 (ICRS). |
| [Schouws et al. (2025), Detection of [OIII] 88 µm in JADES-GS-z14-0 at z = 14.1793, ApJ (accepted), arXiv:2409.20549](https://arxiv.org/abs/2409.20549) | [Record](../../sources/publication-schouws-2025-oiii.json). Redshift 14.1793 ± 0.0007: abstract: z = 14.1793 ± 0.0007 from the [O III] 88 µm line (ALMA). |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 10,347 Mpc, light travel time 13.50 billion years, age of the universe then 290 million years (Astropy 8.0.1, `Planck18`). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/jades-gs-z14-0.json) places the object at the published position and the comoving distance of its redshift, the project's convention for objects placed by redshift.
2. `node packages/bake/cli/prepare-object.mts jades-gs-z14-0` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the object at 60.0 kpc, half the short side of its picture ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts jades-gs-z14-0` saves the list marker from the dataset's picture.

## Known problems

- The distance is a comoving distance from one redshift in one cosmology. The redshift's own error is not carried into the distance; no uncertainty is invented.
- The framing radius is a presentation value, not a measured size of the object.
- The catalogue files it under galaxies with the label "Early galaxy": the app has no class of its own for a galaxy of the early universe.
- Webb's spectrum gave 14.32 (+0.08, −0.20) and ALMA's oxygen line 14.1793 ± 0.0007; the object stands at ALMA's, the more precise.
