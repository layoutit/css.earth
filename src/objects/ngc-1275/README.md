# NGC 1275

NGC 1275 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [NGC 1275 volume](../ngc-1275-volume/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/ngc-1275.json) cites the position, distance and velocity that place it.

| Source | Measurement used |
| --- | --- |
| [2MASS Extended Source Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/233) (Skrutskie et al. 2006) | J2000 position of 2MASX J03194823+4130420: 49.950981°, +41.511681°. |
| [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) (Tully et al. 2023) | Table 3, group 1PGC 12429, whose dominant galaxy is NGC 1275: distance modulus DMzp = 34.185 ± 0.036, 68.7 Mpc (±1.1 Mpc from the modulus error). It is the distance the [Perseus Cluster's circle](../galaxy-clusters/README.md) and its member dots are drawn at, so NGC 1275 sits among them. |
| [Kluge et al. (2020)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/247/43) | Table 1, row A426: NGC 1275 is the brightest cluster galaxy of Abell 426. |
| [SIMBAD](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=NGC+1275) | Radial velocity 4998.1 km/s, from [Koss et al. (2022)](https://ui.adsabs.harvard.edu/abs/2022ApJS..261....2K/abstract). |

NGC 1275 is not in the Local Volume Database, so its catalogue row is written from these papers (`citedRows` in [the galaxy catalogue recipe](../local-group-galaxies/source/catalogue.json)). The row details to this package, so the galaxy has one marker and one page.

## Processing

1. `node packages/bake/cli/prepare-object.mts ngc-1275` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts ngc-1275` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius, 66.6 kpc, is where the survey image of NGC 1275 fades into its sky (200″). It frames the page; it is not an edge of the galaxy.
- The distance is the group's, an average of its members' moduli, not a measurement of NGC 1275 itself. Cosmicflows-4's own row for NGC 1275 (Table 2) gives 33.993 ± 0.15, 62.8 Mpc, from a type Ia supernova.
