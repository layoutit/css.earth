# Southern Ring Nebula

The Southern Ring Nebula (NGC 3132), a planetary nebula, as an object of the world: its place, its card and its list marker. It has no surface of its own here. Its dataset shows the [Southern Ring Nebula image layers](../ngc-3132-layers/README.md) bank, whose README holds the sources, processing and known problems of the picture.

## Sources

The card's facts cite their papers in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/ngc-3132.json) cites the position and distance that place it: SIMBAD's place for NGC 3132 (Gaia EDR3, its bright central star) and the 754 pc (+18, −15) Monteiro et al. (2025) adopt from that star's Gaia DR3 distance.

## Processing

1. `node packages/bake/cli/prepare-object.mts ngc-3132` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius is the circle the bank draws the picture in, 63.3 arcsec at the nebula's distance, a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts ngc-3132` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent: the ionised gas spans 78 by 64 arcsec, and the faint molecular halo reaches the frame's edge.
- The nebula stands at its bright central star's place. That star is a companion; the faint star that made the nebula is beside it (ESA/Webb's caption).
