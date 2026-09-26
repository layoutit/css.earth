# Universe labels

Scene captions use the shared policy in
[`universe-label-policy.ts`](../packages/renderer/src/labels/universe-label-policy.ts).
The object registry and source catalogues remain complete; a catalogue entry
does not automatically need a caption on screen.

## Eligibility and context

- Default Solar System discovery prioritizes the Sun, major planets and objects
  with prepared imagery or a package-owned `catalog.featured` recommendation.
  The [discovery policy](object-discovery.md) distinguishes approximate stand-ins
  from body-specific meshes. Designations such as 2008 EV5 and M31 remain valid names.
- Additional moon captions require an assigned name in the pinned JPL source.
  Provisional designations remain in the complete sidebar lists.
- A planet or moon view labels its own moon family. Unrelated small bodies wait
  for a Solar System view, a resolved disc, hover, selection or an explicit
  classification highlight.
- Hiding a category keeps the selected body's marker and caption available as
  its detailed surface becomes too small to see. The asteroid orbit setting
  also preserves the selected asteroid's path; other asteroids stay hidden.
- Body-parent separation must occupy readable pixels: 12–48 CSS pixels is the
  shared appearance range. Labels no longer depend on the orbit visibility
  setting or on whether an orbit stroke crosses their text.
- Nebula captions enter with the prepared stellar-context fade and retire with
  the galactic transition. Galaxies and clusters retain their prepared distance
  ranges. Background stars and the distant galaxy point field remain anonymous.
- Catalogue-only galaxies remain visible as dots. Without a prepared scene,
  they do not mount a marker or caption in the spatial view.

## Priority and crowding

The foreground planner admits the active system first. Environment landmarks,
deep-space catalogues and additional moon captions share the remaining screen
space and slots. The admission limit is 24 captions on desktop and 12 below
700 CSS pixels, across these layers rather than a separate allowance per layer.
Off-screen, occluded and unreadable objects do not consume slots.

Selected and hovered targets take priority within the relevant group. Clickable
catalogue destinations outrank disabled captions before classification or
distance is considered. Static discovery tiers put orientation anchors first, featured destinations
next, and other objects afterward. Clear placements survive within each tier;
a higher tier can displace a lower one. Source-classified major moons retain
their existing importance. Available scene-body labels are admitted before the
additional disabled moon captions; those captions cannot displace a clickable
label. The full sidebar list remains available regardless of scene crowding.

Clickable deep-space labels try below, above, right and left when crowded.
Prepared cloud bounds keep those alternatives outside a nebula's image.
Disabled moon captions have no circle or navigation target.

## Stable references

[`stable-label-layout.ts`](../packages/renderer/src/labels/stable-label-layout.ts)
reserves clear existing placements within each static tier before relocating
blocked labels or admitting peers. Explicit selection and hover can take priority. Camera drag, inertia
and rest use this same rule; ending motion never triggers a separate layout.
Indicators retain classification priority when their physical circles collide.

Galaxy and nebula captions keep their chosen side while fading out. Additional
moon captions retain admission history, use a small entry margin and fade over
200 ms. Font loading invalidates measured bounds. The shell publishes panel
occlusion rectangles on layout changes, shared by body, catalogue, environment,
moon and surface-feature labels; camera frames do not measure the panels.

## Orbit and selection emphasis

[`context-presentation-policy.ts`](../packages/renderer/src/universe/context-presentation-policy.ts)
keeps zoom fading separate from selection emphasis. As the selected disc grows
from 12% to 30% of viewport height, orbit lines soften to 30% of their normal
strength and remain there at closer distances. Viewport clipping, body occlusion,
distance fading and explicit hidden-orbit settings still apply.

Selecting a planet or moon keeps its planet and satellite family at normal
brightness. Unrelated bodies, circles, captions and orbit lines use 25% of their
normal strength nearby. That dimming eases away between half and twice the
primary body's orbit radius as the camera pulls back; moons use their
planet's scale. Hover restores emphasis. A planetary system's overview and its
star's selection retain normal emphasis across the system. These paint multipliers do
not decide label admission or navigation availability.

## Verification

Focused renderer tests cover shared density/collision limits, clickable priority,
alternate placement, label stability, orbit-toggle independence, parent context,
selection, occlusion, retained DOM and source frames. Moon tests check catalogue
counts, assigned names and each prepared position against the pinned Horizons
reply. Browser evidence belongs in ignored `output/playwright/`.

The limit describes admitted labels; existing fades can briefly retain outgoing
captions during a transition. This is an admission policy, not a new scientific
definition of notability or a claim that every catalogue object is explorable.
