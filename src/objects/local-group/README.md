# Local Group

The Local Group as an object of the world: its place (the mid-point of the Milky Way and M31), its card and its list marker. It has no surface. What the world draws of it, one dot per catalogued galaxy, is the [Local Group galaxies](../local-group-galaxies/README.md) bank, whose README holds the sources, processing, evidence and known problems. The [Local Group's structures](../local-group-structures/README.md) field adds the cluster systems of M31 and the Milky Way, the Magellanic Clouds' star clusters and the Sagittarius stream.

It is inside the Nearby Universe, and the Milky Way and Andromeda are inside it ([object.json](object.json) `parent`; McConnachie 2012 puts the Magellanic Clouds in the Milky Way's subgroup and Triangulum in Andromeda's). It is seen from inside ([object.json](object.json) `zoom`): zooming out of anything inside it far enough hands the view to this object, with the camera kept where it was and still centred on the star the zoom started from.

## Sources

The card's facts cite McConnachie (2012) in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/local-group.json) cites the position that places it.

## Processing

1. `node packages/bake/cli/prepare-objects.mts --object=local-group` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame. When the scene mounts, its frame is moved to the star the view is centred on (the Sun on a cold page).
2. `node site/build/prepare/companion-context.mts local-group` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is the nominal solar radius, 695,700 km (IAU 2015 Resolution B3): the group is seen from inside, centred on a star. It is a presentation value, not the group's extent (its zero-velocity radius is on the card).
