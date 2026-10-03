# M78

M78 as an object of the world: its place, its card and its list marker. It has no surface. Its dataset shows the [M78 image layers](../m78-layers/README.md) bank, whose README holds the sources, processing and known problems of the picture. The [M78 members](../m78-members/README.md) bank draws the stars of NGC 2068 while it is selected.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/m78.json) cites the position and distance that place it.

## Processing

1. `node packages/bake/cli/prepare-object.mts m78` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius, half the picture's short side at the nebula's distance, is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts m78` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent.
