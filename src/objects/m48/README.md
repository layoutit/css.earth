# M48

M48 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [M48 members](../m48-members/README.md) bank, whose README holds the member catalogue's sources, processing and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | The cluster's position, distance (dist50 747.1 pc), age (logAge50 8.58), the radius holding half its members (4.37 pc) and the tidal radius it is framed at (17.8 pc), Table 3, NGC_2548. |
| [Wikipedia, "Messier 48"](https://en.wikipedia.org/wiki/Messier_48) | Sentences of the lead quoted on the card and introduction (revision 1373100941, CC BY-SA 4.0). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/m48.json) places the cluster from Hunt & Reffert's position and distance.
2. `node packages/bake/cli/prepare-object.mts m48` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at its tidal radius estimate, 17.8 pc, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts m48` draws the list marker from the member dots.

## Known problems

- The framing radius is a presentation value: Hunt & Reffert give the tidal radius as an approximate estimate.
- The Milky Way's open-cluster dots still draw this cluster as one dot of their own.
