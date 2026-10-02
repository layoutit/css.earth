# NGC 4874

NGC 4874 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [NGC 4874 volume](../ngc-4874-volume/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/ngc-4874.json) cites the position, distance and velocity that place it.

| Source | Measurement used |
| --- | --- |
| [2MASS Extended Source Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/233) (Skrutskie et al. 2006) | J2000 position of 2MASX J12593570+2757338: 194.898788°, +27.959389°. |
| [Cosmicflows-4](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) (Tully et al. 2023) | Table 3, group 1PGC 44715 (NGC 4889's group; Table 2 puts NGC 4874, PGC 44628, in it): distance modulus DMzp = 34.891 ± 0.025, 95.1 Mpc (±1.1 Mpc from the modulus error). It is the distance the [Coma Cluster's circle](../galaxy-clusters/README.md) and its member dots are drawn at, so NGC 4874 sits among them. |
| [Lauer et al. (2014)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/797/82) | Table 3, row Abell 1656: NGC 4874 is the cluster's second-ranked galaxy; heliocentric velocity 7176 ± 15 km/s. |

NGC 4874 is not in the Local Volume Database, so its catalogue row is written from these papers (`citedRows` in [the galaxy catalogue recipe](../local-group-galaxies/source/catalogue.json)). The row details to this package, so the galaxy has one marker and one page.

## Processing

1. `node packages/bake/cli/prepare-object.mts ngc-4874` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts ngc-4874` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius, 110.7 kpc, is where the survey image of NGC 4874 fades into its sky (240″). It frames the page; it is not an edge of the galaxy.
- The distance is the group's, an average of its members' moduli, not a measurement of NGC 4874 itself. Cosmicflows-4's own row for NGC 4874 (Table 2) gives 34.928 ± 0.124, 96.7 Mpc, from surface brightness fluctuations and the fundamental plane.
