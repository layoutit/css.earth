# Cassiopeia A

Cassiopeia A, the supernova remnant, as an object of the world: its place, its card and its list marker. It has no surface. Its two datasets show the [Cassiopeia A image layers](../cassiopeia-a-layers/README.md) bank, Webb's near-infrared picture, and the [mid-infrared layers](../cassiopeia-a-miri-layers/README.md) bank, its mid-infrared one; each README holds the sources, processing and known problems of its picture.

## Sources

The card's facts cite their papers in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/cassiopeia-a.json) cites the position and distance that place it: the expansion centre of Thorstensen, Fesen & van den Bergh (2001) and the 3.4 kpc that paper works at.

## Processing

1. `node packages/bake/cli/prepare-object.mts cassiopeia-a` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is the forward shock's, 153 arcsec at the remnant's distance (DeLaney et al. 2010, Sect. IV.1) ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts cassiopeia-a` saves the list marker from the default dataset's picture.

## Known problems

- No motion across the sky or along the sight line is applied to the remnant as a whole.
