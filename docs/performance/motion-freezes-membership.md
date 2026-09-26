# Coasting freezes membership

While the camera coasts on inertia (a drag's throw or a zoom's glide), nobody is steering. During a coast, retained DOM
may only change `transform` and `opacity` on elements that are already resident. Those are the two properties the
browser's compositor applies without style, layout or paint.

Nothing appears, disappears, or changes its look, size, stacking or accessibility state. Nothing forces layout. The held
changes land once the coast stops, a paced slice per frame.

While a hand or the app drives the camera (a drag, an active zoom or pinch, a flight), the view keeps updating, so you
can see where you are heading. Crossings between levels of detail are staged ahead: the next level is made resident at
opacity 0, paced, so the crossing itself is a crossfade.

## Why

A USB iPad capture of production css.earth (v0.3455, 2026-09-26, `tools/performance/ios-capture.mts --style-writes`)
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
- **Pacer:** `src/renderers/css/rendering/settle-pacer.ts` holds deferred work, either while the camera moves or only
  while it coasts. It then runs the work a slice per frame. A slice starts at 16 units and can grow to 64; after a frame
  over 25 ms the pacer waits a frame and halves the slice. Leaf-box steps use it and hold during any motion, because a
  resized leaf repaints.

## Hidden stays out of compositing

Opacity 0 does not free a layer. A hidden element is `display:none`, or `visibility:hidden` without `will-change`:

- #750: 735 of 753 hidden world markers cost nothing only because they drop `will-change`.
- 6579cd4e2c: cutaways needed `display:none` to take the iPhone Earth page from 1,049 to 477 layers.

A coast may fade an element to 0. The pacer retires it once the coast stops.

## Paint-by-design exceptions

These change paint every frame on purpose, and each has a budget:

| Exception | What changes | Budget | Why it stays |
| --- | --- | --- | --- |
| Orbit strokes (`solar-system/prepared-orbit-lines.ts`) | SVG `points`, `stroke-opacity` | the visible runs | Static 3D chords cost 14 ms against 3.0 ms for the shared SVG ([prepared orbit strokes](prepared-orbit-strokes.md)) |
| Batched star points (`universe/batched-spatial-points.ts`) | `box-shadow` point lists | 8 nodes | Camera motion changes paint, never DOM shape |
| Earth's lighting frame (`rendering/prepared-material.ts`) | `background-position` on one layer | one layer | Pending an iPad measurement |
