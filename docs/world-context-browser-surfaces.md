# Browser surface follow-up after PR #45

PR #45 merged on 2026-09-08 as `c6850e2839520e32c3e6526bc1fd8a95866a9eb2`,
with published head `e6e9f1f968ce1a0ad49e7adddba5f3a4465d347a`.
The changes below are local follow-up commit `4c2445b9`; they were **not included
in that merge**. This work has not established consistently smooth playback.

## Published cssGraphics mechanisms inspected

The published [Galaxy adapter](https://css.graphics/galaxy/) uses prepared flat
PolyCSS snapshots and direct transform publication to retained leaves. Its
[deployed client](https://css.graphics/_astro/client.BZGbGcX8.js) references a
[worker](https://css.graphics/_astro/preparedBlockWorker-Bev_JAtU.js) that transports
and materializes prepared blocks, with a bounded bank/block window. The animation
publisher consumes those values instead of constructing scene geometry.

The published [Menger adapter](https://css.graphics/menger/) uses prepared
coplanar plane atlases and awaits image decoding before mounting. Those mechanisms
are present in its [deployed client](https://css.graphics/_astro/client.tcR_40Ee.js).
Its compact representation reduces the browser's drawing workload as well as
JavaScript work. Neither adapter justifies copying fixed playback schedules into
cssEarth's arbitrary camera or changing astronomical geometry.

Retrieved bundle SHA-256 values:

- Galaxy client: `b72ea35d2cdb9e4244315d5f80068805376acda85982fd627f3d7fd7d7fafb9e`
- Galaxy worker: `653ad2ddd660204fdef4290e1f66bcd5db0db5c1b59089c3d28a24b3976c93b6`
- Menger client: `81be4dd2e2a8a4e1a56de20884b62d35860fd58b318c26e99a13c8d905060f93`

## Local changes

- Keep each orbit's opacity container as a nonempty centered 1 x 1 CSS-pixel
  anchor, rather than an otherwise empty viewport-sized box. Original body
  depth groups remain full size. Child stroke geometry, opacity, clipping,
  hover growth and hit corridors stay owned by the existing renderer.
- During preparation, exclude only volume slabs whose lossless decoded alpha is
  entirely zero. The Milky Way bank retains 456 of 544 slabs: stacks become
  214/214/28 rather than 256/256/32. With three optical copies per slab, this
  removes 264 runtime elements. Every nonempty/faint slab and its compiled
  geometry and texture bytes remain unchanged. Raw source-bank images remain
  available for reproducibility; no files were deleted.
- Integrate main `554c9811` (Kiviuq and Albiorix), regenerate the generic prepared
  orbit metadata for the resulting 178 bodies / 177 orbits, and rebuild prepared
  object bindings. This is not a fixed body allowlist.

The compiler regression decodes the real excluded textures, checks zero alpha,
compares the sparse result against the complete compiled bank, and verifies that
any positive alpha coverage, including `Number.MIN_VALUE`, retains the leaf.

## Synchronized measurements

Headless Chrome Canary 155.0.8043.0, 1995 x 1236 CSS pixels, DPR 2, motion off.
The same native wheel tape starts at the Sun, travels outward to the Milky Way,
and returns to the Sun. Each recording includes native recorder JSON, compressed
Chrome trace and contemporaneous video. Delivery timing varies: this is not a
statistical benchmark or a wall-time speedup claim. rAF intervals are not counts
of dropped display frames. Recorder sampling itself costs about 4.1-4.5 ms per
125 ms sample; tracing and video add further overhead.

The baseline and first candidate use the same 175-orbit bank. The integrated
repeat includes the two additional moons and must not be described as an
identical-catalog repeat.

| Measurement | Published revision | Local candidate | Integrated repeat |
| --- | ---: | ---: | ---: |
| Movement duration (s) | 43.736 | 39.484 | 39.847 |
| World publish inclusive CPU (ms) | 5,223 | 4,974 | 5,161 |
| UpdateLayoutTree (ms) | 5,119 | 4,172 | 4,257 |
| Paint (ms) | 831 | 643 | 652 |
| 5-5,000 AU rAF intervals >25 ms | 143/575 (24.9%) | 100/567 (17.6%) | 111/565 (19.6%) |
| 5-5,000 AU p95 (ms) | 33.4 | 33.4 | 33.4 |
| Whole movement maximum rAF interval (ms) | 166.6 | 33.4 | 100.0 |

The first pair reduces style and paint work, but its 33.4 ms maximum was not
reproduced: the integrated run contains a 100 ms interval during outward travel.
The planetary band's p95 remains 33.4 ms. A worker alone does not address the
remaining browser style, raster and compositor work. The pre-existing rotated
volume-composition instability documented in `world-context-zoom-performance.md`
is also unresolved. These changes are not a completed stutter fix.

All three runs preserve document/world/input identities, report no application
errors, no HMR during recording and no trace data loss. Recorder/trace clock drift
is -3/-79/+38 microseconds; encoded video PTS error is below 0.50 ms. Local files
and exact source/loaded-module identities are recorded beneath
`output/world-context-zoom/<run>/`.

| Run | Recorder ID | Recorder SHA-256 | Trace SHA-256 | Video SHA-256 |
| --- | --- | --- | --- | --- |
| `surface-baseline-valid` | `fd54b05f-c465-4c34-96d9-9543587337d8` | `3b6eeff7e18a1098b576e20fce4d629f6421db01939ba685d3d779d74e0d3798` | `2bf717b768c823930526c6ad5f4267ba5c9f269cdea698b539d6d2e9c222fd55` | `b9b067f5b9a8bbf6554dde3e03f1091cf6629339ef2ee114d9eda3016137dfad` |
| `surface-candidate` | `29591824-d209-418e-9e56-42f4f3be4320` | `b66a3d490cf36c896bdc27a6a393759891e4f825bdf23596fe9e0de9b1937b2d` | `6b8f9fbdd865c3ced8123ccaa19b1ed14620cc6058ce0762082f33e6402fc41a` | `eeace6f17f4bb5c81b992662751d030b28d8f5c3548be98f4dc795bfade6a661` |
| `surface-integrated-repeat` | `236c8de8-353c-4695-a910-f3b4257c9c95` | `d4db65fb2b629989e182d9c6b7e582e82f103f66b623e6d937704e5cb2d1b259` | `cda79bcb27c6a9eb5febe8f77a46a6987c9688edb6fdaa0d2654dab5cfe66a68` | `840e645024cfaa692d86be02afcb51e77374ee4ffab52252f36661646826e9a1` |

## Visual and interaction checks

The same-catalog pair's Sun-start, galaxy and Sun-return scene crops are
pixel-identical. These are endpoint checks, not proof of every possible view.

The accepted orbit container was separately compared with the previous full-size
container at DPR 1 and 2 over three native-dragged overview poses. Marker, ring
and label rectangles, visibility, opacity and transforms match exactly. Orbit
rectangles differ by at most 0.000244141 CSS pixels from browser matrix rounding.
The six screenshot crops differ by at most two channel levels, and were inspected
visually. This is a measured rounding difference, not pixel identity. Evidence:
`output/playwright/orbit-surface-visual-proof/`.

Native Neptune orbit hover/click at both DPRs selects the same depth-ranked target
as the full-size container, shows the pointer and growing ring, lands in the
Neptune scene, and retains world nodes on Back. Evidence:
`output/playwright/orbit-native-anchor-repeat/`. That harness's first generic
`.planet-title` query does not identify the visible card and is not sidebar proof.

A zero-size body-group experiment was rejected because it made painted annotations
disappear despite stable DOM rectangles. Its reported layer-area reduction must
not be attributed to the accepted orbit-only change. Layer-tree captures were
separate diagnostic runs, excluded from timing comparisons. The original peak
layer area occurred while leaving the Sun, before the galaxy fade; neither layer
area nor layer count is a GPU memory measurement.

After integration: renderer build/typecheck, 136 focused renderer tests, and 231
preparation tests pass. This is not an aggregate green browser gate or an object
readiness claim. No new worktree was created, no unrelated checkout was modified,
and this follow-up continues separately from the merged PR.

Merged main `c6850e28` is integrated in follow-up commit `a47ced48`. All source
and prepared asset files hashed by the integrated Sun-route capture match after
that integration; newly merged 67P assets are outside this route.

## Further experiments excluded from the follow-up

Static layer probes tested retiring zero-weight volume axes, retiring zero-opacity
optical copies, and making the inner 3D anchors nonempty. Axis retirement did not
reduce content-layer count or area. Zero-opacity copy retirement removed only
non-content layers, and nonempty inner anchors added layers without reducing
content area. No product changes from these probes were retained. Camera/view and
published-style snapshots accompany the nonempty-anchor checks; those snapshots
were stationary during each comparison. These are static diagnostic probes, not
timed performance traces.

Published Menger also declares `will-change: transform` on its moving scene root.
A browser-only test of that declaration on the three volume scene roots preserved
the static images but did not improve the timed route. Its synchronized capture,
`surface-root-promotion`, has recorder ID
`75055ede-273c-4b89-a3a2-ea0aa9063342`, no errors/HMR/trace loss, 58 microseconds
of clock drift, and video PTS error below 0.50 ms. Planetary-band rAF intervals over
25 ms increased from 111/565 in the integrated candidate to 150/567; the maximum
interval remained 100 ms. Injected CSS is recorded explicitly in its report.
This is not a product change. Promoting the completed projection's opacity also
added a full-viewport content layer in static probes and did not stabilize every
rotated image.

A DOM-owned layer census at galaxy distance attributes 515 retained content layers
to the detailed Sun, 56 to the active volume, four to the sky, and two to other
content. The detailed Sun remains visible/block in CSS at marker LOD, with its
scene translated to approximately -1.1e15 CSS pixels. These are retained
compositor-layer counts and unscaled bounds, not counts of actually painted
pixels or GPU memory measurements.

The missing retirement cannot be repaired with a simple display switch. A native
zoom/image probe removes 515 content layers by hiding the detailed roots, but at
2.89 px physical Sun diameter the image changes by up to 232 channel levels. At
0.0723 px the maximum difference is two levels. Camera/view state is identical
before and after each toggle. The existing point-source proxy therefore does not
fully replace the detail's appearance at the generic marker-stage boundary.
The probe is excluded. A future shared representation handoff must preserve the
photosphere/proxy transition, node identity, resource closure and re-entry; this
PR does not hide visible geometry to claim a frame-rate gain. Evidence is under
`output/playwright/detail-retirement-probe/` and
`output/playwright/volume-layer-owners/`.
