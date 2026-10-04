# Helix Nebula

Helix Nebula as an object of the world: its place, its card and its list marker. It has no surface. Its datasets show two banks, each with a README that holds the sources, processing, evidence and known problems of its imagery: the [Helix Nebula image layers](../helix-layers/README.md), the photograph on the nebula's two published rings, which the page opens on, and the [Helix Nebula volume](../helix-volume/README.md), three ESO photographs on a modelled volume.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/helix.json) cites the position, distance and velocity that place it.

## Processing

1. `pnpm prepare:objects --object=helix` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius, the radius of the image-layer bank's picture (770″ at the nebula's distance), is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts helix` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent. The volume bank's wider photographs reach beyond it.
