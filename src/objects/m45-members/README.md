# Pleiades members

The stars of the Pleiades that a Gaia DR3 cluster census counts as members, one dot each, drawn while the cluster is selected. The cluster's place, distance and card are the [Pleiades](../m45/README.md) package's.

## Sources

| Source | Measurement used |
| --- | --- |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | [Record](../../sources/hunt-reffert-2023-open-clusters.json). Table `members`, Melotte_22: Gaia DR3 positions (epoch 2016.0), G magnitudes and BP-RP colors of its members. The 1,014 inside the tidal radius (`inrt`, the authors' selection of reliable members) with a color are read; the 3 that are named stars are left to the [named-stars bank](../m45-named-stars/README.md), and 1,011 are drawn. |
| [Cardiel et al. (2021), MNRAS 507, 318](https://arxiv.org/abs/2107.08734) | [Record](../../sources/cardiel-2021-rgb.json). The Gaia BP-RP to RGB fit that colors each dot. |

## Processing

1. The table is a CDS TAP query (`source/dots/points.json`, `table.origin`; not tracked): it keeps the members inside the tidal radius with a G magnitude and a BP-RP color, and writes the cluster's distance into each row.
2. `node packages/bake/cli/prepare-catalogue-points.mts src/objects/m45-members dots` places every member at the cluster's distance, spread in depth as widely as the members spread across the sky, colors it by its BP-RP, tones it by its G magnitude and sizes it by its rank in brightness ([recipe](source/dots/points.json)). A member within 5 arcseconds of a named star (Maia, Celaeno, Asterope) is left out: 1,011 dots.

## Measured, chosen and assumed

| Value | Kind |
| --- | --- |
| Sky positions, membership, G and BP-RP | Measured: Hunt & Reffert (2023), from Gaia DR3 |
| Distance 134.8 pc | Measured: Hunt & Reffert (2023), dist50 |
| Depth of each member within the cluster | Assumed: as deep as the members are wide on the sky; not measured |
| Color fit, tone scale, dot size | Presentation: Cardiel et al. (2021) for the color; the tone and size are display choices |

A member's own parallax is not used for its depth. The faint members' parallax errors spread the cluster along the sight line several times deeper than it is, and the brightest members' are the least certain: Maia's 7.67 ± 0.31 mas spans about 11 pc.

## Known problems

- A member's depth is assumed, not measured.
- The catalogue does not list Alcyone, Merope or Taygeta as members, and lists Atlas, Electra and Pleione outside its tidal-radius selection: the nine named stars are drawn by the [named-stars bank](../m45-named-stars/README.md) instead.
- Colors are as observed, barely reddened by the dust in front of the cluster (A_V 0.10 mag in Hunt & Reffert's fit).
