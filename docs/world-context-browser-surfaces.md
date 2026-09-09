# Browser surface follow-up after PR #45

PR #45 merged on 2026-09-08 as `c6850e2839520e32c3e6526bc1fd8a95866a9eb2`,
with published head `e6e9f1f968ce1a0ad49e7adddba5f3a4465d347a`.
This follow-up continues in draft PR #50. The measurements below identify their
exact revisions; later integrations include 227 bodies from main. This work has
not established consistently smooth playback.

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


## Context-owned detail lifetime (07cdf107)

The detail scene now consumes the enclosing context's prepared retirement extent.
It stops drawing only when that context has completely faded out and the selected
body is unresolved. Its camera, scene nodes, source textures and physical projection
remain retained and continue receiving camera state. The same scene becomes drawable
again on re-entry. A nearby resolved object outside the context extent stays visible.
The generic marker LOD alone still does not hide a visible mesh.

The extent comes from `plan.volume.fullDistanceM` about the prepared focus position;
there is no Sun-id branch or new distance/quality threshold. This is a late, complete
context handoff, not a replacement for the missing small-disc proxy. In this context
the bound is 8.269676e20 metres. It does not change the planetary-band presentation.

Native-wheel tests at DPR 1 and 2 check marker distance, either side of that boundary,
dragging while retired, and return to a resolved Sun. All detailed nodes, the world
root and the single scene owner survive. At the retired boundary, enabling the old
mesh for comparison changes content layers from 63 to 577: the product retires 514
mesh layers. The DPR 1 scene crop is pixel-identical; the DPR 2 comparison differs
by at most two channel values. Marker-distance images differ by at most one. These
are sampled views, not a claim of universal pixel identity. Evidence is in
`output/playwright/context-retirement-proof/`. Renderer typecheck and 140 focused
renderer tests pass; the earlier preparation checks still cover the unchanged assets.

### Measured limits

The simultaneous recorder/trace/video route at exact commit `07cdf107` confirms
retirement at the galaxy endpoint and restoration at the Sun endpoint, with retained
world/input/document identities and no application errors, HMR or trace data loss.
Its 5–5,000 AU p95 is still 33.4 ms and its maximum interval is 66.7 ms. This is a
qualified lifecycle fix, not proof of a material overall frame-rate improvement.
Style work remains about 4.35 seconds over the movement. Differences among these
single runs must not be interpreted as a controlled statistical speedup.

A separate, explicitly invalid-appearance diagnostic removes the mesh throughout
travel to bound its possible benefit. That run reaches 62/569 planetary-band
intervals over 25 ms, but p95 still stays at 33.3 ms. Style work remains about 4.24
seconds even with no detailed mesh drawing. Therefore both mesh representation
and retained world publication/browser style work remain relevant; worker transport
alone cannot remove the latter. This experiment is not in the product.

| Run | Role | Band intervals >25 ms | Band p95 (ms) | Maximum (ms) |
| --- | --- | ---: | ---: | ---: |
| `surface-integrated-repeat` | Earlier integrated candidate | 111/565 | 33.4 | 100.0 |
| `detail-cost-upper-bound-valid` | Invalid-appearance mesh-cost diagnostic | 62/569 | 33.3 | 33.4 |
| `context-retirement` | Current product | 104/571 | 33.4 | 66.7 |
| `body-anchor-candidate` | Excluded body-container experiment | 192/549 | 33.4 | 50.0 |

The additional body-container experiment preserves annotation positions within
0.000123 CSS px across six DPR/dragged views, unlike the earlier zero-size variant.
It nevertheless increases planetary-band intervals over 25 ms to 192/549. It was
rejected and the full-size body groups remain unchanged. An algebraically equivalent
CSS depth-normalization probe also changed rasterized pixels (up to 109 channel
values at subpixel size) without removing layers; it was rejected.

The first `detail-cost-upper-bound` capture is excluded because its marker-stage
selector was not verified and the Sun does not publish that attribute on the stage.
`detail-cost-upper-bound-valid` instead verifies computed `display:none` throughout.
A stale descriptive build label in `context-retirement/report.json` was corrected;
its previous text and the reason remain recorded. Source HEAD/hashes, loaded module
hashes, trace, video and native recorder bytes were not changed by that correction.

New synchronized capture identities and immutable raw artifact hashes:

- `detail-cost-upper-bound-valid`: recorder `31fecb50-4343-4ad9-a5e1-081df85dd6e4`, clock drift 47 microseconds, video PTS error <0.51 ms.
  - `cssearth-diagnostics-31fecb50-4343-4ad9-a5e1-081df85dd6e4.json` SHA-256: `d05b4936c1ee7839489ac44d17f3effe2894dd7eff20a9f0921f6b59af5cf421`.
  - `trace.json.gz` SHA-256: `f82d9d1c58db90696c2f36d14c1f20d12c3f21d81db51163ee4686bb31686ebd`.
  - `sun-milky-way-sun.mp4` SHA-256: `114ce8d92b0fd739544e00b93142196e6aacbcb99eb94847916d2b7af16d56fd`.
- `context-retirement`: recorder `36e836cb-3474-492a-99da-c72d4698bb1e`, clock drift 21 microseconds, video PTS error <0.51 ms.
  - `cssearth-diagnostics-36e836cb-3474-492a-99da-c72d4698bb1e.json` SHA-256: `017a88fbeff5a48cd2f73c066609e15989ad0f09ee37560ca508a423702048f7`.
  - `trace.json.gz` SHA-256: `c3f1265922711733ef66ac96d8b6066c19087e41a3a90957df5c7abee4b6eb5c`.
  - `sun-milky-way-sun.mp4` SHA-256: `d132f1481aad2790fb8522a8fce7429154044ab42c99df13d0ef37a1d3e5b035`.
- `body-anchor-candidate`: recorder `afa57c1e-0f35-4d53-8a79-97ca1d6100ad`, clock drift -6 microseconds, video PTS error <0.51 ms.
  - `cssearth-diagnostics-afa57c1e-0f35-4d53-8a79-97ca1d6100ad.json` SHA-256: `08b912c3158c3e624a3d608e6733bb5e8b7736c4813f11db6a2ef201a4d973e0`.
  - `trace.json.gz` SHA-256: `fa3a951e3fd9faafffe9fbadc82b81e4bbac99d576d4b61b89a781178cf042e3`.
  - `sun-milky-way-sun.mp4` SHA-256: `e9d40476f4642a70c82ea790d7d525ff012712e2285c4c01929616627ed6db82`.


## Retained picking, diagnostic counts, and the system handoff

`f034b683` removes per-orbit-chord CSS hit boxes and their inherited pointer policy.
The retained screen picker already owns the exact clipped corridor, depth priority,
hover, and click dispatch. This removes duplicate browser interaction geometry;
all prepared orbit segments, line widths, colors, fades, and hit widths remain.
Six native views at DPR 1/2 preserve every measured rectangle exactly and differ
by at most one channel level. Native off-line hover, 16→20 px circle growth,
Neptune navigation, and Back pass with the same retained leaves and one scene.
Evidence: `output/playwright/orbit-picker-visual-proof/` and
`output/playwright/orbit-picker-native-proof/`.

`c9cd885a` exposes the retained blocks' existing visible membership to diagnostics.
Complete blocks use their publisher-owned counts; unpooled leaves and partial
blocks keep direct reads. The recorder keeps the same direct-hidden-leaf metric,
125 ms sampling, immutable sample copies, camera/resource fields and clock marks.
Eight native checks across Sun, hover, Neptune, and Back at DPR 1/2 match a direct
DOM scan exactly, including more than 50,000 retained leaves. The first indexed
snapshot is lazy; this does not add a per-frame observer or new scene nodes.
Evidence: `output/playwright/retained-geometry-native-proof-verified/`.

`3c0426f5` corrects the detail lifetime to use `plan.system.hiddenDistanceM`,
not the larger volume extent used in the earlier experiment above. Unresolved
planetary detail retires with its owning system, at 1e15 metres (about 6,684 AU)
in the current prepared context. A resolved nearby body still stays visible.
The physical projection keeps updating and the same detail restores on return.
Native tests just before/after the boundary remove 515 content layers (528→13),
are pixel-identical at DPR 1 and differ by at most two channel levels at DPR 2;
the unretired before-boundary comparison has the same two-level variation.
Dragging while retired and returning to the resolved Sun preserve identity.
Evidence: `output/playwright/system-detail-retirement-proof/`.

These synchronized single captures show reduced specific costs, not completion
of the performance target. The orbit cleanup lowers style time in this pair;
the diagnostics change lowers sampling cost. Planetary-band p95 remains 33.4 ms,
and GPU stalls remain at first volume entry. No overall speedup is claimed from
these single runs. rAF intervals are not a count of dropped display frames.

| Run | Band >25 ms | Band p95 | Max interval | Style total | Mean recorder sample |
| --- | ---: | ---: | ---: | ---: | ---: |
| `context-retirement` | 104/571 | 33.4 ms | 66.7 ms | 4353 ms | 4.15 ms |
| `orbit-picker-owned` | 106/576 | 33.4 ms | 83.3 ms | 3814 ms | 4.11 ms |
| `retained-geometry-owned` | 111/585 | 33.4 ms | 233.3 ms | 4115 ms | 1.27 ms |
| `system-detail-retirement` | 113/580 | 33.4 ms | 183.3 ms | 3882 ms | 1.22 ms |

All four captures have recorder JSON, gzip Chrome trace, video, loaded/source
identities and verified synchronization. Detailed hashes and clock deltas are
in `output/world-context-zoom/retained-publication-comparison.json`.
The long `world-style-invalidation` diagnostic is INVALID for synchronization:
Chrome's continuous buffer overwrote its start mark. Surviving mutation stacks
were useful only for locating publishers. `orbit-picker-invalidation` is a
separate bounded, synchronized diagnostic; it is not a full-route timing pair.
The earlier `retained-geometry-native-proof` attempt stopped on its unrelated
whole-page pixel assertion; the focused verified counter/navigation run above
is the evidence for the counter change.


### Unchanged point-worker publications

The real worker returned the same 2,048 identities to a stationary camera, but
the runtime incremented its point-image revision unconditionally: one render
became two and 2,048 projections became 4,096. Membership now invalidates the
image only when identities are added or removed. Selection diagnostics still
update, and a changed camera still projects immediately. The same real-worker
probe now stays at one render and 2,048 projections. Both captures retain 1,953
visible points and the same maximum projection error, 0.000877 CSS px.
Evidence: `output/playwright/point-selection-identical-{baseline,candidate}/`.

The existing real-worker conformance passes six positions/orientations at both
DPRs, with one retained worker and stable slots. The exact-projection image
comparison differs in one of 800,000 pixels at DPR 1 and none of 3,200,000 at DPR 2
at the existing 0.01 comparison threshold. This proves the focused publication
change, not completion of the full-route performance target.


## Combined publication change and same-document repetition

The full `3e86a4f9` capture completed after the real-worker checks above. The
following cold/warm pair repeats the native Sun → Milky Way → Sun route without
reloading the document or replacing the retained world. Both use the same build,
prepared resources and physical input tape; the warm return-to-start differs by
2 km at about 3.42 million km due to bounded native-wheel rounding.

| Run | Band >25 ms | Band p95 | Maximum movement interval | Style total | Recorder mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| `retained-publication-owned` | 72/581 | 33.3 ms | 133.3 ms | 3401 ms | 0.96 ms |
| `same-scene-cold` | 112/593 | 33.4 ms | 400.0 ms | 4362 ms | 1.33 ms |
| `same-scene-warm` | 176/619 | 33.4 ms | 216.7 ms | 4859 ms | 1.31 ms |

All three sets contain native recorder JSON, compressed Chrome trace and video.
Synchronization passes, with retained world/input/document identity, no HMR, no
reported errors and no trace loss. Clock offsets for the cold/warm pair agree
within 68 microseconds across the recordings. Full hashes and measured clock
errors are in `output/world-context-zoom/same-scene-comparison.json`.

The cold run's 400 ms interval aligns with a 420.4 ms GPU ScheduleOverlays call
near initial volume entry. The warm run avoids that particular first-entry
stall but still has a 216.7 ms interval during the return, aligned with a
233.6 ms ScheduleOverlays call. These traces do not establish that earlier
image decoding alone would solve the rendering stalls. Other active browser
and build workloads were observed on the workstation after the pair; these
are uncontrolled single runs, not an isolated speedup benchmark. The earlier
72/581 result is encouraging but is not a stable achieved frame budget.


## Orbit projection follows the consumer's demand

Hidden orbit paths previously projected and allocated their entire clipped path
just to determine a proxy fade. The shared prepared-ring projector now has a
measurement-only operation beside full geometry publication. Both visit the
same prepared chords and use identical clipping and occlusion; the measurement
stops only once the existing 48/128 CSS-pixel fade has saturated. Its return
value is a scalar, so truncated geometry cannot escape into painting or picking.
Visible and hovered paths still publish their full original geometry. Endpoint
transforms are lazy and shared within the visit, including sparse active chords.

Using the recorded camera and optics at 87 planetary-band samples, a pure
projection census of 5,824 hidden asteroid paths reduces vertex transforms from
442,624 to 305,580 (31%). 2,749 paths stop early, with every capped extent exactly
equal to its full-path reference. This counts mathematical work, not saved frame
time. Evidence: `output/playwright/orbit-demand-work.json`.

Ten settled browser comparisons replay identical recorded physical frames through
the exact `3e86a4f9` and candidate world renderers at DPR 1/2. All published styles
are identical, all 44,079 fixture nodes remain retained, and images differ by at
most one channel level. The fixture uses the published 178-body context, its
marker assets and renderer CSS. It isolates world annotations; it is not a second
application scene or a full-route performance trace. Bundle/catalog hashes and
images: `output/playwright/orbit-demand-replay-settled/`. The broader focused
shared-world, solar-system and picking suite passes 89 tests; renderer typecheck
and build pass.

Native baseline navigation/toggles completed 14 views at DPR 1/2. Seven candidate
DPR 1 views (zoom, asteroid hover, toggles, return) matched rendered declarations
within camera roundoff and images within one channel level. Separate native runs
are not exact-history image oracles: hidden labels retain older positions, CSS
declaration order can vary, and decluttering remembers prior placement. The
initial full-scene comparisons are therefore not claimed as all-DPR parity; one
DPR 2 image differs by up to three levels. The exact-history replay above is the
renderer equivalence evidence. The first replay sampled its 200 ms label fade
before it had settled and is excluded; the qualified replay waits 500 ms.

## Direct minimap transform publication after main integration

Main `c61d1bf9` is integrated at `bc30df6a`; its world context contains 227
bodies / 226 orbits. The merged minimap artifact still contains 2,209 points
(2,048 stars and 161 bodies). The following pair deliberately holds that artifact
fixed; it is not comparable as an identical catalog to the earlier 178-body runs.

The minimap previously wrote its grid rotation as an inherited custom property
on the root, although only the grid consumes it. Publish `transform` directly to
the retained grid and skip identical matrices. Point projection, ring dimensions,
opacity, clipping, source data and the galaxy image stay unchanged. Static
responsive variables remain CSS-owned.

Chrome's direct matrix fast parser rounds coefficients that variable substitution
preserved. A constant `calc(number)` for the first matrix coefficient preserves
the full numeric parser for the grid; the existing galaxy matrix is unchanged.
The plain direct assignment was rejected after a same-page typed-matrix probe
proved its precision loss. This avoids changing raster alignment as a side effect
of moving the publication owner.

Evidence: `output/playwright/minimap-direct-precision-complete/` replays the
recorded system, stellar and galactic views plus orientation changes, at DPR 1/2.
It compares baseline → direct → restored on the same retained 2,316 elements.
All 18 computed-style and full-double matrix comparisons are exact; image
channel differences are recorded alongside the restored-baseline repeat.
Separate-page and strict-zero-raster attempts remain in neighboring evidence
directories and are not asserted as pixel-identical qualifications.

The same-catalog `minimap-direct-grid` capture at `324c86b8` is synchronized
(recorder `72f73785-c07a-494a-abc9-4dcc79caa790`, trace/video anchor drift -110 us,
video PTS error below 0.50 ms). It has no application errors, HMR or identity
replacement. Its 5–5,000 AU band has 210/585 intervals above 25 ms, p95 33.4 ms;
maximum movement interval is 33.5 ms. Style time totals 5,419 ms, compared with
6,924 ms in `orbit-demand-integrated`. This is an observation, not an attributed
22% speedup: recorded orientation is constant in both runs and machine load
varies. The target is still unmet. Raw synchronized file hashes are in each
run's `synchronization.json`.

## Preparation-owned minimap point range

The minimap now prepares a separate ordering of source-point indices by X.
Two binary searches select the conservative X slab of the current view sphere;
only those candidates undergo the existing exact 3D marker-inset test. A retained
visible set hides departures. Marker DOM order, colors, opacity, image content,
projection, clock and update cadence stay unchanged. There is no runtime sorting,
new scene, worker protocol or approximate point substitution.

Regeneration also incorporates the already-merged 227-body context: 2,275 points
including 2,048 catalog stars. It adds the missing 66 body markers, not extra
rendered object scenes. `galaxy.png` is byte-identical after regeneration.

Three focused tests verify source-index completeness/current body membership,
inclusive duplicate boundaries and exact sphere membership for 200 off-origin
views across 20 orders of magnitude. The real module comparison uses the same
refreshed artifact for baseline and candidate: all 18 DPR 1/2 views have identical
visible computed styles, retained 2,382-node identity and pixel-identical images
(`output/playwright/minimap-point-range-parity/`).

A work census over 379 recorded physical views reduces candidate point tests from
862,225 to 246,049. In the 242 views with minimap range below 1e16 m, it reduces
550,550 to 32,598 (94.1%). These count reductions are not a frame-rate claim.
The input and per-view counts are in `output/playwright/minimap-point-range-work.json`.

`minimap-indexed-catalog` at `1ba6be57` completes the same native wheel tape with
all three synchronized artifacts (recorder `4b70204d-cc0d-4979-836e-5a800f6b7f0a`).
Clock-anchor drift is 54 us and maximum video PTS error is 1.50 ms. Document,
world and input identities survive; one detailed camera remains mounted; errors,
HMR and trace data loss are absent. This run includes the refreshed 66 additional
minimap markers, unlike the preceding direct-grid capture.

The system band has 156/578 intervals over 25 ms (27.0%), p95 33.4 ms. Whole-route
maximum interval is 133.3 ms. Main-thread movement totals include 5,363 ms style,
1,172 ms layout, 915 ms paint and **4,625 ms layerization**, in addition to
10,460 ms inclusive animation callbacks. Workstation load was lower than the
previous run, so this is not a controlled percentage speedup. It confirms the
remaining browser rendering work and does not establish smooth playback.

## Shared stylesheet ownership and check boundaries

The minimap stylesheet belongs to the shared Astro shell, alongside the other
scene styles, so it loads before client mounting and pure runtime imports stay
usable by Node-based router checks. The merged main's CSS import in the minimap
JavaScript produced `ERR_UNKNOWN_FILE_EXTENSION` in three test files; moving that
import fixes those module-loading failures. The range/source-membership tests now
run in the shared-universe CI workflow.

The initial aggregate shell run completed with 197 passing / 8 failing checks.
In addition to those CSS import failures, it reported stale Dimorphos prepared
transport, missing YORP source marker image and missing Dike prepared object data.
After the stylesheet change, the selected router/shell/minimap/recorder suite
executes and its only failure is the missing Dike prepared object. Thirteen
focused minimap, recorder and surface-map checks passed before that move. These
are local generated-input limits, not a claim of aggregate object readiness;
there was no bulk asset copy, source substitution or ignored-output cleanup.


## Final integrated repeat and GPU correlation

The pushed runtime at `71ac37ae` is captured in `minimap-indexed-shell` with native
recorder `c16cfd54-da30-473a-ba98-ea315c81ef17`, Chrome trace gzip and video.
Synchronization passes (68 us clock drift; video PTS error below 0.50 ms), with
no errors, HMR or retained identity changes. The shared-universe CI check passes
on that exact runtime revision, including the new minimap range checks.

The 5–5,000 AU band repeats at 155/579 intervals above 25 ms (26.8%), p95 33.4 ms.
The 116.7 ms return interval aligns with **150.9 ms GPU overlay scheduling** for
eight overlays. The overlapping main-renderer task is 13.2 ms; video observations
have a 182.5 ms gap around the same event. The correlation is recorded in
`minimap-indexed-shell/return-stall-correlation.json`. Whole movement totals are
5,283 ms style, 1,168 ms layout, 920 ms paint and 4,670 ms layerization.

A disposable-page `covered-sky-residency-probe` kept the six prepared sky faces
visible beneath the opaque volume matte, without changing repository code. Its
native recorder is `b2f75c59-4830-48be-ac07-ae9fbe31c126`; the override is explicit
in its capture manifest. It still has a 166.7 ms movement interval and 183.5 ms
GPU overlay scheduling. Keeping the covered sky alone is not a demonstrated fix
and is **not included in the product**. The next unresolved issue is browser
surface/layer residency and publication cost, not missing image decoding.

### Direct optical-copy publication

Rotation still changed two inherited optical-opacity variables on each volume
axis root. Those declarations reached its entire retained slice subtree. The
runtime now retains the two lists of extra optical copies and their last numeric
coefficients, and writes `opacity` directly only when a coefficient changes.
Base slices, saturated coefficients, and pure camera translation receive no
optical writes. Slice order, 3D transforms, axis mixing, optical mathematics,
canonical textures and DOM topology are unchanged.

`volume-optics-inherited` uses exact baseline `d216312f`. The
`volume-optics-direct` capture uses that checkout with the direct runtime source
SHA-256 `3859edc3e4fecdeb1f13f45a306e70af78974f8983fb5eb0f83424d753962d34`.
Both replay the original Sun–galaxy–Sun wheel tape, adding a native 60-step
forward and reverse drag at the galaxy view. Both return to the same Sun pose.
The source and loaded module hashes are recorded independently.

| Rotation phase | Inherited variables | Direct opacity |
| --- | ---: | ---: |
| Style recalculations | 145 | 145 |
| Elements recalculated, summed | 387,259 | 338,923 |
| Style time | 656.8 ms | 497.7 ms |
| rAF callback time, inclusive | 407.6 ms | 394.5 ms |
| rAF intervals >25 ms | 46/262 | 27/263 |
| rAF interval p95 | 33.3 ms | 33.3 ms |

The measured work reduction is 48,336 fewer element recalculations (12.5%).
Style time was 24.2% lower in this single pair. Workstation load varies, so the
frame-interval difference is not a controlled overall speedup claim. The direct
capture's complete zoom route has 214/580 system-band intervals above 25 ms,
p95 33.4 ms, and maximum 33.5 ms. Absence of a long GPU pause in this run does
not overturn the earlier repeated GPU-stall evidence: the target remains unmet.

Both captures contain recorder JSON, gzip Chrome trace and timestamped video.
Recorder ids are `95e69467-a428-4774-8cf5-9aec7783b4c6` and
`23e80656-e580-4b0d-ae86-061cac260568`. Clock drift is +19/-106 microseconds;
encoded video timing error is below 0.5 ms. There are no errors, trace loss,
recording-time HMR events, or lost world/input/document identities. The direct
run's initial dev-server reload occurred before its final document time origin,
over five seconds before recording. See `volume-optics-comparison.json` and the
per-run synchronization manifests under `output/world-context-zoom/`.

`output/playwright/direct-optical-copy-parity/` compares both exact renderers
with the same recorded rotation poses and prepared volume. All 14 DPR 1/2 views
are pixel-identical, with identical computed presentation and 1,380 retained
nodes. The existing native universe environment check passes Mercury overview,
heliosphere, sky/volume transitions, physical volume translation and rotation,
and return to Sun, preserving decoded images and retained scenes. Its evidence
is in `output/playwright/direct-optical-copy-environments/`. All 79 focused
volume/sky/universe tests and the renderer typecheck pass, including unchanged
optical-density and opaque-dust checks plus sparse retained-write coverage.

The separate `context-layout-islands-probe` is excluded from the product.
Adding layout/style containment to body groups did not reduce the full-route
style/layout cost (5,860/1,338 ms versus the preceding 5,283/1,168 ms capture).
Its synchronized evidence is retained; no containment rule was shipped.


### Finish direct publication for labels and sky handles

The remaining navigation-time custom-property writes were label fade alpha and
an unused per-object sky-orientation alias. Label fades now publish a numeric
coefficient directly in `opacity`; the existing static CSS hover multiplier
still supplies appearance policy. Flight suspension cancels both the fade and
its pending hide timer before taking ownership of opacity. Resumption adopts
the retained alpha and the current view. No label wrappers or render leaves
were added. The sky keeps its direct orientation transform and functional shared
zoom property; its unconsumed per-object aliases are no longer published.

All 32 normal/group-hover/label-hover/focus comparisons at DPR 1 and 2 are
pixel-identical, including partial alpha, with identical computed color, weight
and opacity. The focused set has 77 passing checks, including fade reversal,
cancellation/adoption, pending flight fades, retained picking, point-field
transitions and standalone/shared sky orientation. Renderer typecheck and build
pass. Evidence is in `output/playwright/direct-label-opacity-parity/`.

The final matched DPR 2 route is
`output/world-context-zoom/direct-publication-final-dpr2/`, recorder
`fef415ff-2b04-43a6-8ead-001245cad34d`. It uses 384 outgoing wheel events, a native
60-step rotation in each direction, and 396 returning wheel events. It records
**zero programmatic custom-property writes** during movement. Source and loaded
resource hashes are retained; the captured runtime source hashes still match
the final source. World, input and document identities remain stable, with one
detailed camera and Sun selected on return. Clock drift is 29 microseconds and
maximum video PTS error is 1.96 ms. There are no application errors,
recording-time HMR events or trace data loss.

This is not a claim that the performance target is met. In the 5–5,000 AU band,
162 of 647 native rAF intervals exceed 25 ms and p95 is 33.4 ms. Band membership
uses the latest preceding native 125 ms camera sample. The return still has a
116.6 ms interval, aligned with 128.9 ms in GPU `ScheduleOverlays()` for eight
overlays. See `qualification.json` and `stall-correlation.json`. These figures
remain absolute observations rather than a controlled causal speedup claim;
input delivery and workstation load differ across captures.

Exploratory DPR 1 runs do not qualify the established DPR 2 target. Earlier
capture attempts with missing inspector response bodies or a full compositor
trace buffer are retained and excluded from qualification; their artifacts were
not substituted into the final run. The final capture uses the established
bounded trace categories and hashes the worker catalog response as delivered.
A separate disposable Sun backface probe changes visible pixels (up to 118
channel levels at DPR 2) and is excluded from the product.

### Prepared bounds for offscreen volume and sky images

Both image compilers now emit conservative scene-coordinate bounds from the final
PolyCSS rectangle, including its compiled edge extension. Runtime transports five
camera clip planes into that coordinate frame and changes retained leaf visibility
only when a complete bound leaves the guarded viewport. All optical copies share
one decision. Re-entry restores inherited visibility, with no remount, image
replacement, geometry derivation or CSS-variable publication. Legacy payloads or
viewports without bounds/dimensions conservatively retain their images.

The metadata-only recompile verifies all 462 image resources and exact equality
of every existing geometry, optics, provenance and resource field. The 456 volume
slabs and six sky images remain unchanged. Evidence is in
`output/playwright/prepared-frustum-proof/`, including the original envelope,
compiler receipt and browser comparisons.

Across 22 static comparisons at DPR 1/2, content-layer savings range from 0 at the
external galaxy view to 273 at an oblique internal view (884 to 611). Every DPR 1
image is pixel-identical; DPR 2 differences are at most two channel levels. All
1,374 image leaves remain mounted, including after return to the Sun. This is a
content-layer census, not a GPU-memory measurement. Eighty-six focused renderer tests,
280 universe preparation tests, both typechecks and the renderer build pass.

The full DPR 2 native-wheel/drag route is retained under
`output/world-context-zoom/prepared-frustum-dpr2/`, recorder
`503739f8-9528-49f2-be76-ac95e7fc31e1`. It preserves document/world/input identities,
one detailed scene, the final Sun selection and zero scripted custom-property
writes. No application errors, recording-time HMR or trace data loss occurred.
The new clip functions account for about 27.3 ms of sampled self CPU over the
minute-long recording.

**The frame target remains unmet.** Planetary-band p95 stays 33.4 ms, with 207/625
intervals over 25 ms versus the preceding capture's 162/647. Whole-route maximum
is 150 ms; a 172.3 ms GPU `ScheduleOverlays` event still involves eight overlays.
Different host load and input delivery prevent attributing the timing difference
to this change. The demonstrated gain is fewer retained offscreen content layers;
this capture does not establish a smoother route.

Chrome delivered 34 video observations out of timestamp order. The original
arrival manifest and invalid arrival-order video/export remain preserved. The
qualified `sun-milky-way-sun-chronological.mp4` orders all 3,041 original images by
their capture timestamps; `video-chronological-frames.json` retains each arrival
index. `synchronization-chronological.json` verifies all 3,041 encoded frames,
-103 microseconds of recorder/trace drift and at most 1.503 ms of video PTS error.
Use that chronological export for diagnosis. CDP observations still do not prove
every display refresh.


### Share projected orbit vertices within each camera publication

Orbit projection now caches shared screen endpoints during one visit. Fully
in-frame chords outside all conservative occluder shadows use their final
endpoints directly; boundary and occluded chords retain the detailed clipping
path. The fast path preserves the old endpoint arithmetic, including its
floating-point rounding. No geometry, stroke, hover, picking or DOM policy changes.

An isolated replay of 111 recorded planetary-band cameras and 12,862 orbit
projections reduces endpoint projection calls from 3,855,764 to 1,006,940 (73.9%).
All 939,703 resulting segments match exactly. This replay disables occlusion to
isolate endpoint work; the existing limb/near-plane tests and real browser checks
cover occlusion. It is not a frame-rate benchmark. Evidence and both projector
versions: `output/playwright/shared-orbit-projection/`.

All 24 real-browser comparisons at DPR 1/2 have identical published orbit geometry
and label styles, retained nodes, and no errors. Screenshot differences are at
most one channel level. The 89 affected renderer tests, typecheck and build pass.

The synchronized full route is in
`output/world-context-zoom/shared-orbit-projection-dpr2/`, recorder
`af1983d4-f82a-477f-a0ce-e20446d838c1`. All 2,946 video observations are encoded in
capture-time order (two arrived out of order), with -22 microseconds recorder/trace
drift and maximum video PTS error 1.476 ms. Source hashes match, document/world/input
identities remain stable, and there are no application errors, recording-time HMR
or trace loss. `qualification.json` includes the three artifact SHA-256 values.

**The frame target remains unmet:** 191/634 planetary-band intervals exceed 25 ms,
p95 remains 33.4 ms, and the whole-route maximum is 50 ms. The preceding capture
had 207/625 and a 150 ms maximum, but input delivery and host load differ. The
verified improvement is reduced projection work, not a causal smoothness claim.


### One owner for annotation opacity animation

The shared context stylesheet applied a 120 ms CSS opacity transition to every
camera-published orbit and circle, and to labels already driven by the retained
fader. The preceding synchronized route started 37,570 CSS opacity transitions,
including 30,907 in the planetary band. The renderer now publishes camera alpha
directly, retains the existing label visibility fade, and explicitly owns flight
fade-out/resume through the retained faders. Resume uses a common 120 ms deadline
that subsequent camera samples cannot extend. Hover brightness now updates
immediately; pointer feedback and 120 ms ring growth/shrink remain.

The 61 affected tests, renderer typecheck and build pass. Native Mars label-click
flights at DPR 1/2 have seven/eight intermediate fading samples, reach Mars, retain
world nodes and one camera, and produce no CSS opacity animations. Across 24
settled browser views, published orbit geometry and label styles match; screenshot
differences are at most two channel levels. Evidence:
`output/playwright/opacity-ownership{,-flight,-visual}/`.

The full synchronized DPR 2 route is
`output/world-context-zoom/opacity-ownership-dpr2/`, recorder
`3054df7d-909e-471b-9fc4-ededc1a232ea`. It records zero CSS opacity transitions.
Planetary-band long intervals fall from 191/634 (30.1%) to 66/712 (9.3%); Chrome
also records 66 `DroppedFrame` events in that band. P95 is still 33.3 ms, so the
performance target remains unmet. Host load and input delivery differ; these
observations do not establish a statistical speedup. Whole-route maximum is
50.1 ms. Sampling costs about 1 ms, with 1.2 ms p95.

All 2,906 video observations are preserved in timestamp order, with 57 microseconds
recorder/trace drift and maximum video PTS error 1.439 ms. Source hashes match;
world/input/document identities are stable; no errors, recording-time HMR or trace
loss occurred. `qualification.json` records artifact hashes and validation.


### Publish only visible body proxies

The final presentation now writes marker/circle transforms only when the proxy
can draw. Culled nodes stay mounted; their current position and alpha are
published on the same callback that reveals them. Picking and decluttering still
use the current projection. A native 45-wheel probe observes 15,715 marker and
15,565 circle mutation records carrying changed hidden transforms before this
change, and zero after it. These are observer records, not exact setter counts.

The 61 affected tests, renderer typecheck and build pass. Tests exercise hidden
camera changes and same-pose selection reveal. All 24 DPR 1/2 browser comparisons
preserve orbit geometry, visible styles and retained nodes, with maximum pixel
difference two. Hidden transforms intentionally retain their previous value;
CSS declaration ordering is normalized in visible-style comparisons. Evidence:
`output/playwright/hidden-publication/` and
`output/playwright/visible-proxy-publication-visual/`.

Two synchronized full DPR 2 routes have planetary-band p95 16.8 ms:

| Capture | Recorder | Intervals over 25 ms | Whole-route max |
| --- | --- | --- | --- |
| `visible-proxy-publication-dpr2` | `99e8ff13-c081-4527-adae-64f7197fef01` | 32/760 (4.2%) | 150 ms |
| `visible-proxy-publication-repeat-dpr2` | `a858bad0-a868-498d-9a86-bf0517ea7975` | 20/750 (2.7%) | 50 ms |

The preceding opacity-owner route had 66/712 (9.3%), p95 33.3 ms. Each new capture
contains native recorder JSON, Chrome trace gzip and all 2,949 video observations.
Recorder/trace drift is -96/13 microseconds and maximum video PTS error is
1.459/1.435 ms. Source hashes match, scene identities remain stable, and there are
no application errors, HMR, trace loss or CSS opacity transitions. Qualification
records identify tracked-source revisions separately from generated on-disk assets.

**The planetary-band p95 improvement repeats; full smoothness is not established.**
Native galaxy dragging has p95 16.8/33.3 ms across these runs. The 150 ms interval
in the first run overlaps a 184.851 ms GPU `ScheduleOverlays` event with eight
overlays at about 24.8 million AU; the repeat has a 48.513 ms event there. These
are correlated observations, not proof of GPU causality or a statistical speedup.
`residuals.json` maps the stalls back to recorder time. Host load, native input
delivery and simultaneous capture remain measurement limitations.
