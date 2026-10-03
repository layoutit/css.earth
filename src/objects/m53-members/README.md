# M53 members

The stars of M53 that a Gaia DR3 cluster census counts as members, one dot each, drawn while the cluster is selected. The cluster's place, distance and card are the [M53](../m53/README.md) package's.

## Sources

| Source | Measurement used |
| --- | --- |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | [Record](../../sources/hunt-reffert-2023-open-clusters.json). Table `members`, NGC_5024: Gaia DR3 positions (epoch 2016.0), G magnitudes and BP-RP colors of its members. The 697 inside the tidal radius (`inrt`, the authors' selection of reliable members) with a color are drawn. |
| [Baumgardt & Vasiliev (2021), MNRAS 505, 5957](https://doi.org/10.1093/mnras/stab1474) | [Record](../../sources/baumgardt-vasiliev-2021-gc-distances.json). The cluster's distance, 18.50 ± 0.18 kpc, every member is placed at. |
| [Cardiel et al. (2021), MNRAS 507, 318](https://arxiv.org/abs/2107.08734) | [Record](../../sources/cardiel-2021-rgb.json). The Gaia BP-RP to RGB fit that colors each dot. |

## Processing

1. The table is a CDS TAP query (`source/dots/points.json`, `table.origin`; not tracked): it keeps the members inside the tidal radius with a G magnitude and a BP-RP color, and writes the cluster's distance into each row.
2. `node packages/bake/cli/prepare-catalogue-points.mts src/objects/m53-members dots` places every member at the cluster's distance, spread in depth as widely as the members spread across the sky, colors it by its BP-RP and tones it by its G magnitude ([recipe](source/dots/points.json)): 697 dots.

## Measured, chosen and assumed

| Value | Kind |
| --- | --- |
| Sky positions, membership, G and BP-RP | Measured: Hunt & Reffert (2023), from Gaia DR3 |
| Distance 18.50 kpc | Measured: Baumgardt & Vasiliev (2021) |
| Depth of each member within the cluster | Assumed: as deep as the members are wide on the sky; not measured |
| Color fit, tone scale, dot size | Presentation: Cardiel et al. (2021) for the color; the tone and size are display choices |

## Known problems

- A member's depth is assumed, not measured.
- Gaia misses stars where they crowd together, so the core of this globular cluster holds fewer dots than stars.
- Colors are as observed, reddened by the dust in front of the cluster (A_V 2.32 mag in Hunt & Reffert's fit).
