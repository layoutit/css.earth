# Choosing destinations to explore

The Solar System's default captions guide visitors toward useful content.
The Sun, planets and all five dwarf planets remain orientation anchors. Prepared observation
imagery promotes most destinations automatically; `properties.catalog.featured`
can also recommend a reviewed package. Asteroids are the exception: their
default labels, circles and orbits come from JPL's spacecraft-mission target
catalogue, not from which cssEarth packages happen to contain imagery. Name
searches and direct links retain all registered objects.

## Search results

Typing in search replaces the selected card with one list of matching objects
and overview destinations. Results span categories; explicit category searches
such as "planets" still filter the list. Card titles, breadcrumbs, descriptions
and category tabs stay hidden until search is cleared.

Matching named features appear in a collapsed section inside that same results
card. Each feature names its parent body. Clearing search returns to the current
selection without moving the camera.

The Planets, Moons, Comets and Asteroids pills filter the list and highlight
the same eligible objects in the current view. Planets includes dwarf planets.
Category browsing respects **Illustration models** and updates when that setting
changes; an explicit name search still finds an excluded illustration.
Pills do not move the camera or expand the information sheet. Clicking the
active pill clears it; choosing a result navigates to that body. Zoom and
crowding still determine which matching labels fit on screen. Explicit category
highlights bypass the fade tied to orbit size, so moons remain identifiable
at Solar System scale; their tiny orbits need not be drawn. Orbit visibility
continues to follow Settings.

## Sourced asteroid context

The default asteroid context is the intersection of registered cssEarth objects
and JPL Solar System Dynamics' [Small-Body Targets of Spacecraft Missions](https://ssd.jpl.nasa.gov/sb/targets.html).
[`site/source/jpl-small-body-mission-targets.json`](../site/source/jpl-small-body-mission-targets.json)
preserves the checked source identifiers and mission names. The accompanying
module binds JPL SBDB identifiers to cssEarth object identifiers; it does not
add an editorial score, size threshold or hand-picked fallback.

This selection means "spacecraft mission targets", not that other asteroids are
scientifically unimportant. Category browsing, name search, direct links,
selection and hover still expose every eligible registered object.

## Illustration models

**Illustration models** starts off in Settings. It excludes approximate
stand-ins from the surrounding world and minimap, including their circles,
labels and orbits. Selecting one explicitly still opens its scene and preserves
its selected marker. Turning the setting on admits those bodies again.
The preference survives navigation within the app; a new session starts off.

This setting concerns the representation of the body, not whether it has a
photographic texture. Body-specific measured or reconstructed meshes remain
eligible without imagery: Pallas, Psyche, Kleopatra, Squannit and the 2001 SN263
radar meshes are examples. The JPL mission-target source separately controls
default asteroid label, circle and orbit crowding.

Approximate stand-ins include analytic spheres and ellipsoids that illustrate
size or axis constraints, approximate envelopes in place of an original shape
solution, and shared invented nucleus meshes. These can be source-backed
approximations without being resolved terrain meshes.

- [DeeDee](../src/objects/deedee/README.md) illustrates a thermal size estimate.
- [Aegaeon](../src/objects/aegaeon/README.md) uses an analytic approximation of
  reported axes, with no mapped surface texels.
- [Hale–Bopp](../src/objects/comet-c1995-o1/README.md) uses a shared illustrative
  nucleus, rather than a measured shape.
- [Pallas](../src/objects/pallas/README.md) uses the released MPCD reconstruction;
  its neutral surface and shape-derived elevation do not make it an illustration.

The current package declarations identify 106 approximate-only destinations.
Their result rows and selected cards say **Illustration only**. Body-specific
meshes without observation imagery say **Shape only**. These labels describe
available content, not an uncertainty estimate or a qualification verdict.

## Prepared promotion

`catalog.illustrationLenses` names a package's approximate stand-in datasets.
A body is **Illustration only** when every exposed lens is one of them. A body that
also has a measured lens, such as Makemake's whole-disc colour beside NASA's
illustrative texture, stays **Shape only**, and the illustration never counts as
imagery. The list is not a permanent blacklist of object identities. When replacing an
approximation with a body-specific mesh, remove that dataset from this list as
part of the package's source interpretation update.

`pnpm prepare:catalog` derives discovery from exposed `prepared/controls.json`
lenses and their raster recipes. It writes the ignored
`site/prepared-object-discovery.json` projection consumed by the single `OBJECTS`
registry. Runtime reads this prepared metadata; it does not inspect source images or
generate assets. The controls come from R2, not Git, so the dev, build and deploy
chains restore prepared assets before the catalogue runs. Without them, a clean
checkout finds no imagery for any body, and moons and small bodies read **Shape only**.

A prepared observation lens makes the destination visible and featured without
changing a second promotion flag. For asteroids, that discovery metadata does
not decide default context prominence. Downloaded candidates absent from the
prepared controls do not count. Modeled observation textures, declared illustration
lenses, GLB base-color illustrations, shape views and shape-derived elevation
do not count as imagery. Partial photographic coverage does count; its gaps and
interpretation remain the dataset panel's responsibility. Removing the prepared
imagery restores the approximation gate when only that stand-in remains.

[Itokawa](../src/objects/itokawa/README.md),
[Ryugu](../src/objects/ryugu/README.md) and
[67P](../src/objects/comet-67p/README.md) illustrate useful observation datasets
with distinct limitations. Neither lens count nor source count measures quality.
New preparation adapters must extend the observation classification and its
tests when introducing a new representation.

## Photographic arrivals

Selecting a body with a prepared photograph uses the body's default camera
angle, so visitors arrive facing the photographed side. Preparation derives
that angle ([`src/platform/default-camera.mts`](../src/platform/default-camera.mts));
no package states it. A body whose default lens has observation frames opens
on the mean of their sub-observer points. A flyby body with an `approach`
recipe, such as Pluto and Charon, opens facing the side its spacecraft
approached, computed from a shared SPICE kernel bank
([`@cssearth/spice`](../packages/spice/README.md) `spacecraftApproach`). A placed star or a
planet shown by its own emission opens facing the Sun, where Earth observes it
from. Every other body opens on the ecliptic presentation frame's design pose:
ecliptic north up, the Sun exactly to the left, the camera 40 degrees above the
ecliptic plane on its north side. When that body's default map covers mostly one
side, the camera keeps the 40-degree tilt and turns to face the centre of the
map's data, taking the tilt on the ecliptic's south side when the data lies
south. Preparation finds the gaps in the prepared minimap by the gray fill's
graticule ([`tools/objects/default-view/lens-coverage.mts`](../tools/objects/default-view/lens-coverage.mts)).
Complete maps keep the design pose. The [openings before and after this rule](images/default-openings-partial-maps.png)
show the eight bodies it turns. Catalogue
preparation stores the angle for exposed, non-modeled `observations` and
`surfaceObservations` lenses. The shared flight approaches this pose; it does
not analyze coverage in the browser or create missing imagery.

The opening sizes a body by its volume-equivalent diameter. An elongated shape model reaches past it, so
preparation records its framing scale, that radius over the mesh's largest vertex radius
([`meshFramingScale`](../tools/objects/terrestrial-layers/solid-scene.mts)), and the fit shrinks by it: 67P
opens at 0.62 and Itokawa at 0.53. An authored `framingScale` in a terrestrial recipe (measured on the source
mesh, or chosen to fit a ring) wins. Phones and portrait tablets, which fill 75% of the scene area their header
and search leave open, scale that share by it too.

Saved-view links and explicit camera targets keep their requested pose.
System overviews and non-photographic datasets retain the existing viewing
direction. Dragging and zooming an already selected body remain unrestricted.
The derived angle faces the photographs' common side; it does not claim to
optimize coverage separately for every photograph.

The world-navigation stage owns the default camera: it derives the pose and
rewrites every prepared value computed from it (camera angles and state, the
scene transform, the Sun's reference view direction). Changing the rule or a
body's inputs needs only `node tools/prepare/cli/prepare-object-json.mts --keep-bindings`,
which re-runs that stage for every object in seconds. Earth, Saturn, Jupiter,
Neptune and Uranus bake their lighting banks at the rule's pitch, so changing
that pitch also re-bakes those five.

## Stable priority

Selected, hovered and explicitly highlighted labels retain priority. Other
labels use fixed tiers: Sun, Earth, other orientation anchors, dwarf planets/JPL
mission-target asteroids/featured destinations/major moons, then ordinary objects. Earth keeps the normal distance
eligibility, so the Sun remains the reference at outer-space scales.
Clear placements survive within a tier through drag,
inertia and rest. A lower-tier survivor cannot reserve a slot ahead of a newly
visible higher-tier destination. Existing limits of 24 desktop and 12 compact
captions, panel occlusion and minimap flight freezing remain in place.

A body's circle and caption enter the layout together and reserve one shared
slot. If the annotation cannot fit, its context orbit and annotation hit targets
retire with it. Physical sprites remain visible and pickable. The selected
body's orbit remains available in close-up even when its caption cannot fit.
Orbit settings can hide a line without changing the admitted annotation.
The selected body uses the caption below its marker or mesh instead of a second
context caption. Its existing corner locator keeps its reserved footprint while
the body is unresolved and retires when the detailed surface takes over.
The focus point light shares the default body marker's minimum readable core
diameter. Its faint surrounding halo does not count toward that minimum, so the
distant Sun keeps a visible dot inside its locator circle.

Background labels use the same admission during dragging, inertia, flight and
rest: a label that leaves the viewport or loses a collision can return as soon
as its circle and text fit again. Clear committed placements retain their side.
Before keeping or choosing a caption's side, the layout checks the fixed circles
of eligible peers. A caption moves to a clear alternative when that lets nearby
annotations fit; it does not make those circles disappear merely to keep its side.
Truly overlapping circles still follow the same admission priority.
The active system's established landmark behavior remains independent of that
background admission; moving the camera does not freeze a list of visible stars.

Only actual circle and text footprints reserve space against background labels.
An orbit's interior stays available, whatever its size or distance: a projected
path does not become an opaque rectangle. Physical body occlusion remains
separate from annotation collisions.

Sagittarius A* uses the short caption “Sgr A*” and a black caption and circle
for contrast against the bright Milky Way bulge. Its accessible name stays full.

Category emphasis applies to the annotation and orbit together; it does not make a
second visibility decision in CSS. Small circle footprints are allowed to
clip at the viewport edge while the caption stays readable inside it.

Focused checks cover default exclusion, opt-in visibility, category independence,
mesh-only counterexamples, imagery promotion/demotion, partial coverage, setting
lifetime and priority without motion-dependent reordering.

## Prepared marker silhouettes

Navigation sprites carry their silhouette in the prepared image alpha channel.
Object-owned recipes in `source/preparation/navigation.json` apply an offline
ellipse mask to round bodies whose source map or photograph has an opaque
rectangular background. Map crops also use the existing full-phase curvature
shading so a circular identifier reads as rounded; photographs retain their
source lighting. These static identifiers do not follow scene-time illumination
or replace the selected body's scientific surface.

Resolved stellar reconstructions crop to the photosphere registered in their
observation frame before applying the navigation aperture. Their body READMEs
record the source frame, crop and radius; scientific reconstruction images and
off-limb emission remain available in the selected-body views.

The [prepared-image comparison](../src/navigation/evidence/marker-silhouettes-20260924/markers.png)
shows the original 15 silhouette fixes against their previous images. The
[additional shading comparison](../src/navigation/evidence/marker-silhouettes-20260924/shading.png)
covers 10 other map or schematic markers, 65 neutral placeholders and 25 comet
snapshots. The
[capture record](../src/navigation/evidence/marker-silhouettes-20260924/capture.json)
identifies the compared bytes, stellar crop inputs and retained comet meshes.
The comet snapshots reproduce their previous unlit pixels exactly before
turning on curvature lighting; their geometry and viewing directions stay fixed.
Gray placeholders receive the same display cue without invented surface detail.
Measured stellar limb darkening and thermal-map palettes keep their source
treatment. The [Earth and Moon browser view](../src/navigation/evidence/marker-silhouettes-20260924/earth-moon.png)
checks the Moon sprite in the existing world renderer.
`site/test/navigation-preparation.test.mts` checks every registered body marker
and resolved context image for transparent corners and nonempty content, and
compares each atlas tile's alpha and visible pixels with its individual image.
The shared recipe tests separately check bright-center, darker-limb shading.
The [catalogue audit](../src/navigation/evidence/marker-silhouettes-20260924/catalogue-audit.json)
records the inspected marker bytes and disposition for all 641 registered bodies.
