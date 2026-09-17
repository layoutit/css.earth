# Choosing destinations to explore

The Solar System's default captions guide visitors toward useful content.
The Sun and major planets remain orientation anchors. Prepared observation
imagery promotes a destination automatically; `properties.catalog.featured`
can also recommend a reviewed package. These are discovery choices, not a
scientific ranking. Name searches and direct links retain all registered objects.

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

## Illustration models

**Illustration models** starts off in Settings. It excludes approximate
stand-ins from the surrounding world and minimap, including their circles,
labels and orbits. Selecting one explicitly still opens its scene and preserves
its selected marker. Turning the setting on admits those bodies again.
The preference survives navigation within the app; a new session starts off.

This setting concerns the representation of the body, not whether it has a
photographic texture. Body-specific measured or reconstructed meshes remain
eligible without imagery: Pallas, Psyche, Kleopatra, Squannit and the 2001 SN263
radar meshes are examples. The separate asteroid settings still control
unfeatured asteroid crowding.

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

The current package declarations identify 105 approximate-only destinations.
Their result rows and selected cards say **Illustration only**. Body-specific
meshes without observation imagery say **Shape only**. These labels describe
available content, not an uncertainty estimate or a qualification verdict.

## Prepared promotion

`catalog.illustrationLenses` names a package's approximate stand-in datasets.
It is not a permanent blacklist of object identities. When replacing an
approximation with a body-specific mesh, remove that dataset from this list as
part of the package's source interpretation update.

`pnpm prepare:catalog` derives discovery from exposed `prepared/controls.json`
lenses and their raster recipes. It writes the ignored
`site/prepared-object-discovery.json` projection consumed by the single `OBJECTS`
registry. Runtime reads this prepared metadata; it does not inspect source images or
generate assets.

A prepared observation lens makes the destination visible and featured without
changing a second promotion flag. Downloaded candidates absent from the prepared
controls do not count. Modeled observation textures, declared illustration
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
on the mean of their sub-observer points. A placed star or a planet shown by
its own emission opens facing the Sun, where Earth observes it from. Every
other body opens on the ecliptic presentation frame's design pose: ecliptic
north up, the Sun exactly to the left, 40 degrees of scene pitch. Catalogue
preparation stores the angle for exposed, non-modeled `observations` and
`surfaceObservations` lenses. The shared flight approaches this pose; it does
not analyze coverage in the browser or create missing imagery.

Saved-view links and explicit camera targets keep their requested pose.
System overviews and non-photographic datasets retain the existing viewing
direction. Dragging and zooming an already selected body remain unrestricted.
The derived angle faces the photographs' common side; it does not claim to
optimize coverage separately for every photograph.

## Stable priority

Selected, hovered and explicitly highlighted labels retain priority. Other
labels use fixed tiers: Sun, Earth, other orientation anchors, featured
destinations/major moons, then ordinary objects. Earth keeps the normal distance
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

The same admission runs during dragging, inertia, flight and rest. Category
emphasis applies to the annotation and orbit together; it does not make a
second visibility decision in CSS. Small circle footprints are allowed to
clip at the viewport edge while the caption stays readable inside it.

Focused checks cover default exclusion, opt-in visibility, category independence,
mesh-only counterexamples, imagery promotion/demotion, partial coverage, setting
lifetime and priority without motion-dependent reordering.
