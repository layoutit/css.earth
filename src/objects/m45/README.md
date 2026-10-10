# Pleiades

The Pleiades as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Pleiades members](../m45-members/README.md) bank, with the [named stars](../m45-named-stars/README.md) bank beside it; their READMEs hold the catalogues' sources, processing and known problems.

The Pleiades is drawn as the open star cluster it is. The blue reflection nebula seen around its brightest stars is dust of an unrelated cloud the cluster is passing through. It was drawn here on one authored depth surface through the middle of the cluster, a depth no measurement supports, and is no longer shown. Measured three-dimensional dust belongs to a model of the Milky Way's dust, not to the cluster.

## Sources

| Source | Measurement used |
| --- | --- |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | The cluster's position, distance (dist50 134.8 pc), radial velocity (5.34 km/s, 398 members), age (logAge50 8.08), the radius holding half its members (2.70 pc) and the tidal radius it is framed at (11.1 pc), Table 3, Melotte_22. |

The Gaia distance agrees with the independent radio parallax of [Melis et al. (2014)](https://arxiv.org/abs/1408.6544), 136.2 ± 1.2 pc, to about one standard error.

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/m45.json) places the cluster from Hunt & Reffert's position and distance.
2. `node packages/bake/cli/prepare-object.mts m45` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at its tidal radius estimate, 11.1 pc, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts m45` draws the list marker from the member dots.

## Known problems

- The framing radius is a presentation value: Hunt & Reffert give the tidal radius as an approximate estimate.
- The Milky Way's open-cluster dots still draw this cluster as one dot of their own.
- The nine named stars are drawn as bright dots by the [named-stars bank](../m45-named-stars/README.md), at the cluster's distance. Alcyone, Merope, Celaeno and Pleione are also named star objects, inside the cluster, at the same places. Alcyone, Merope and Pleione's own parallaxes, from the Hipparcos era, put them 11 to 18 pc nearer, the bias the cluster's distance controversy exposed; their published radii are scaled to the cluster's distance. Celaeno's Gaia DR3 distance differs from the cluster's by 0.6 pc.
- Atlas, Electra, Maia, Taygeta and Asterope have no star object, so they are drawn but not named.
- The member dots are sized and toned by magnitude, a display scale: the brightest 3% are the B and early A stars.
