# M30

M30 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [M30 members](../m30-members/README.md) bank, whose README holds the member catalogue's sources, processing and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Baumgardt & Vasiliev (2021), MNRAS 505, 5957](https://doi.org/10.1093/mnras/stab1474) | The cluster's position and distance (Baumgardt's orbits table, NGC_7099: RA 325.092133°, Dec -23.179861°, 8.46 ± 0.09 kpc). |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | The radius holding half its members (6.29 pc) and the tidal radius it is framed at (19.9 pc), Table 3, NGC_7099. |
| [Wikipedia, "Messier 30"](https://en.wikipedia.org/wiki/Messier_30) | Sentences of the lead quoted on the card and introduction (revision 1373100713, CC BY-SA 4.0). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/m30.json) places the cluster from Baumgardt & Vasiliev's position and distance.
2. `node packages/bake/cli/prepare-object.mts m30` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at its tidal radius estimate, 19.9 pc, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts m30` draws the list marker from the member dots.

## Known problems

- The framing radius is a presentation value: Hunt & Reffert give the tidal radius as an approximate estimate.
- The Milky Way's globular-cluster dots still draw this cluster as one dot of their own.
