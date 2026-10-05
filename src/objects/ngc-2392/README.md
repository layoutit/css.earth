# NGC 2392

The planetary nebula NGC 2392 as an object of the world: its place, its card and its list marker. The page is titled as SIMBAD and ESA/Hubble name it; SIMBAD hides the nicknames, which stay as aliases so a search finds it. It has no surface. Its three datasets show the [NGC 2392 image layers](../ngc-2392-layers/README.md) bank, Hubble's photograph, and the [infrared layers](../ngc-2392-webb-layers/README.md) and [mid-infrared layers](../ngc-2392-miri-layers/README.md) banks, Webb's two; each README holds the sources, processing and known problems of its picture. Its central star is an object of its own inside it, [HD 59088](../hd-59088/README.md).

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/ngc-2392.json) cites the position and distance that place it.

## Processing

1. `node packages/bake/cli/prepare-object.mts ngc-2392` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius, half the picture's short side at the nebula's distance, is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts ngc-2392` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent.
