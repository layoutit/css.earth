# Ring Nebula

Ring Nebula as an object of the world: its place, its card and its list marker. It has no surface. Its three datasets show the [Ring Nebula image layers](../m57-layers/README.md) bank, Hubble's picture, and the [near-infrared layers](../m57-nircam-layers/README.md) and [mid-infrared layers](../m57-miri-layers/README.md) banks, Webb's two; each README holds the sources, processing and known problems of its picture.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/m57.json) cites the position and distance that place it.

## Processing

1. `node packages/bake/cli/prepare-object.mts m57` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius, half the picture's short side at the nebula's distance, is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts m57` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent.
