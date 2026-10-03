# M79

M79 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [M79 members](../m79-members/README.md) bank, whose README holds the member catalogue's sources, processing and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Baumgardt & Vasiliev (2021), MNRAS 505, 5957](https://doi.org/10.1093/mnras/stab1474) | The cluster's position and distance (Baumgardt's orbits table, NGC_1904: RA 81.045837°, Dec -24.524416°, 13.08 ± 0.18 kpc). |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | The radius holding half its members (6.70 pc) and the tidal radius it is framed at (18.7 pc), Table 3, NGC_1904. |
| [Wikipedia, "Messier 79"](https://en.wikipedia.org/wiki/Messier_79) | Sentences of the lead quoted on the card and introduction (revision 1373101328, CC BY-SA 4.0). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/m79.json) places the cluster from Baumgardt & Vasiliev's position and distance.
2. `node packages/bake/cli/prepare-object.mts m79` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at its tidal radius estimate, 18.7 pc, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts m79` draws the list marker from the member dots.

## Known problems

- The framing radius is a presentation value: Hunt & Reffert give the tidal radius as an approximate estimate.
- The Milky Way's globular-cluster dots still draw this cluster as one dot of their own.
