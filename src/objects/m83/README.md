# Southern Pinwheel (M83)

Southern Pinwheel (M83) as an object of the world: its place, its card and its list marker. It has no surface. Its two datasets are two pictures on the same disc, each a bank with a README that holds the sources, processing, evidence and known problems of its imagery: [the photograph](../m83-layers/README.md), which the page opens on, and [ALMA's picture of the molecular gas](../m83-alma-layers/README.md).

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/m83.json) cites the position, distance and velocity that place it.

## Processing

1. `pnpm prepare:objects --object=m83` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts m83` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent.
