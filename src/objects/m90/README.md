# M90

M90 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [M90 image layers](../m90-layers/README.md) bank, whose README holds the sources, processing and known problems of the imagery.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/m90.json) cites the position, distance and velocity that place it.

## Processing

1. `node packages/bake/cli/prepare-object.mts m90` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts m90` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent.
