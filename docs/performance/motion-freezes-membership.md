# Coasting freezes membership

While the camera coasts on inertia (a drag's throw or a zoom's glide), nobody is steering. During a coast, retained DOM
may only change `transform` and `opacity` on elements that are already resident. Those are the two properties the
browser's compositor applies without style, layout or paint.

Nothing appears, disappears, or changes its look, size, stacking or accessibility state. Nothing forces layout. The held
changes land once the coast stops, a paced slice per frame.

Navigation targets expose a named button role only while available. Repeated publication of the same target writes
no accessibility attributes; a focus point outside the measured viewport leaves the tab order after the coast.
Minimap arrow keys read the current camera on keydown, without publishing camera coordinates as DOM attributes.

While a hand or the app drives the camera (a drag, an active zoom or pinch, a flight), the view keeps updating, so you
can see where you are heading. Crossings between levels of detail are staged ahead: the next level is made resident at
opacity 0, paced, so the crossing itself is a crossfade.

Annotations (markers, names, orbits, the footer) and content (sky faces, a nebula's slice stack changing axis) are
held differently while coasting:

- **Annotations** wait for the coast to stop.
- **Content** has to appear as it turns into view, or the scene would show holes. It is staged ahead instead: made
  resident a margin before it enters the view (image loaded, `display` on, opacity 0), then faded in. During a coast
  content is only added, never retired; retirement waits for the coast to stop.
  A nebula's slices follow this (`volume/prepared-volume-runtime.ts`): an axis stack whose weight reached zero, an
  optical copy whose alpha did and a slice that left the view stay as they are until the camera stops, then leave a
  paced slice per frame. Hiding them as the camera turned flipped `display` on 2,016 slices in one throw of a drag at
  the Milky Way (2026-10-03).

## Why

A USB iPad capture of production css.earth (v0.3455, 2026-09-26, `labs/performance/ios-capture.mts` (now `labs/performance/ios-capture.mts`) with `--style-writes`)
recorded a flick and its coast. While moving, the page wrote 19,203 times off the compositor path across 104 kinds.
The writes included:

- `visibility` and `will-change` flips
- `z-index`
- sprite `background-*`
- label custom properties
- `data-*` and `aria-*` flags
- inserted polylines

Per frame, RecalculateStyles took 2.04 ms and Composite 1.95 ms, with spikes of 56 to 72 ms as motion started. Core
Animation presented about 26 frames a second while the main thread produced about 58. The coast was most of that
gesture.

## The pieces

- **Signal:** `src/renderers/css/navigation/camera-motion-signal.ts` tells whether the camera moves and whether it
  coasts. It is announced as `objectmotionchange` `{ active, coasting }` on the input surface. The drag controls report
  `drag`, `inertia` and `fly-to`; the wheel zoom reports `zoom` and `glide`.
- **Pacer:** a document has one pacer (`packages/renderer/src/rendering/settle-pacer.ts`), on its one frame clock
  (`packages/renderer/src/stars/opacity-clock.ts`), and one budget a frame that every owner shares in turn. A frame
  starts at 16 units and can grow to 64; after a frame over 25 ms the pacer waits a frame and halves it. Each owner says
  what holds its work: any motion (leaf-box steps and the seam outset, because a resized leaf repaints), only a coast, or
  nothing (a mesh's reveal, a mount's activation, a body's feature names and a dot bank's load, which land during a zoom
  or a flight).

## Mesh detail survives input reversals

Once a mesh is presented, its geometry and material demand remain resident throughout driven motion and its coast.
Crossing the distant billboard threshold must not hide the scene or reset its prepared reveal groups during that
motion: a quick reversal would recreate the same composited leaves repeatedly. Proxy opacity still follows projected
size. When the shared motion signal becomes inactive, the camera publishes the current level once and retires detail
if it is still distant. A cold distant or off-screen mount does not activate detail merely because the camera is moving. Detail demand first
tests the physical sphere against the measured viewport: an oblique silhouette can be large yet entirely outside it.
This also prevents a hidden departing mesh from restarting its reveal groups off-screen. A mesh
without committed material still cannot reveal.

## Hidden stays out of compositing

Opacity 0 does not free a layer. A hidden element is `display:none`, or `visibility:hidden` without `will-change`:

- #750: 735 of 753 hidden world markers cost nothing only because they drop `will-change`.
-: cutaways needed `display:none` to take the iPhone Earth page from 1,049 to 477 layers.

A coast may fade an element to 0. The pacer retires it once the coast stops.

## Paint-by-design exceptions

These change paint every frame on purpose, and each has a budget:

| Exception | What changes | Budget | Why it stays |
| --- | --- | --- | --- |
| Orbit strokes (`solar-system/prepared-orbit-lines.ts`) | SVG `points`, `stroke-opacity` | the visible runs | Static 3D chords cost 14 ms against 3.0 ms for the shared SVG ([prepared orbit strokes](prepared-orbit-strokes.md)) |
| Batched star points (`universe/batched-spatial-points.ts`, `universe/point-layer.ts`) | SVG paths of round-capped dots (`M x y h.1`: a zero-length cap is painted twice by WebKit), one per prepared paint color with its alpha byte, in one svg layer for the banks mounted next to each other (on the iPad at the Milky Way a layer per bank left 37 and 77 frames over 20 ms in 690 and 202 MB of layers, the shared layers 25 and 25 and 130 MB, 2026-10-03); a bank dims by its strokes' opacity, since a group's opacity is an offscreen pass on each repaint; a turn or a zoom warps the layer's last paint, and dots a zoom adds arrive through the pacer; a bank that arrives during a zoom is read, styled and resolved in the pacer's slices and drawn once it is whole (the nearby galaxies' 39,916 points were one frame of 172 to 218 ms on the iPad and are frames of at most 33 ms, 2026-10-03); a camera whose travel moves the dots repaints them every frame (keeping the paint on alternate frames left more late frames on the iPad: 72 to 75 over 20 ms in 240 against 34 to 38, 2026-10-03), and those paints leave out the margin a turn warps in, a third of the dots written, which the pause paints back | One retained path per color | Camera motion changes paint, never DOM shape |
| Earth's lighting frame (`rendering/prepared-material.ts`) | `background-position` on one layer | one layer | Pending an iPad measurement |
| Sky faces (`sky/prepared-sky-runtime.ts`) | `visibility` and the first `background-image` as a face crosses the view edge | the faces in view (at most 3) | A face's layer is about 85 MB at 3x; staging one ahead or keeping one through a spin would multiply memory |

The footer readout (distance, coordinates, the scale ruler) holds its last reading while the camera moves, and reads
once it stops. Texture levels and the body-wide seam step also wait for the camera to stop. Nothing about them has to
be seen mid-motion.

`node labs/performance/coast-writes.mts --url <page>` flings the camera in headless Chrome and lists every write the
page makes while it coasts. It exits 1 on anything outside this table.

## A zoom's change of scene waits for rest

A zoom that crosses a threshold (out of a body into its system, from a moon out to its planet's system, into or out of
an object seen from inside) changes the selection, and often the scene. The world shows the new selection at the
crossing: its scope is a few policy flags (`setOverview`). The scene, its card and its address are membership, so they
change when the camera rests (`site/scene/camera-handover.mts`): the settle time after the motion signal reports no
motion. That holds for every crossing, one that keeps the mounted scene included: a body and its own system share a
scene, and the card of the one replaces the card of the other at rest too. Until then
the mounted scene keeps the camera, and its far limit stays open while a wider scene exists (`setZoomOutOpen`). A zoom
that crosses several thresholds without resting replaces the scene once, with the last. The new scene's files are
requested as the camera comes to rest, not at each crossing. What the zoom needs to go on is read at the crossing: the
entries of the objects the crossed system's star is inside, a few kilobytes each. Without them a zoom out of a planet
followed nothing past its star's system until the camera rested, and out of TRAPPIST-1 e the star's scene was mounted at
rest only to be replaced by the Observable Universe's (2026-10-03). A camera that comes back before it rests keeps its
scene.
A flight's landing is already at rest and hands over at once.

A zoom in toward a body does not wait for rest: the world draws a body it has not mounted as a point, and only the
body's own scene draws it larger. The pending scene is mounted as soon as its body is a pixel across, moving or not.
Without that, a zoom from the Nearby Universe in to the Sun showed no Sun until the camera stopped (2026-10-03). A zoom
out waits for rest all the same: the system the mounted body belongs to is around the camera already, and from a planet
of TRAPPIST-1 its star is a disc.

Measured 2026-10-03. In headless Chrome, zooming out of Earth with the swap held until rest, the page before and after
the swap differed in 2 of 2,774,880 pixels at Earth to the Solar System (one channel, by 2) and in 0 at the next four
crossings, out to the Observable Universe, and in 0 at two crossings coming back in from the Local Group: the shared
world draws everything in view there, and the arriving scene's stage holds 3 to 5 empty nodes. On the iPad, a steady
zoom out of Earth across four crossings and back in (interleaved runs) had 81 and 84 frames over 20 ms going out and 6
and 6 coming in with the scene replaced at each crossing, and 68 and 72 and 3 and 3 with it replaced at rest. Most of
the frames that remained were one stretch past the Solar System, where Safari redrew the galaxy's backing images on
every frame; as `img` planes (`universe/galaxy-backing.ts`) the same zoom out has 16 and 8.

## Object arrival ownership

The application retains the input surface's native camera, wheel, picking and surface-feature input listeners across
object changes. Each scene leases a callback; retirement clears that callback, and application disposal removes the
native listeners. This preserves native dispatch order and avoids rebuilding Safari's event regions at every handoff.
The shell stylesheet owns touch handling and text selection on that surface. Standalone renderer mounts still clean
up their own listeners and inline input styles.

The shell also owns the surface reader and footer readout. Dataset minimaps are passive images; only time-series
controls accept input. During a replacement flight, its outgoing information card keeps its nodes and detail/overview layout. The destination fragment and styles prepare
during the flight, but the card publishes only after the old scene retires and before the new detail tree mounts.
This avoids repainting the departing scene when WebKit removes the card's offscreen context rail. Cancellation keeps
the original card; arrival binds the new card's maps once. Destination controls stay inert until navigation readiness
releases them. Same-scene overview navigation keeps its existing selection behavior.

A newly prepared detail tree receives its initial material, selection and camera values before its roots connect to
the stage. Connection does not mean ready: the existing paced texture activation and paint gate still precede the
billboard handoff. A cold page's startup behind its arrival photograph is the exception: it is stationary and covered,
so its textures activate together and only the paint gate precedes the handoff. Shared scene CSS gives each mesh parent an identity 3D translation before connection.
This preserves its authored transform and makes its structural layer explicit while prepared leaves activate;
otherwise WebKit can omit the parent layer and flatten the arriving faces. An adopted server-rendered tree
is already connected and keeps its existing ownership.

Initial mounts and fly-to preparation select texture levels from the destination camera. There is no forced 512px
startup bank or first-input refinement gate. Saved reloads prepare the shared world before mounting detail, even
when their camera cannot use the default arrival billboard; world attachment must not restyle a finished surface.

World bodies use their prepared arrival billboard directly, with its baked body radius inside the image. There is no
world marker atlas or separate context photograph swap. Unresolved bodies use color dots without fetching images;
menu and search icons remain UI assets. A mounting scene keeps its camera private until its frame presenter is enabled,
so resource refreshes cannot expose it before activation. The selected host keeps the same billboard/detail
opacity split when a flight ends on its system card. Overview controls annotations and orbit context; it does
not restore a second image over the mounted host.

Arrival commits the selection without publishing the old shell. After the incoming content owners bind, the router publishes once. Later renderer readiness notifications retain the same shell subject; focus-card, system-card and selection setters skip unchanged DOM values. Stage cleanup still restores values that actually changed, because the next object may not declare the same bindings.

Departure history checkpoints reuse the view already saved after a drag. The URL, history entry identity and saved
view must all match before a replacement can be skipped. A new camera pose or stale history state still publishes;
explicit pushes remain distinct entries even when they name the same URL. Back restoration still remembers the
departed view before adopting the incoming entry.

### Optional controls and scene retirement

Disabled surface labels do not attach their feature root or allocate outline segments. The first catalogue request
creates that retained pool before publication; camera and hover updates reuse it. Shared settings ignore unchanged
preferences. During scene replacement, the outgoing control binding releases listeners without resetting DOM that
the incoming owner replaces or adopts. Failure and ordinary disposal still restore the native fallback controls.

The camera's handoff acknowledgement must not run outgoing teardown in the same RAF microtask checkpoint. The
router yields through a rendering opportunity and a task before retirement, keeping the resident billboard and
cancellation ownership intact. This separates required teardown from camera publication; it is not a paint-readiness
guarantee or a fixed settling delay. The incoming scene still must acknowledge its prepared activation.

Pending textured faces stay in their original DOM parents with a direct inline `display: none` until their
prepared activation batch. Each mesh parent keeps its first prepared face renderable so it connects populated;
activation restores each remaining face's prepared display and image together. Selection changes to a withheld
face's display update its pending value, and cancellation prevents further reveals. This paces render-layer
creation as well as texture publication, without rebuilding the mesh or changing its sibling order.

Texture activation gives the first retained face using each new image a separate rendering opportunity before
resuming its prepared batch. This separates first-use graphics resource setup from the regular face paint burst;
it does not assert that a frame callback proves GPU completion. The existing arrival paint gate still owns readiness.
Leaves already showing their pending image receive no style assignment. Marker atlas swaps and label offsets, search clearing, readouts and readiness
attributes likewise publish only changed values; fixed-precision lengths are formatted as their CSSOM values.
Prepared space-separated RGB colors compare equal to their comma-separated CSSOM serialization, without suppressing genuine color changes.

### World owner attachment

World body owners are retained off-document until the prepared planner requests their billboard or a caption measurement. A requested caption is attached hidden, measured on the next publication, and then admitted by the normal label policy. Orbit groups connect with their first populated strokes; catalogue moon captions attach only after passing projection, scale and occlusion checks. Once attached, these owners remain resident for reuse. Coasting never attaches or measures new owners.

### Departing surfaces

A scene replacement holds the source presentation as soon as its navigation request starts. Camera transforms and visibility continue on every prepared depth partition; holding their publication leaves the source mesh frozen behind the destination. Pending texture commits and new view-driven material demand wait. The request releases its hold on cancellation, re-resolving the latest camera view; successful replacement disposes the source with its last displayed textures intact. Overlapping holds release independently.
