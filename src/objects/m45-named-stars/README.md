# Pleiades named stars

The nine stars of the Pleiades the IAU names, one bright dot each, drawn while the cluster is selected. The dust model places them at an **adopted normal depth of 136.7 pc**, 0.7 pc beyond the 136.0 pc dust reference. Their individual depths are not measured. Alcyone, Merope, Celaeno and Pleione's object placements use the same adopted plane so their labels and navigation remain with the stars. The cluster's other members are the [Pleiades members](../m45-members/README.md) bank's.

## Sources

| Source | Measurement used |
| --- | --- |
| [van Leeuwen (2007), A&A 474, 653](https://doi.org/10.1051/0004-6361:20078357) | [Record](../../sources/doi-10-1051-0004-6361-20078357.json). Hipparcos, the new reduction (CDS I/311): positions (epoch 1991.25), Hp magnitudes and B-V colors of Alcyone (HIP 17702), Atlas (17847), Electra (17499), Maia (17573), Merope (17608), Taygeta (17531), Pleione (17851), Celaeno (17489) and Asterope (17579). |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | [Record](../../sources/hunt-reffert-2023-open-clusters.json). The cluster's distance, 134.8 pc (dist50, Melotte_22). |

## Processing

1. The original CDS TAP table (`source/dots/table.csv`; restored from the origin in the manifest) is preserved. It holds nine Hipparcos rows with the cluster's reference distance.
2. The [table generator](../../../packages/bake/authoring/m45/dust/acquisition/named-star-table.mts) derives `source/dots/modeled-table.csv`: radial distance = 136.7 pc divided by the star's sight-line cosine to the adopted plane normal. Measured RA, Dec, Hp and B−V remain unchanged. [plane-placement.json](source/plane-placement.json) states the reference direction and assumption.
3. Catalogue preparation retains photometric styles and writes geometry in local parsecs, at 0.0001 pc precision. The shared world-navigation preparation places the four star objects on the same adopted plane. Their published parallax and photometric-reference records remain separate, unchanged facts.

Gaia DR3's member list leaves the brightest of them out (Alcyone, Merope, Taygeta) or outside its tidal-radius selection (Atlas, Electra, Pleione), so without this bank the cluster's brightest stars would not be drawn. The member bank leaves out the three it keeps, so none is drawn twice.

## Measured, chosen and assumed

| Value | Kind |
| --- | --- |
| Positions, Hp and B-V | Measured: van Leeuwen (2007), Hipparcos |
| Cluster reference distance 134.8 pc | Measured cluster statistic: Hunt & Reffert (2023), not an individual star depth |
| Normal depth 136.7 pc for every bright star | Adopted model assumption: 0.7 pc beyond the 136.0 pc dust reference. Radial distances differ slightly with sky position |
| Color fit, tone scale, dot size | Presentation: the app's catalogue star color; the member bank's tone scale and largest size |

## Known problems

- Each star's depth within the cluster is chosen, not measured. The adopted geometry is not a fit of the bright-star parallaxes.
- Atlas, Electra, Maia, Taygeta and Asterope have no star object, so they are drawn but not named.
