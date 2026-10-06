# Blue Snowball Nebula

The Blue Snowball Nebula (NGC 7662) as an object of the world: its place, its card and its list marker. It has no surface of its own here. Its dataset shows the [Blue Snowball Nebula image layers](../ngc-7662-layers/README.md), ESA/Hubble's picture on the walls of the nebula's two shells.

## Sources

The card's facts cite their papers in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/ngc-7662.json) cites the position and distance. The nebula stands at its central star's place, Gaia EDR3 1924818288379268736, at 1,740 pc (1,648 to 1,842): both from [Chornay & Walton (2021)](../../sources/chornay-walton-2021-pn-central-stars.json).

## Processing

1. `node packages/bake/cli/prepare-object.mts ngc-7662` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the bank's layers are the world's.
2. `node site/build/prepare/companion-context.mts ngc-7662` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent: the circle its picture is drawn in, 15.8 arcsec. The outer shell's long axis reaches 15.7 arcsec on the sky, and the faint halo, 134 arcsec across, is outside the picture.
