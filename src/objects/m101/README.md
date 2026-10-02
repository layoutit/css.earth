# Pinwheel Galaxy (M101)

Pinwheel Galaxy (M101) as an object of the world: its place, its card and its list marker. It has no surface. Its datasets show the [Pinwheel Galaxy (M101) image layers](../m101-layers/README.md) bank, whose README holds the sources, processing, evidence and known problems of the imagery.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/m101.json) cites the position, distance and velocity that place it.

M101's distance is its Cepheid distance, modulus 29.135 ± 0.045 (6.71 Mpc), from [Riess et al. (2016)](https://arxiv.org/abs/1604.01424), Table 5. It replaces the Local Volume Database's modulus of 29.21 (`distanceOverrides` in [the galaxy catalogue recipe](../local-group/source/catalogue.json)), so the galaxy sits where its dot in the [Nearby Universe](../nearby-universe/README.md) does.

## Processing

1. `pnpm prepare:objects --object=m101` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts m101` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent.
