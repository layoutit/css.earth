# M2

M2 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [M2 members](../m2-members/README.md) bank, whose README holds the member catalogue's sources, processing and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Baumgardt & Vasiliev (2021), MNRAS 505, 5957](https://doi.org/10.1093/mnras/stab1474) | The cluster's position and distance (Baumgardt's orbits table, NGC_7089: RA 323.362579°, Dec -0.82325°, 11.69 ± 0.11 kpc). |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | The radius holding half its members (12.54 pc) and the tidal radius it is framed at (36.5 pc), Table 3, NGC_7089. |
| [Wikipedia, "Messier 2"](https://en.wikipedia.org/wiki/Messier_2) | Sentences of the lead quoted on the card and introduction (revision 1374794764, CC BY-SA 4.0). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/m2.json) places the cluster from Baumgardt & Vasiliev's position and distance.
2. `node packages/bake/cli/prepare-object.mts m2` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at its tidal radius estimate, 36.5 pc, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts m2` draws the list marker from the member dots.

## Known problems

- The framing radius is a presentation value: Hunt & Reffert give the tidal radius as an approximate estimate.
- The Milky Way's globular-cluster dots still draw this cluster as one dot of their own.
