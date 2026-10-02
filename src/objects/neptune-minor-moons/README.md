# Neptune's moons without a page

The 3 confirmed moons of Neptune that have no page of their own, one dot each, drawn while Neptune or one of its moons is selected. With the 13 moons that have pages, all 16 of Neptune's confirmed moons show.

## Sources

| Source | Measurement used |
| --- | --- |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Each moon's geometric position relative to Neptune's centre at the world's epoch, JD 2461286.5 TT (2026-09-03), ICRF axes, kilometres. Horizons answered from NEP104 (2 moons) and NEP098 (1). |
| [JPL satellite discovery table](https://ssd.jpl.nasa.gov/sats/discovery.html) | Which moons are confirmed, and each one's Horizons code, through the [pinned moon catalogue](../../../site/source/moon-catalogues.json). |

[Inputs](source/manifest.json) · [Recipe](source/dots/points.json)

## Processing

1. [`positions.mts neptune`](../../../packages/bake/authoring/minor-moons/positions.mts) takes every moon of Neptune in the catalogue that has no object package and has a Horizons code, and asks Horizons for its position, one request at a time. It writes [`positions.csv.gz`](source/dots/positions.csv.gz).
2. `packages/bake/cli/prepare-body-points.mts` writes the positions as a point bank whose origin is Neptune's own prepared world position: 3 dots.

The dots are the app's catalogue dots: not clickable and not named. A moon with a page keeps its own marker. The positions run from 0.1 to 66.8 million km from Neptune.

## Known problems

- No color is measured for these moons. Every dot is `#9a9a9a`, the one neutral gray the app gives a body without a measured color (`NEUTRAL_CATALOGUE_COLOR`).
- The 2 px dot size is a display choice, the same as Saturn's. The moons are a few kilometres across and would be invisible at scale.
- The positions hold for the world's one epoch; the dots do not move.
