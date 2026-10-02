# NGC 3311

NGC 3311 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [NGC 3311 volume](../ngc-3311-volume/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/ngc-3311.json) cites the position, distance and velocity that place it.

| Source | Measurement used |
| --- | --- |
| [2MASS Extended Source Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/233) (Jarrett et al. 2000) | J2000 position of 2MASX J10364282-2731420: 159.178421°, −27.528339°. |
| [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) (Tully et al. 2023) | Table 3, group 1PGC 31478, whose dominant galaxy is NGC 3311: distance modulus DMzp = 33.673 ± 0.046, 54.3 Mpc (±1.2 Mpc from the modulus error). It is the distance the [Hydra Cluster's circle](../galaxy-clusters/README.md) and the group's galaxies are drawn at, so NGC 3311 sits among them. |
| [Lauer et al. (2014)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/797/82) | Table 1, row Abell 1060: NGC 3311 is the brightest cluster galaxy; heliocentric velocity 3858 ± 5 km/s. |

NGC 3311 is not in the Local Volume Database, so its catalogue row is written from these papers (`citedRows` in [the galaxy catalogue recipe](../local-group-galaxies/source/catalogue.json)). The row details to this package, so the galaxy has one marker and one page.

## Processing

1. `node packages/bake/cli/prepare-object.mts ngc-3311` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts ngc-3311` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius, 73.8 kpc, is the half-diagonal of the field Arnaboldi et al. (2012) fitted NGC 3311's light on. It frames the page; it is not an edge of the galaxy.
- The distance is the group's, an average of its members' moduli, not a measurement of NGC 3311 itself. Cosmicflows-4's own row for NGC 3311 (Table 2) gives 33.076 ± 0.5, 41.2 Mpc, from the fundamental plane alone.
