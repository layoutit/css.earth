# Homunculus Nebula

The Homunculus Nebula, the two-lobed cloud of dust around the star Eta Carinae, as an object of the world: its place, its card and its list marker. It has no surface of its own here. Its dataset shows the [Homunculus Nebula image layers](../homunculus-nebula-layers/README.md) bank, whose README holds the sources, processing and known problems of the picture. The star is an object of its own inside it, [Eta Carinae](../eta-carinae/README.md).

## Sources

The card's facts cite their papers in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/homunculus-nebula.json) cites the position and distance that place it: Eta Carinae's place from SIMBAD (UCAC4) and the 2,350 ± 50 pc of Smith (2006).

## Processing

1. `node packages/bake/cli/prepare-object.mts homunculus-nebula` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is the circle the bank draws the picture in, 11.4 arcsec at the nebula's distance, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts homunculus-nebula` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent: the lobes reach about 11 arcsec from the star along their pole.
- Eta Carinae itself has no page yet; the nebula stands at the star's place.
