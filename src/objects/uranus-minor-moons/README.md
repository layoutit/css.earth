# Uranus's moons without a page

The 4 confirmed moons of Uranus that have no page of their own, one dot each, drawn while Uranus or one of its moons is selected. With the 24 moons that have pages, 28 of Uranus's 29 confirmed moons show.

## Sources

| Source | Measurement used |
| --- | --- |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Each moon's geometric position relative to Uranus's centre at the world's epoch, JD 2461286.5 TT (2026-09-03), ICRF axes, kilometres. Horizons answered from URA184. |
| [JPL satellite discovery table](https://ssd.jpl.nasa.gov/sats/discovery.html) | Which moons are confirmed, and each one's Horizons code, through the [pinned moon catalogue](../../../site/source/moon-catalogues.json). |

[Inputs](source/manifest.json) · [Recipe](source/dots/points.json)

## Processing

1. [`positions.mts uranus`](../../../packages/bake/authoring/minor-moons/positions.mts) takes every moon of Uranus in the catalogue that has no object package and has a Horizons code, and asks Horizons for its position, one request at a time. It writes [`positions.csv.gz`](source/dots/positions.csv.gz).
2. `packages/bake/cli/prepare-body-points.mts` writes the positions as a point bank whose origin is Uranus's own prepared world position: 4 dots.

The dots are the app's catalogue dots: not clickable and not named. A moon with a page keeps its own marker. The positions run from 0.1 to 9.1 million km from Uranus.

## Known problems

- S/2025 U1 has no Horizons ephemeris (Horizons answers its catalogue code with an asteroid) and is not drawn.
- No colour is measured for these moons. Every dot is `#9a9a9a`, the one neutral grey the app gives a body without a measured colour (`NEUTRAL_CATALOGUE_COLOUR`).
- The 2 px dot size is a display choice, the same as Saturn's. The moons are a few kilometres across and would be invisible at scale.
- The positions hold for the world's one epoch; the dots do not move.
