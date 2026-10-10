# Pleiades named stars

The nine stars of the Pleiades the IAU names, one bright dot each, drawn while the cluster is selected. Each sits where its label stands: Alcyone, Merope, Celaeno and Pleione have star objects of their own at the cluster's distance, and their dots sit at the same places. The cluster's other members are the [Pleiades members](../m45-members/README.md) bank's.

## Sources

| Source | Measurement used |
| --- | --- |
| [van Leeuwen (2007), A&A 474, 653](https://doi.org/10.1051/0004-6361:20078357) | [Record](../../sources/doi-10-1051-0004-6361-20078357.json). Hipparcos, the new reduction (CDS I/311): positions (epoch 1991.25), Hp magnitudes and B-V colors of Alcyone (HIP 17702), Atlas (17847), Electra (17499), Maia (17573), Merope (17608), Taygeta (17531), Pleione (17851), Celaeno (17489) and Asterope (17579). |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | [Record](../../sources/hunt-reffert-2023-open-clusters.json). The cluster's distance, 134.8 pc (dist50, Melotte_22). |

## Processing

1. The table is a CDS TAP query (`source/dots/points.json`, `table.origin`; not tracked): the nine Hipparcos rows, with the cluster's distance written into each.
2. `node packages/bake/cli/prepare-catalogue-points.mts src/objects/m45-named-stars dots` places each star at its position and the cluster's distance, colors it by its B-V and tones it by its Hp magnitude on the member bank's scale, at the member bank's largest dot size ([recipe](source/dots/points.json)): 9 dots.

Gaia DR3's member list leaves the brightest of them out (Alcyone, Merope, Taygeta) or outside its tidal-radius selection (Atlas, Electra, Pleione), so without this bank the cluster's brightest stars would not be drawn. The member bank leaves out the three it keeps, so none is drawn twice.

## Measured, chosen and assumed

| Value | Kind |
| --- | --- |
| Positions, Hp and B-V | Measured: van Leeuwen (2007), Hipparcos |
| Distance 134.8 pc for each | Chosen: the cluster's measured distance (Hunt & Reffert 2023). No star's own parallax places it within the cluster better than the cluster's depth |
| Color fit, tone scale, dot size | Presentation: the app's catalogue star color; the member bank's tone scale and largest size |

## Known problems

- Each star's depth within the cluster is chosen, not measured.
- Atlas, Electra, Maia, Taygeta and Asterope have no star object, so they are drawn but not named.
