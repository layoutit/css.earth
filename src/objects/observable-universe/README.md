# Observable Universe

The Observable Universe as an object of the world: its card and its list marker. It has no surface and no centre but the observer. What the world draws of it, the cosmic microwave background at its edge, is the [observable-universe-cmb](../observable-universe-cmb/README.md) bank, whose README holds the sources, processing, evidence and known problems.

It is the root of the object tree: every object is inside it, and it is inside nothing ([object.json](object.json) has no `parent`). It is seen from inside ([object.json](object.json) `zoom`): zooming far enough out hands the view to this object, with the camera kept where it was and still centred on the star the zoom started from.

## Sources

The card's facts cite their sources in [source/content/object.json](source/content/object.json). The [astronomy record](../../../packages/astronomy/data/bodies/observable-universe.json) places it on the observer and says why.

## Processing

1. `node packages/bake/cli/prepare-objects.mts --object=observable-universe` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame. When the scene mounts, its frame is moved to the star the view is centred on (the Sun on a cold page).
2. `node site/build/prepare/companion-context.mts observable-universe` saves the list marker from the default dataset's picture.

## The world

Nothing is outside this object, so its package holds what belongs to the whole world and to no one body. [source/navigation/universe.json](source/navigation/universe.json) defines the world: its frame, the body at its origin, the camera's range and the distances its layers fade over. `pnpm prepare:world-context`, a shared step and not a step of this object's recipe, reads it and writes `prepared/world.json` (what every page reads), `prepared/world-index.json` (the build's table) and `prepared/world-context.json` (every body in one file, for Node tools and tests; no page reads it) here, and every other world file into the package of the object that holds its bodies ([how the world is split](../../../docs/performance/world-context-by-system.md)).

## Known problems

- The framing radius is the nominal solar radius, 695,700 km (IAU 2015 Resolution B3): it is seen from inside, centred on a star. It is a presentation value, not an extent.
- A page opened from another star is centred on that star, but its address reloads centred on the Sun.
