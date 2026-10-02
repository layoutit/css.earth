# Coma Cluster

The Coma Cluster as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [Coma Cluster members](../coma-cluster-members/README.md) bank, whose README holds the member catalogue's sources, processing, evidence and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [MCXC-II, Sadibekova et al. (2024)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/688/A187) | The cluster's J2000 position, redshift and R500 radius, through the [galaxy cluster catalogue](../galaxy-clusters/README.md). |
| [Cosmicflows-4, Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) | The group distance the cluster is placed at (table 3, DMzp of group 44715: 95.1 Mpc). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/coma-cluster.json) places the cluster from those two catalogues.
2. `pnpm prepare:objects --object=coma-cluster` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at 1.74 Mpc, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts coma-cluster` draws the list marker from the member dots.

## Known problems

- The framing radius is a presentation value, not a measured extent of the cluster.
