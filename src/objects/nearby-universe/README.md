# Nearby Universe

The Nearby Universe as an object of the world: its card and its list marker. It has no surface and no centre but the observer. What the world draws of it, one dot per galaxy and quasar, is the [nearby-universe-galaxies](../nearby-universe-galaxies/README.md) bank, whose README holds the sources, processing, evidence and known problems.

It is inside the Observable Universe, and the Local Group, the galaxy clusters and the galaxies of no cluster within Cosmicflows-4's reach are inside it ([object.json](object.json) `parent`). It is seen from inside ([object.json](object.json) `zoom`): zooming far enough out hands the view to this object, with the camera kept where it was and still centred on the star the zoom started from.

## Sources

The card's facts cite their sources in [source/content/object.json](source/content/object.json). The [astronomy record](../../../packages/astronomy/data/bodies/nearby-universe.json) places it on the observer and says why.

## Processing

1. `node packages/bake/cli/prepare-objects.mts --object=nearby-universe` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame. When the scene mounts, its frame is moved to the star the view is centred on (the Sun on a cold page).
2. `node site/build/prepare/companion-context.mts nearby-universe` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is the nominal solar radius, 695,700 km (IAU 2015 Resolution B3): it is seen from inside, centred on a star. It is a presentation value, not an extent.
- A page opened from another star is centred on that star, but its address reloads centred on the Sun.
