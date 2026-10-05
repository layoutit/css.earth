# M1-67

M1-67, the nebula around the Wolf-Rayet star WR 124, as an object of the world: its place, its card and its list marker. It has no surface of its own here. Its dataset shows the [M1-67 image layers](../m1-67-layers/README.md), ESA/Webb's picture on the walls of a published model of the nebula.

## Sources

The card's facts cite their papers in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/m1-67.json) cites the position and distance. The nebula stands at WR 124's place, [SIMBAD's](../../sources/simbad-wr-124.json), which lists the star and the nebula as one entry. The distance, 6,400 pc (+2,500, −800), is the one [Zavala et al. (2022)](../../sources/publication-zavala-2022-m1-67-shape-model.json) adopt from Jiménez-Hernández et al. (2020).

## Processing

1. `node packages/bake/cli/prepare-object.mts m1-67` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the bank's layers are the world's.
2. `node site/build/prepare/companion-context.mts m1-67` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent: the circle its picture is drawn in, 64.3 arcsec. The model's bodies reach 60 arcsec from the star.
- WR 124 has no page of its own yet. "WR 124" and "Wolf-Rayet 124" are search names of the nebula until it has.
- The distance is uncertain by more than a third on its far side, and with it every size in parsecs.
