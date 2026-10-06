# Galactic Centre

The Galactic Centre, the middle of the Milky Way, as an object of the world: its place, its card and its list marker. It has no surface of its own here. Its dataset shows [Sagittarius A West](../galactic-centre-layers/README.md), the streams of ionized gas in orbit about the central black hole: Hubble's Paschen-α line map on the planes of the streams' published orbits.

## Sources

The card's facts cite their papers in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/galactic-centre.json) cites the position and distance. The page stands at [Sagittarius A*](../sgr-a-star/README.md)'s place and moves across the sky with it: the black hole is the focus of the streams' orbits. The distance, 8,277 pc (±9), is [GRAVITY Collaboration (2022)](../../sources/arxiv-2112-07478.json)'s to the black hole. The Sagittarius A* system, the black hole with its stars, is an object inside it, reached from its label. The gas is this page's alone: a zoom in on it stops at the page's nearest view, and the black hole's page does not draw it ([why](../galactic-centre-layers/README.md#known-problems)).

## Processing

1. `node packages/bake/cli/prepare-object.mts galactic-centre` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the bank's layers are the world's.
2. `node site/build/prepare/companion-context.mts galactic-centre` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent: the circle its picture is drawn in, 50 arcsec, 2.01 pc.
- The streams' orbits were fitted at 8 kpc and are drawn here as angles on the sky at 8,277 pc, so every length in parsecs is 3.5% larger than the paper's.
