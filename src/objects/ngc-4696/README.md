# NGC 4696

NGC 4696 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [NGC 4696 volume](../ngc-4696-volume/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/ngc-4696.json) cites the position, distance and velocity that place it.

| Source | Measurement used |
| --- | --- |
| [2MASS Extended Source Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/233) (Jarrett et al. 2000) | J2000 position of 2MASX J12484927-4118399: 192.205322°, −41.311089°. |
| [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) (Tully et al. 2023) | Table 3, group 1PGC 43296, whose dominant galaxy is NGC 4696: distance modulus DMzp = 33.027 ± 0.048, 40.3 Mpc (±0.9 Mpc from the modulus error). It is the distance the [Centaurus Cluster's circle](../galaxy-clusters/README.md) and the group's galaxies are drawn at, so NGC 4696 sits among them. |
| [Lauer et al. (2014)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/797/82) | Table 1, row Abell 3526: NGC 4696 is the brightest cluster galaxy; heliocentric velocity 2904 ± 40 km/s. |

NGC 4696 is not in the Local Volume Database, so its catalogue row is written from these papers (`citedRows` in [the galaxy catalogue recipe](../local-group-galaxies/source/catalogue.json)). The row details to this package, so the galaxy has one marker and one page.

## Processing

1. `node packages/bake/cli/prepare-object.mts ngc-4696` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts ngc-4696` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius, 64.2 kpc, is half of Ho et al.'s (2011) diameter of NGC 4696 at 26.5 B mag per square arcsec. It frames the page; it is not an edge of the galaxy.
- The distance is the group's, an average of its members' moduli, not a measurement of NGC 4696 itself. Cosmicflows-4's own row for NGC 4696 (Table 2) gives 32.821 ± 0.161, 36.7 Mpc, from its surface brightness fluctuations and the fundamental plane.
