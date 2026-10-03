# M68

M68 as an object of the world: its place, its card and its list marker. It has no surface. Its one dataset shows the [M68 members](../m68-members/README.md) bank, whose README holds the member catalogue's sources, processing and known problems.

## Sources

| Source | Measurement used |
| --- | --- |
| [Baumgardt & Vasiliev (2021), MNRAS 505, 5957](https://doi.org/10.1093/mnras/stab1474) | The cluster's position and distance (Baumgardt's orbits table, NGC_4590: RA 189.866577°, Dec -26.744057°, 10.4 ± 0.1 kpc). |
| [Hunt & Reffert (2023), A&A 673, A114](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114) | The radius holding half its members (6.07 pc) and the tidal radius it is framed at (20.9 pc), Table 3, NGC_4590. |
| [Wikipedia, "Messier 68"](https://en.wikipedia.org/wiki/Messier_68) | Sentences of the lead quoted on the card and introduction (revision 1373101296, CC BY-SA 4.0). |

## Processing

1. The [astronomy record](../../../packages/astronomy/data/bodies/m68.json) places the cluster from Baumgardt & Vasiliev's position and distance.
2. `node packages/bake/cli/prepare-object.mts m68` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the page frames the cluster at its tidal radius estimate, 20.9 pc, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
3. `node site/build/prepare/companion-context.mts m68` draws the list marker from the member dots.

## Known problems

- The framing radius is a presentation value: Hunt & Reffert give the tidal radius as an approximate estimate.
- The Milky Way's globular-cluster dots still draw this cluster as one dot of their own.
