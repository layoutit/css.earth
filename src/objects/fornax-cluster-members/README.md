# Fornax Cluster members

The Fornax Cluster's member galaxies that the [Nearby Universe](../nearby-universe/README.md) field does not draw, one dot each, drawn while the cluster is selected. With the field's own 51 Fornax galaxies, about 250 of the cluster's galaxies show when you fly there. The cluster's centre, aperture and card come from the [galaxy cluster catalogue](../galaxy-clusters/README.md), whose Fornax row links here.

## Sources

| Source | Measurement used |
| --- | --- |
| [Fornax Cluster Catalog, Ferguson (1989)](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/180) | Table p2tbl2: B1950 position, membership status, morphological type and total blue magnitude of the 255 definite members. |
| [Cosmicflows-4, Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) | Fornax's group distance (table 3, DMzp of group 13418: 31.468 mag, 19.7 Mpc), through the Nearby Universe's tracked table. |
| [Kinney et al. (1996)](https://doi.org/10.1086/177583) | The type templates the Nearby Universe colors its galaxies with. |

## Processing

1. [`members.mts`](../../../packages/bake/authoring/fornax-cluster/members.mts) converts the B1950 positions to J2000 ICRS with Astropy's FK4 to ICRS transformation and keeps the 202 definite members more than 10 arcsec from every Cosmicflows-4 galaxy; the other 53 are in the field already. It reads each one's RC3 stage from its type (E and dE −5, S0 and dS0 −2, Sa 1, Sb 3, Sc 5, Sd 7, Sm 9, Im and BCD 10); the 22 whose type the catalogue leaves open between two classes have none.
2. `packages/bake/cli/prepare-catalogue-points.mts` places every member at Fornax's group distance, spread in depth as widely as the members spread across the sky, and colors and tones it by its total blue magnitude as the field does ([recipe](source/dots/points.json)): 202 dots, 3 KB.

## Known problems

- A member's depth is assumed, not measured.
- The catalogue covers the central 3.5° of the cluster.
- The blue magnitudes are not corrected for Galactic extinction; a galaxy without a type is white.
