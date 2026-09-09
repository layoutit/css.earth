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


### Retire parent depth publication with its drawing leaves

Galaxy rotation exposed a retirement gap: the context published only the Sun
locator's geometry, but still sorted and rewrote depth styles for all 227 body
groups. Depth/rank calculation remains current for picking and selection; DOM
publication now follows the same active-body scope as geometry. A scope change
restores every current depth on re-entry, even without a new rotation or selection.

A native drag records 9,155 changed z-index mutation records across 226 retired
groups before the change and zero afterward. Both the galaxy view and the
same-orientation system return are pixel-identical, and every restored depth
matches. Tests cover hidden rotation, hidden selection changes and distance-only
re-entry. All 62 affected tests, renderer typecheck and build pass. The existing
24 DPR 1/2 views retain exact orbit geometry and visible styles, with screenshot
difference at most two channel levels. Evidence:
`output/playwright/retired-order-publication{,-visual}/`.

Two final synchronized routes under `output/world-context-zoom/`:

| Capture | Recorder | Planetary band >25 ms | Drag >25 ms | Whole route >25 ms | Whole max |
| --- | --- | --- | --- | --- | --- |
| `retired-order-publication-dpr2` | `a733ad06-ee4b-4faf-886f-e8ddcacb5336` | 4/761 | 0/243 | 7/3496 | 33.4 ms |
| `retired-order-publication-repeat-dpr2` | `f40edbe9-9ce2-4438-854f-e2462db12c52` | 15/758 | 2/241 | 19/3489 | 116.7 ms |

Every phase has p95 16.7–16.8 ms in both runs. Galaxy-drag style work totals
344.4/339.4 ms, compared with 475.5 ms in the preceding visible-proxy repeat.
Host load/input delivery vary, so this is repeated absolute evidence rather
than a controlled statistical speedup. The second run's 116.7 ms return interval
still overlaps a 151.961 ms GPU `ScheduleOverlays` event; isolated stalls remain.
The adjacent video observations retain the scene and Sun locator.

All 2,946/2,941 video observations are preserved, including two reordered arrivals
per run. Clock drift is -18/34 microseconds and video PTS error is at most
1.478/1.427 ms. Source hashes and world/input/document identities match. There
are no application errors, HMR, trace loss or CSS opacity transitions. Each
`qualification.json` records source reference and artifact hashes;
`residuals.json` maps remaining stalls to recorder time and the profiler's source
thread (not its delivery thread). The repeated p95 improvement is qualified;
zero dropped frames and aggregate object readiness are not claimed.

## Completed-background composition (`53b721d2`)

The sky/volume path now factors the two prepared weights before compositing.
For handoff `t` and exposure `b`, the completed images still contribute
`(1-t)*sky + t*b*volume`. The volume host uses opacity `t*b`; its image is
unattenuated, and the opaque sky underlay uses `(1-t)/(1-t*b)`. At `t*b=1`
the sky is already retired and its opacity is zero. The existing flat 3D
boundaries, all slab optical copies, geometry and resources remain intact.
Contexts without a prepared sky retain the original matte/exposure composition.

The existing high-contrast setting reaches the retained world owner through the
shell/router callback, including changes made before world loading finishes.
It updates only the completed-background coefficients, immediately at a stationary
camera. It does not republish the star catalogue, rebuild a scene, or change the
prepared exposure metadata. The old CSS exposure override is no longer needed.

### Evidence and validation

Two unchanged `e3431154` Canary captures in `overlay-fence-canary-dpr2` and
`overlay-fence-canary-repeat-dpr2` exposed the nested
`IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn` event. In the sky/volume
handoff band, its largest waits were **161.791 and 101.804 ms**, with cumulative
waits **344.589 and 232.475 ms**. The trace contains GPU thread synchronization,
not that amount of application JavaScript CPU work.

The browser-only trials `overlay-factorized-canary-dpr2` and
`overlay-factorized-canary-repeat-dpr2` record exact original/modified module
hashes and replacement receipts. They are diagnostic substitutions, not product
revision qualifications. Their handoff maxima were **10.491/10.799 ms**, with
cumulative waits **25.925/24.652 ms**. Draw-render-pass counts remained similar;
this is evidence for changing the composition dependency, not eliminating a
claimed number of render passes. Band assignment uses the preceding 125 ms
recorder camera sample, so boundaries are approximate.

Before/after product screenshots are in
`output/playwright/background-composition/`: **52 views**, comprising 13 poses,
standard/high contrast and DPR 1/2. Camera state, every prepared slab/sky transform,
resource URL, leaf opacity/visibility and retained node identity match. The
largest pixel difference is **4/255**; only **12 color channels** across the full
set differ by more than 2/255. These are compositor rounding differences, not
pixel identity. Standard handoff reference/result images were also inspected.

Validation passes:

- 63 sky, volume and world-context renderer tests; renderer typecheck and build.
- 39 shell/router lifecycle tests, including pending-world contrast intent and
  navigation persistence without replaying it.
- Native DPR 1/2 high-contrast toggles at near, blended and galaxy views.
- Existing native environment journey: reported Mercury view, heliosphere,
  background transition, Milky Way drag, and return to Sun.
- Native cloud-handoff check: continuous image signal, physical parallax, no dark
  trough, no new image requests, and retained images on outward/return travel.

The contrast browser check now uses the existing shared native-wheel helper;
its old local helper omitted current input gains and failed to reach the new
transition sample. Its failed output is retained separately. The corrected check
passes using actual wheel input. Broader object readiness is not newly claimed.

### Integrated captures and remaining limits

Both captures below load clean revision `53b721d2e90d2cdf95323e50785ea635d52a0156`.
Every recorded source hash still matches that implementation, including the
changed shell/router files. Both retain one world/input/document and one detailed
camera, without application errors, HMR or trace loss.

| Measurement | `background-composition-dpr2` | `background-composition-compositor-dpr2` |
| --- | --- | --- |
| Recorder ID | `015f9fb7-0cad-4516-9008-f536a5e2dbed` | `9f2f6db6-e7a8-4fb6-81b9-3681df003fbe` |
| Planetary-band intervals >25 ms | 12/768 | 11/762 |
| Planetary-band p95 | 16.7 ms | 16.8 ms |
| Whole-route intervals >25 ms | 31/3518 | 22/3486 |
| Whole-route maximum | 216.6 ms | 49.9 ms |
| Largest Dawn scheduling wait | 23.038 ms | 10.158 ms |
| Video observations/encoded frames | 2921/2921 | 2953/2953 |
| Reordered video observations | 47 | 0 |
| Recorder/trace clock drift | 43 microseconds | 4 microseconds |
| Maximum video PTS error | 1.464 ms | 1.460 ms |

The second capture adds the normal `cc` trace category to distinguish compositor
waiting from CPU execution; its timings include additional instrumentation. These
runs and the browser trials are absolute observations, not a controlled claim of
an overall speedup. Workstation load and native event delivery vary.

**The full smoothness target remains unmet.** The first integrated capture's
216.6 ms frame interval overlaps a 191.294 ms renderer task with only **22.294 ms
of thread CPU time**, plus a 189.232 ms raster-worker task with **41.598 ms CPU**.
The remaining wall time cannot be attributed to application JavaScript from
sampling-profile duration alone; it can include waiting or scheduling delay.
Original video observations at recorder times 24756.644/25010.629 ms were inspected
and preserve the scene without a reset, while exposing the observation gap.

The compositor diagnostic did not reproduce that long pause. Its largest normal
commit wait was **1.685 ms**, so it does not establish a persistent commit-wait
bottleneck or explain away the earlier hitch. Its largest BeginMainFrame was
50.759 ms with 8.539 ms CPU. Other frames still exceed the frame budget with real
CPU work. Further optimization must distinguish those cases before changing
rendering or preparation again.

The earlier stable Chrome 152 capture also has a separate 210.907 ms
`FinishPaintRenderPass` event. Both stable Chrome 152 and Canary 155 used
Graphite/Dawn/Metal on this machine; the issue is not qualified as Canary-only.
No browser rendering flags were changed.

The capture folders retain recorder JSON, gzip trace, original chronological video
observations, encoded video, source/loaded receipts, and analysis/qualification
files. CDP video observations do not prove every display refresh.

### Orbit line serialization (`9bb22fbf`)

The current compositor trace identifies number formatting in the retained orbit
writer as a separate cost from the previously completed custom-property work.
Each matrix coefficient took the path `toFixed(6) -> Number -> toString` before
CSS parsed it again. The line writer now sends the fixed-decimal token directly,
with identical numeric precision, and retains the last numeric trail weight so
unchanged opacity needs no formatting. Other presentation formatters are unchanged.

A replay of 103 recorded planetary camera samples produces 883,547 segments with
zero differences in the numeric matrix/opacity values. Six alternating measured
Node writer passes have median 1411.307 ms before and 549.656 ms after. This 61.1%
reduction is an isolated writer result, with no CSSOM/layout/browser rendering;
it is not a whole-application speedup. Corpus generation disables occlusion,
which is exercised separately in the real browser and existing renderer tests.

All 129 affected renderer tests, renderer typecheck and build pass. The 24 DPR 1/2
browser views preserve exact camera state, visible orbit styles, labels, navigation
attributes and retained nodes. Full-frame differences reach 8/255 in the unchanged
sidebar Chromosphere thumbnail in the Sun views (DPR2 x72..103, y786..813); outside
that thumbnail the maximum is 2/255. No pixels were edited or omitted from the
full-frame comparison. Evidence: `output/playwright/line-serialization-final/`;
before images and the broader formatter trial remain in `line-serialization/`.

Both following captures use the same normal `cc` instrumentation, Canary155,
1995x1236 CSS viewport, DPR2 and native Sun–Milky Way–drag–Sun route:

| Measurement | `53b721d2` | `9bb22fbf` |
| --- | --- | --- |
| Planetary-band intervals >25 ms | 11/762 | 10/762 |
| Planetary-band p95 / maximum | 16.8 / 33.4 ms | 16.8 / 33.4 ms |
| Planetary animation-callback elapsed total | 4843.787 ms | 4555.340 ms |
| Number-formatting sampled self time | 693.476 ms | 329.620 ms |
| Line-writer sampled self time (excluding formatter) | 573.791 ms | 578.506 ms |
| Whole-route intervals >25 ms / maximum | 22/3486 / 49.9 ms | 23/3486 / 33.5 ms |
| Galaxy-drag intervals >25 ms | 4/242 | 12/236 |

The trace confirms reduced formatting work and about 6% less elapsed callback
work in the planetary band. The missed-frame count there barely changes, and
this run's galaxy drag is worse. Neither the isolated result nor the lower maximum
establishes a general smoothness improvement. The prior 216.6 ms stall has not
been proven eliminated. **The complete performance target remains unmet.**

Recorder `11549ff5-0ac8-43aa-a370-3c0b825583ee` is paired with trace gzip and video
in `output/world-context-zoom/line-serialization-dpr2/`. All 2946 observations are
encoded, with no reordering, 52 microseconds clock drift and <1.460 ms video PTS
error. There are no errors, HMR events or trace loss; all 20 source hashes match,
the source checkout was clean, 517 loaded-resource receipts were collected, and
the world/input/document identities and single camera survive. The comparison
scripts, artifact hashes and full metrics are retained alongside the capture.

Some `tdur` values in the expanded trace exceed their own wall duration. Those
CPU-clock readings are unreliable. The totals above use elapsed event durations;
profile samples are elapsed sampling weights, not independently measured CPU
consumption. Earlier thread-CPU figures should be read as reported values, not
proof of exactly how much of a long task was waiting. CDP video remains a series
of observations, not evidence of every display refresh.

### Prepared volume-plane ordering (`bf972bad`)

The next change addresses browser depth sorting, not CSS variables. Chromium
155.0.8043.0 feeds 3D drawing polygons into a BSP tree whose partition pivot is
the first remaining polygon. Parallel planes supplied in monotonic depth order
produce a long partition chain. The exact browser sources are
[`BspTree::BuildTree`](https://github.com/chromium/chromium/blob/155.0.8043.0/components/viz/service/display/bsp_tree.cc#L39)
and [`DirectRenderer::FlushPolygons`](https://github.com/chromium/chromium/blob/155.0.8043.0/components/viz/service/display/direct_renderer.cc#L599).

The volume preparer now emits median-depth planes first, recursively, keeping
coplanar source siblings in their original order. Runtime simply mounts that
prepared order; it adds no sorting, geometry, nodes, or camera work. All 456 leaf
values and the 462-resource manifest remain identical. The only authored payload
change is the leaf-array permutation and its authenticated descriptor hash.
Browser physical depth sorting still determines the image.

Preparation typecheck/build, 281 preparation tests and 83 volume/sky/universe
runtime tests pass. The regression independently models first-pivot partitioning
for 214 planes on each axis: maximum partition depth falls from 214 to 8 while
preserving input and coplanar order. Existing source/resource integrity checks
remain. The loader now verifies the exact prepared order instead of requiring
raw source-slice order.

A browser-only trial first permuted the same retained nodes, then the generated
product was checked independently. Both cover 52 views: 13 camera poses, standard
and high contrast, DPR 1/2. Trial versus original differs by at most 2/255; product
versus qualified trial by at most 1/255. All camera/style state hashes and retained
identities match, with no application errors. These are qualified views, not a
proof of every possible camera pose. Evidence is under
`output/playwright/balanced-volume-{order-native,product,preparation}/`.

All following measurements use the same native route and `cc` capture categories:

| Measurement | Original `9bb22fbf` | Browser trial | Product | Product repeat |
| --- | ---: | ---: | ---: | ---: |
| Drag draw-pass count | 831 | 831 | 831 | 831 |
| Draw-pass elapsed total | 443.271 ms | 139.629 ms | 145.453 ms | 151.287 ms |
| Largest draw pass | 5.037 ms | 1.896 ms | 1.825 ms | 1.830 ms |
| Quads in largest pass | 445 | 445 | 445 | 445 |
| Drag display draws | 120 | 120 | 120 | 120 |
| Drag renderer BeginMainFrame total | 1330.931 ms | 1300.608 ms | 1402.272 ms | 1459.682 ms |
| Drag rAF intervals >25 ms | 12/236 | 4/244 | 28/240 | 38/228 |
| Whole-route intervals >25 ms | 23/3486 | 21/3512 | 111/3548 | 108/3559 |
| Whole-route maximum | 33.5 ms | 33.4 ms | 33.5 ms | 66.7 ms |

The repeated 66–69% draw-pass reduction is scoped to that browser task, not the
application's total cost. **Overall smoothness is still unacceptable.** The two
integrated runs miss more frames, including in the planetary band (60/772 and
53/765, p95 33.3 ms), where this preparation change cannot reduce orbit work.
Initial one-minute host load was 5.13/6.03/10.54/10.94 respectively; that is a
comparison confounder, not proof that workstation contention caused the misses.
Renderer style and layer work remain on the drag path. Neither the better trial
nor lower draw-pass cost establishes an end-to-end frame-rate improvement.

Product recorder IDs are `aea35007-4fec-4c25-97cb-bea546a875ed` and
`62e1bdcb-b187-486b-b5d5-251cc3df2ef6`. Both capture clean `bf972bad` with all 22
source hashes matching, 517 loaded receipts, verified prepared DOM order, stable
world/input/document identities and one camera. Recorder JSON, gzip trace and
video are retained in `output/world-context-zoom/balanced-volume-order{-repeat}-dpr2/`.
All 2948/3009 observations are encoded; 33/96 arrived out of timestamp order and
are preserved with original arrival indexes before chronological encoding.
Clock drift is 14/43 microseconds, maximum PTS error 1.465/1.488 ms. There are no
application/resource errors, HMR events or trace loss. Per-capture qualification
files include artifact hashes and analysis scripts; video observations do not
prove every display refresh.

### Remaining minimap publication cost (`4a75686e`)

A node-attributed Chrome invalidation capture identifies the next owner precisely:
**54,600 of 59,841 style invalidations** come from `.space-minimap-dot` during 24
native camera updates (2,275 dots each update). Volume leaves account for 4,932.
This is separate from the completed grid-variable and prepared point-range work:
all points fit the large galaxy neighborhood, and their individual 2D transforms
are still published on every orientation change.

The short diagnostic directly initializes the full-route galaxy distance, then
performs a reversible native drag. It adds expensive invalidation tracking and
must not be compared with normal route timings. Recorder
`5fe76742-d85f-4f76-9aee-9553a1f86a3a`, trace gzip, video, backend-node DOM snapshot,
analysis and hashes are retained in
`output/world-context-zoom/volume-drag-invalidation-short-dpr2/`. All 22 source
hashes match clean `4a75686e`; all 25 observed video frames are encoded, with
25 microseconds clock drift, <0.013 ms PTS error, stable world/input/document
identities and no errors, HMR or trace loss. The longer invalidation attempt filled
its trace buffer and lacks a stop anchor; its preserved fragment is not qualified.

A passive minimap point-batch prototype publishes the same point projection,
colors, radii, opacity and source order into one CSS shadow list. It removes
2,274 elements, but **fails visual parity**: changes reach 248/255 despite matching
camera state and visible counts. The smaller diagnostic also confirms identical
grid styles and DOM rectangles while its image differs. Explicit point-layer
stacking and a flat-grid variant do not qualify. These prototypes remain only in
`output/playwright/minimap-shadow-*`; none changed product code. A separate atomic
volume-leaf style trial passes 52 visual comparisons but loses trace data, so it
also provides no qualified performance gain and is not adopted.

The next architectural work must reduce the minimap's per-point publication cost
while preserving its current grid, symbolic marker sizes, colors, opacity, source
order and continuous camera tracking. The failed batch is not a substitute for
that requirement, and the overall performance target remains open.


### Retain covered minimap markers without publishing them (`6b6de1207`)

The minimap now projects its existing prepared candidates into retained records,
then visits markers in reverse prepared DOM order. Only a later, completely
opaque planet or star may cover another marker. A conservative pixel-diagonal
clearance excludes edge contact and partial coverage; responsive scaling widens
the guard. Fully covered nodes stay retained and receive their current transform
and alpha as soon as they become visible again. Source positions, marker sizes,
colors, logical neighborhood counts and the camera cadence are unchanged.

Five range/coverage tests pass. The real-app comparison covers 62 views across
physical scales, orientations, desktop/mobile sizes and DPR 1/2. Camera state,
logical counts, all 2,381 retained descendants, and every drawn marker's complete
inline style match the baseline. All but one comparison differ by at most 1/255.
The desktop DPR 2, 1 AU case differs by up to 10/255 (135 channels above 2/255),
with three markers drawn in both versions and none retired by coverage. The
cause of that raster difference is unproven; the set is not pixel-identical.
Reports and source snapshots are in `output/playwright/minimap-covered-product/`.

A complete native Sun–Milky Way–Sun capture at clean `6b6de1207` uses the same
route and trace categories as the preceding balanced-volume repeat:

| Measurement | Balanced repeat | Covered-marker product |
| --- | ---: | ---: |
| Drag updates / browser draw passes | 120 / 831 | 120 / 831 |
| Drag renderer BeginMainFrame elapsed | 1459.682 ms | 948.857 ms |
| Drag UpdateLayoutTree elapsed | 402.532 ms | 213.016 ms |
| Drag Layerize elapsed | 346.775 ms | 215.464 ms |
| Drag draw-pass elapsed | 151.287 ms | 146.922 ms |
| Drag rAF intervals >25 ms | 38/228 | 1/244 |
| Whole-route intervals >25 ms | 108/3559 | 12/3495 |
| Planetary-band intervals >25 ms | 53/765 | 10/762 |
| Whole-route maximum | 66.7 ms | 50 ms |

This reduces measured renderer work while preserving the drawing topology. It
does not establish perfect smoothness: ten long intervals remain in the
planetary band, and the route includes a 50 ms outlier. Whole-route rAF intervals
are observations rather than a count of dropped display frames.

Recorder `2933ed39-1ab2-4cd3-914e-f079e7972992`, trace gzip, video and source
verification are retained in `output/world-context-zoom/minimap-covered-dpr2/`.
All 26 source hashes match the captured commit, with 518 loaded receipts. All
2,935 video observations are encoded, with -41 microseconds clock drift and
1.441 ms maximum PTS error. No application/resource errors, HMR or trace data
loss occurred; the world, input surface, document and single camera survive.
The trace buffer is 512 MiB; its categories are unchanged. This result precedes
the subsequent main integration and uses the earlier catalog, so it must not be
presented as qualification of the newer catalog or UI.


### Main integration and selection publication (`c59611d56` → `72719ccd`)

Main through `4848897ee` is integrated with its updated selection UI, orbit-center
contract and 258-body registry. All 258 local object descriptors were prepared;
minimap preparation includes 258 bodies plus the same 2,048 catalog stars. The
prepared galaxy texture and balanced volume artifact remain byte-identical.
Renderer and preparation typechecks/builds pass, as do 86 focused renderer tests
and 60 shell/router/minimap tests. This is not an aggregate object-readiness claim.

On the expanded catalog, 62 static minimap comparisons preserve camera state,
logical counts, every drawn marker style and all 2,412 descendants. Maximum pixel
difference is 1/255. One development reload was observed without a phase timestamp
in that visual script, so it supplies static comparisons, not timing evidence.
An earlier preparation-overlapped attempt was invalidated and retained separately.
The completed static comparisons are in
`output/playwright/minimap-covered-main-settled/`.

The integrated main selection feature assigned `data-context-selected` on every
camera publication. Each retained entry now remembers its published emphasis;
selection/overview changes update the attribute, and retired entries adopt current
selection when they re-enter. Camera motion alone does not republish selection
styling. No CSS variables, source geometry, opacity policy or rendered topology
change in this additional fix.

A real-app comparison at 12 AU performs 24 camera samples and then uses native
stage picking to select Mercury. Redundant selection-attribute mutations fall from
5,934 to zero; the full DPR 2 viewport is pixel-identical, all group styles and
camera state match, and Mercury/Sun receive the correct selected/unselected
attributes after the click. Reports, before/after compiled source, hashes and
images are in `output/playwright/selection-publication-settled/`. The broader
interception attempt failed during worker-route teardown and is not qualified.

| Measurement | Integrated main `c59611d56` | Selection publication `72719ccd` |
| --- | ---: | ---: |
| Whole-route rAF intervals >25 ms | 80/3463 | 58/3464 |
| Galaxy drag intervals >25 ms | 0/242 | 0/242 |
| Galaxy drag maximum | 16.8 ms | 16.8 ms |
| Planetary-band intervals >25 ms | 75/727 | 54/734 |
| Planetary-band p95 | 33.3 ms | 33.3 ms |
| Planetary-band RAF callback elapsed | 4631.802 ms | 4481.972 ms |
| Planetary-band UpdateLayoutTree elapsed | 1788.676 ms | 1725.284 ms |
| Planetary-band Layerize elapsed | 2180.329 ms | 2031.854 ms |
| Whole-route maximum | 50 ms | 50 ms |

Both use the original native route at 1995×1236, DPR 2, motion off. The repeat has
lower host load (galaxy-drag start about 4.7 versus 8.5), so the difference in
long intervals is not independently attributable to this cache. The verified
benefit is elimination of redundant selection mutations with identical output.
**The performance target remains unmet:** the planetary band still exceeds the
frame budget. Galaxy drag is improved, but it is not a substitute for smooth
zooming through the planetary view.

The complete synchronized captures are
`output/world-context-zoom/minimap-covered-main-dpr2/` (recorder
`c5529dbc-0639-4ddf-914e-b7220f04c684`) and
`output/world-context-zoom/selection-publication-dpr2/` (recorder
`ec9cc7f8-d957-4817-aa73-4b85138b10f5`). Each includes 26 matching source hashes,
630 loaded receipts, stable world/input/document identities, one camera, and no
application/resource errors, HMR or trace loss. All 2,951/2,931 video observations
are encoded; clock drift is -29/-32 microseconds and maximum PTS error is
1.478/1.470 ms. Neither capture claims to observe every display refresh.


A further trace comparison finds **0 / 3,137 / 3,113** CSS animation starts in
`6b6de1207` / integrated `c59611d56` / `72719ccd`. The new starts are opacity
animations on `S` elements. Main introduced
`[data-context-body] { transition: opacity 120ms ease; }`, although camera samples
also publish opacity on those same retained markers. A separate read-only native
wheel probe at 30 AU resolves the active transition targets to actual
`data-context-body` markers (including Makemake, Orus, Leucus and several
asteroids); its 14 observations have no application errors. That owner probe is
in `output/playwright/marker-animation-owner-settled/` and is not a timing capture.
This newly integrated opacity-owner conflict remains unresolved; the selection
attribute cache does not remove it. It is the next concrete issue to address,
while preserving selection feedback and direct camera-driven marker alpha.


### Direct camera-owned marker alpha (`036eb215`)

The body-marker opacity transition introduced by main is now removed. Camera
samples publish the requested marker alpha directly. **Body selection and hover
brightness feedback is immediate**; circle growth retains its 120 ms padding
transition. This aligns actual marker visibility with its current camera state
instead of restarting a 120 ms interpolation on every sample. No geometry,
textures, colors, sizes, source alpha targets or DOM topology changed.

During native wheel input, visible markers could lag their requested opacity by
0.370219. The direct owner removes that lag (zero observed), with no active marker
opacity transitions in the probe. Four controlled views (30, 12, 5 and 0.3 AU,
DPR 2) have identical camera, marker and label state; full-view pixel differences
are 0/1/0/0 on a 0–255 scale. Evidence is in
`output/playwright/marker-alpha-static/` and `marker-alpha-parity*/`.
The native-wheel end frames are not used as the fixed-state image oracle: their
retained hidden transforms differ, and one pair keeps Earth's label on different
sides (166/255 maximum difference). The existing declutter policy preserves a
previously valid placement; the controlled pose sequence also matches that state.

| Measurement | Selection cache `72719ccd` | Browser alpha trial | Product `036eb215` |
| --- | ---: | ---: | ---: |
| CSS opacity animation starts | 3,113 | 0 | 0 |
| Whole-route rAF intervals >25 ms | 58/3464 | 33/3468 | 25/3478 |
| Galaxy drag intervals >25 ms | 0/242 | 0/242 | 0/243 |
| Planetary-band intervals >25 ms | 54/734 | — | 23/741 |
| Planetary-band p95 | 33.3 ms | — | 16.8 ms |
| Whole-route maximum | 50 ms | 50 ms | 50 ms |

The product capture remains below 16.8 ms during galaxy dragging, but the
**overall target is still unmet**: 25 long intervals remain, including a 50 ms
outlier. The capture environment and host load remain confounders; animation
elimination and opacity tracking are verified mechanisms, not a claim that every
change in interval counts comes from this rule.

The annotated browser trial is in
`output/world-context-zoom/marker-alpha-owner-trial-dpr2/`, recorder
`6ec226f4-05de-4469-a1d4-bce599b73909`; its injected CSS is explicitly recorded.
The unmodified product capture is in
`output/world-context-zoom/marker-alpha-owner-dpr2/`, recorder
`2367dac8-e037-4042-998a-39c4326d454d`. Both include synchronized JSON, trace gzip
and video, 26 matching source hashes and 630 loaded receipts, with no errors,
HMR or trace loss. Generated Sun payload identity is checked against its
committed descriptor; tracked inputs match the captured Git revision. All
2,914/2,928 observations are encoded, with +13/-32 microseconds drift and maximum
PTS error below 1.475 ms. World/input/document identities and one camera survive.

## Retained orbit projection storage

The remaining planetary-band cluster includes frames with about 9 ms of camera
publication followed by 9–15 ms of browser style, layout and layer work. The
sampled cluster has one camera callback per frame; duplicate annotation callbacks
are not its demonstrated cause. A separate native-input mutation census observes
2,600 drawn orbit segments at 25 AU and 158,508 orbit-node mutation records over
35 wheel inputs (`output/playwright/orbit-publication-census/`). This is a work
census, not a timing benchmark.

Each mounted world-context orbit now owns bounded screen-segment storage matching
its existing retained leaf capacity. Projection reuses those slots instead of
allocating and freezing every output tuple on every camera publication. Prepared
vertices, exact clipping/projection arithmetic, line formatting, DOM capacity,
hit corridors, colors, opacity and label policy stay unchanged. Consumers read
this live view synchronously before the next publication; existing callers that
need independent snapshots still receive frozen snapshots. This change does not
remove the browser's per-segment style and layer work.

Validation:

- 62 focused projection, world-context, line-writer and retained-pool tests pass;
  renderer typecheck and build pass. Retirement, re-entry, immutable snapshot
  compatibility and capacity overflow are covered.
- The replay produces **990,257 exactly matching segments** over 111 recorded
  views and 13,608 orbit projections. It deliberately disables occlusion to
  isolate numeric projection; occlusion and picking are covered separately by
  the focused tests and browser views.
- 24 browser views at DPR 1/2 retain exact camera, orbit styles, labels and nodes;
  full-frame differences are at most **1/255**. The baseline's recorded script
  omits the retained-buffer argument at the compiled call site. It checks the
  replacement count but did not persist intercepted-request counts. Evidence:
  `output/playwright/retained-orbit-projection/`.

The synchronized candidate capture is
`output/world-context-zoom/retained-orbit-projection-dpr2/`, recorder
`42091814-4452-4165-914d-693e3e533c07`. It records base commit `89eb75ee9` plus its
exact `source.patch`; all 26 source hashes and the patch match again after the
capture, with 630 loaded-resource receipts. No HMR, application/resource error or
trace loss is observed. All 2,907 observed frames are encoded, clock drift is
−95 µs, and maximum PTS error is 1.439 ms. World, input and document identities
stay retained, with one camera and Sun selected at the end.

| Measurement | Direct marker alpha | Retained orbit storage |
| --- | ---: | ---: |
| Whole-route rAF intervals >25 ms | 25/3478 | 20/3459 |
| Galaxy drag intervals >25 ms | 0/243 | 0/242 |
| Planetary-band intervals >25 ms | 23/741 | 17/740 |
| Planetary-band callback elapsed total | 4483.538 ms | 4173.298 ms |
| Planetary-band style elapsed total | 1633.713 ms | 1657.646 ms |
| Planetary-band layer elapsed total | 2012.686 ms | 2025.846 ms |
| Whole-route maximum | 50 ms | 50 ms |

The allocation/ownership change is verified. The modest timing difference is one
capture per version and is not an isolated causal frame-rate claim. Browser work
is essentially unchanged, and **the performance target is still unmet**. rAF
intervals and video observations do not prove every display refresh.

## Overview changes stay with their existing owners

The 50 ms interval in `retained-orbit-projection-dpr2` overlaps the Sun-card to
Solar System overview switch. The CPU profile attributes 18.741 ms of sampled
elapsed time to `selectTab`, and the trace shows 14.551 ms of style recalculation
(6,861 elements) plus 4.047 ms of layout inside that callback. `selectTab` changed
row visibility and then assigned `scrollTop`, forcing the pending layout.

The browser controller now resets the outgoing scroll position before changing
visibility. Closing resets the visible panel; reopening a hidden panel needs no
readback. Direct filtering and tab selection own their reset, while nested calls
reuse the outer reset. No deferred scroll, cached guessed position or intermediate
paint is introduced. Seven browser comparisons preserve native scrolling, tab
selection, close/reopen, keyboard focus, camera and retained nodes, with differences
at most 1/255. The baseline replacement URL/hash is recorded and both documents
remain stable without HMR during the comparisons. The earlier attempt that
incorrectly required one HTTP request rather than accepting duplicate identical
preloads is retained as unqualified.

Automatic Sun/overview toggles also no longer run a Sun-to-Sun navigation. They
change the existing selection, centering policy and URL in place, retaining the
camera, scene and continuous URL subscription. A different selected body still
uses normal navigation to the Sun. Three mode comparisons are pixel-identical and
preserve exact camera state with zero navigation requests. Reload, native Mercury
selection and Back restore the exact saved overview URL, including its unrelated
query and hash. Evidence: `output/playwright/overview-scroll-publication-settled/`
and `output/playwright/overview-selection-owner/`. All 56 focused shell, router,
selection, history and view-URL tests pass.

| Outward overview inspection | Original owners | Scroll reset before writes | In-place selection too |
| --- | ---: | ---: | ---: |
| Callback elapsed | 32.517 ms | 14.544 ms | 6.935 ms |
| Forced style/layout inside callback | 18.598 ms | 0 | 0 |
| Navigation requests for the route | 1 | 1 | 0 |

These are single synchronized captures of each version; timing is not a controlled
statistical speedup claim. The removed forced readback and redundant navigation
are directly evidenced by stacks and events.

The combined capture `output/world-context-zoom/overview-selection-owner-dpr2/`
records base `a669c6e99` plus its exact two-file `source.patch`; all 26 source hashes
and the patch match after capture, with 630 loaded receipts. Recorder identity is
`a9a6fb38-fcb9-48b5-93b6-9e4bd88243c1`. There are no errors, HMR or trace loss. All
2,918 observed frames are encoded, clock drift is −45 µs, maximum PTS error is
1.440 ms, and world/input/document identities and one camera remain retained.

**The overall target remains unmet:** the route has 19/3469 rAF intervals over
25 ms, including 17/740 in the planetary band and 0/243 during galaxy drag. The
planetary-band callback/style/layer totals are 4217.114/1650.511/2044.080 ms, so the
recurring drawing cost remains. The 50 ms maximum is at recorder time 5452.4 ms,
before the overview callback at 8730.189 ms. Its overlapping renderer BeginMainFrame
task takes 44.634 ms elapsed and 7.875 ms thread CPU; the source of the gap is not
established. A concurrent point-worker task is correlation, not proof of causation.
The scroll-only capture has 24/3482 intervals over 25 ms and a 33.4 ms maximum,
which reinforces why these runs do not prove general smoothness.

## Orbit stylesheet isolation and sampling control

A browser-only trial moved the existing inert orbit blocks into 257 shadow roots,
with one shared stylesheet carrying their exact drawing rules. All 63,997 original
world-context elements (61,938 `s` leaves, including body sprites) stayed connected;
no line, source vertex or texture was removed. The first exploratory stylesheet
missed the page-wide border-box rule and is unqualified. The corrected version
matches computed styles, exact projected line values, camera and label state in
12 DPR 2 views, with full-viewport differences at most 1/255. Native Saturn orbit
hover grows its indicator from 16 to 20 px, shows a pointer, selects immediately
on click and lands with one camera. These are trial results, not a new runtime DOM
contract: production diagnostics and selectors would need explicit shadow-tree
support before adopting such a change.

The synchronized trial is `output/world-context-zoom/orbit-style-scope-trial-dpr2/`,
recorder `567947f3-ad2a-4ae7-a58d-022f7deda7ef`, based on `f6d5aac18`. Its capture
script records the injected stylesheet and pre-recording tree move. The recorded
26 source hashes remain unchanged, with no source patch. All 2,927 observed frames
are encoded, clock drift is +91 µs and maximum PTS error is 1.433 ms. There are no
errors, HMR or trace loss; the trial tree, world, input, document and one camera
remain stable throughout recording.

| Planetary-band measurement | Normal stylesheet scope | Isolated orbit scope |
| --- | ---: | ---: |
| Intervals >25 ms | 17/740 | 17/748 |
| Callback elapsed total | 4217.114 ms | 4258.373 ms |
| Style elapsed total | 1650.511 ms | 1637.556 ms |
| Layer elapsed total | 2044.080 ms | 2069.518 ms |

**Rejected:** this trial does not show a useful reduction in recurring work and
does not justify changing the tree architecture. It is not included in product
code. Visual/input evidence lives in
`output/playwright/orbit-style-scope-corrected/`; the initial unqualified trial
remains in `output/playwright/orbit-style-scope/`.

A separate instrumentation control runs the unchanged product and same recorder,
video, timeline/cc/Viz/GPU tracing and input route, omitting only V8 CPU sampling.
It is `output/world-context-zoom/cpu-sampling-control-dpr2/`, recorder
`75ecc8ce-0191-497d-9ee0-8338946b1d27`. All 26 source hashes and the empty source patch
match; all 2,940 observed frames are encoded, with +5 µs drift and 1.457 ms maximum
PTS error. There are no errors, HMR or trace loss and the retained world/input/
document and one camera remain stable. The trace contains no CPU profile events.

That control still has 18/3487 route intervals over 25 ms and 16/749 in the
planetary band, versus 19/3469 and 17/740 with CPU sampling. Its band callback,
style and layer totals are 4132.119/1595.190/2016.811 ms. Host load differs and these
are single runs, so they do not establish a precise sampling overhead. They do
show that disabling CPU sampling does not remove the recurring stalls. This is
not a product improvement or a replacement for the fully instrumented baseline.
The performance target remains unmet.

## Rejected numeric publication, scratch storage and overflow trials

Three additional trials do not justify product changes. All use the same fully
instrumented route and 258-body catalog. The reference is the overview-owner
capture above; elapsed totals are single-run observations, not isolated CPU costs.

| Planetary-band measurement | Reference | CSS Typed OM | Retained projection scratch | Scene overflow clip |
| --- | ---: | ---: | ---: | ---: |
| Intervals >25 ms | 17/740 | 87/722 | 20/742 | 19/745 |
| Callback elapsed total (ms) | 4217.114 | 4218.309 | 4201.763 | 4362.395 |
| Style elapsed total (ms) | 1650.511 | 3278.094 | 1660.155 | 1686.417 |
| Layer elapsed total (ms) | 2044.080 | 2043.032 | 2126.404 | 2119.352 |

- CSS Typed OM replaces only the orbit matrix writer in the served response,
  retaining six-decimal coefficients, visibility and alpha. Style time roughly
  doubles in this trial. The exact original/replaced HTTP bodies are retained;
  an earlier guard failure caused by Vite import rewriting remains unqualified.
- Retained eye/screen scratch storage produces 990,257 exactly matching segments
  and passes 70 focused tests, but does not meaningfully reduce callback time.
  Its complete five-file patch is saved with the capture and reverted.
- `overflow: clip` on the scene and viewport preserves clipping without making
  those elements scroll containers. This browser-only trial does not reduce
  layout or stalls; the sidebar's scrolling was unchanged.

Each trial passes 24 DPR 1/2 comparisons with exact camera, geometry, label and
retained-node state and at most 1/255 full-frame differences. Native Saturn orbit
hover/click retains circle growth, immediate selection and one landed camera.
These checks qualify the comparisons, not adoption of the rejected approaches.

Synchronized recorder JSON, Chrome trace gzip, video and source/response receipts
are retained in `output/world-context-zoom/`:

| Capture | Recorder ID | Observed/encoded frames | Clock drift | Maximum PTS error |
| --- | --- | ---: | ---: | ---: |
| `typed-orbit-publication-trial-dpr2` | `34160e8a-142a-4b28-abff-cce466b39a73` | 2912/2912 | +38 µs | 1.469 ms |
| `projection-workspace-dpr2` | `9ba58227-93ed-4680-932b-e0527ecb5107` | 2934/2934 | -55 µs | 1.467 ms |
| `scene-overflow-clip-trial-dpr2` | `5a18dd88-0ee7-42b7-82b5-fa23cb5b251b` | 2911/2911 | +91 µs | 1.388 ms |

All three retain world/input/document identity and one camera, with no errors,
HMR during recording or trace loss. They are based on `7ea823da4`; recorded
source hashes and patches are rechecked after capture. No trial implementation
is included in product code.

## Interaction events own hover and focus state

World publication polled each retained body's group, label, marker and indicator
hover attributes, plus the document's active element, on every camera sample.
The existing `objecthoverchange`, `focusin` and `focusout` events now invalidate
that state. The next publication reads the active element once and refreshes
body interaction state; later camera-only publications reuse it. Hover emphasis
and keyboard focus remain separate, so focusing one body while hovering another
preserves both behaviors. Retired bodies also receive interaction changes before
re-entry. No geometry, DOM capacity, visual policy or CSS variables change.

The regression checks zero interaction readbacks across camera-only updates,
interaction consumption before the scheduled annotation callback, coalesced
events, retirement/re-entry, blur and destruction. All 68 focused renderer tests,
renderer typecheck and build pass. The 24 DPR 1/2 comparisons preserve exact
camera, orbit styles, labels and nodes with differences at most 1/255. Native
input keeps Mars keyboard-focused while Saturn's orbit shows a pointer and grows
its circle from 16 to 20 px; clicking immediately selects Saturn and lands with
one camera. Evidence is in `output/playwright/interaction-state-owner/`.

| Measurement | Overview-owner reference | Interaction event ownership |
| --- | ---: | ---: |
| Whole-route intervals >25 ms | 19/3469 | 18/3477 |
| Planetary-band intervals >25 ms | 17/740 | 15/750 |
| Planetary-band callback elapsed total | 4217.114 ms | 3858.749 ms |
| Planetary-band style elapsed total | 1650.511 ms | 1677.455 ms |
| Planetary-band layer elapsed total | 2044.080 ms | 2117.891 ms |
| Galaxy-drag intervals >25 ms | 0/243 | 1/242 |
| Whole-route maximum | 50 ms | 33.4 ms |

The readback removal is verified; the roughly 8.5% lower callback total is one
capture per version, not a statistical frame-rate claim. Browser style/layer
cost persists and **the overall smoothness target remains unmet**.

`output/world-context-zoom/interaction-state-owner-dpr2/` records
`fa2da987-07fe-476a-9c77-9055220a1eb6`, base `7ea823da4` plus the exact two-file
source patch. All 26 source hashes and that patch match after capture. It includes
synchronized recorder JSON, trace gzip, video and loaded-resource receipts, with
2932/2932 frames, +19 µs clock drift and 1.450 ms maximum PTS error. There are no
errors, HMR or trace loss; world/input/document identity and one camera remain.
