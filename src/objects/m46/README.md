# M46

M46 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [M46 members](../m46-members/README.md) bank, whose README holds the member catalogue's sources, processing and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | The cluster's position, distance (dist50 1554.5 pc), age (logAge50 8.64), the radius holding half its members (4.75 pc) and the tidal radius it is framed at (17.8 pc), Table 3, NGC_2437. |
| [Wikipedia, "Messier 46"](https://en.wikipedia.org/wiki/Messier_46) | Sentences of the lead quoted on the card and introduction (revision 1375128804, CC BY-SA 4.0). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/m46.json) places the cluster from Hunt & Reffert's position and distance.
2. `node packages/bake/cli/prepare-object.mts m46` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at its tidal radius estimate, 17.8 pc, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts m46` draws the list marker from the member dots.

## Known problems

- The framing radius is a presentation value: Hunt & Reffert give the tidal radius as an approximate estimate.
- The Milky Way's open-cluster dots still draw this cluster as one dot of their own.
