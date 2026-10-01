# M49

M49 as an object of the world: its place, its card and its list marker. It has no surface. Its datasets show the [M49 volume](../m49-volume/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/m49.json) cites the position, distance and velocity that place it.

| Source | Measurement used |
| --- | --- |
| [2MASS Extended Source Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/233) (Skrutskie et al. 2006) | J2000 position of 2MASX J12294679+0800014: 187.444992°, +8.00041°. |
| [Blakeslee et al. (2009)](https://arxiv.org/abs/0901.1138) | Table 2, row VCC 1226: surface brightness fluctuation distance modulus 31.116 ± 0.075, 16.7 ± 0.6 Mpc. M49 is placed at its own measured distance, not at the Virgo group distance the [cluster's dots](../virgo-cluster/README.md) use. |
| [Virgo Cluster Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/90/1681) (Binggeli et al. 1985) | VCC 1226 = NGC 4472, membership M (member). |
| [SIMBAD](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M+49) | Radial velocity 948.8 km/s, from the SDSS DR7 redshift ([Abazajian et al. 2009](https://ui.adsabs.harvard.edu/abs/2009ApJS..182..543A/abstract)). |

M49 is not in the Local Volume Database, so its catalogue row is written from these papers (`citedRows` in [the galaxy catalogue recipe](../local-group/source/catalogue.json)). The row details to this package, so the galaxy has one marker and one page.

## Processing

1. `pnpm prepare:objects --object=m49` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts m49` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius, 85.2 kpc, is where Kormendy et al.'s (2009) profile of M49 ends. It frames the page; it is not an edge of the galaxy.
- Mei et al. (2007) give 17.14 ± 0.71 Mpc from the same Hubble images with an earlier calibration; Blakeslee et al. revise it, and their value is used.
