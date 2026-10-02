# Asteroids with a page and no map marker

The asteroids that have a page but are not JPL mission targets, one dot each. Only mission targets keep a ring and a name on the map; these are drawn as plain dots, like the asteroids of the [main belt](../main-belt-asteroids/README.md) and [Kuiper belt](../trans-neptunian-objects/README.md) banks, which leave out every asteroid that has a page. They are reached through search or the Asteroids list, and each draws its own marker while it is selected or while Asteroids is highlighted.

## Sources

| Source | Measurement used |
| --- | --- |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Each asteroid's position at the world's epoch, JD 2461286.5 TT (2026-09-03), as its own package is prepared with it (`properties.worldFrame.originM`). |

[Inputs](source/manifest.json) · [Recipe](source/dots/points.json)

## Processing

1. [`paged-asteroid-dot-positions.mts`](../../../site/build/prepare/paged-asteroid-dot-positions.mts) reads every asteroid package that is not a mission target and writes its prepared position relative to the Sun to [`positions.csv.gz`](source/dots/positions.csv.gz).
2. `packages/bake/cli/prepare-body-points.mts` writes the positions as a point bank whose origin is the Sun.

## Known problems

- A new asteroid package gets its dot only when the positions script and the bank are run again.
- Every dot is `#9a9a9a` at half opacity and 2 px, display choices shared with the other asteroid dots.
- The positions hold for the world's one epoch; the dots do not move.
