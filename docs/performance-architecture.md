# Prepared surface depth partitions

PR #27 remains the single integration PR; the operator owns the merge.
The implementation preserves PolyCSS, one object scene, one camera and input
owner, retained leaves, canonical texture density, and immediate full sidebar
selection. It adds no canvas, WebGL, SVG scene rendering, runtime geometry,
texture generation, masks, filters, gradients or blend modes.

## Implemented boundary

A retained CSS mesh can still make Chrome perform expensive 3D ordering on every
camera frame. Preparation now compiles eligible static surfaces into independent
paint-contained projection groups. Runtime publishes the existing scene transform
and visits a prepared plane tree to order those groups. Chrome handles depth
inside each smaller group. No source-face sorting or style discovery runs in a
frame; unchanged group ranks produce no style writes.

The compiler uses planes through existing source edges. A triangle crossing a
plane rejects that split. It does not cut triangles, rebake textures, approximate
coverage, or reduce detail. Current eligible packages are Deimos, Phobos and
Phoebe: each retains its 1,216 original leaves in 32 groups of 38. Eligibility
comes from source geometry and binding ownership, with no object-id dispatch.
Other packages retain their existing representation. This does not yet improve
Haumea or the other surface families lacking this qualified source contract.

The original reference branch remains attached for the shared camera and surface
hit-test owner. Static ancestor carriers receive the same selection writes and
published scene transform. Facing, material references and activation groups are
remapped during preparation. There is still exactly one `.polycss-camera` and
one `.polycss-scene`; carriers are presentation children, not extra controllers
or independently mounted objects.

Preparation rejects unclosed/layered surfaces, unsupported transforms, local
frame-owned properties and motion, or a source triangle that does not match its
render leaf. It compares the complete computed CSS cascade before and after
compilation for every dataset and geometry/billboard/marker LOD. Unsupported
cases keep native depth. The typed runtime validator bounds group count and tree
depth and requires independent carriers and exact unique order coverage.

The checked runtime JSON remains exactly equal to the final transported data.
Before recompilation, preparation recovers the original branch by removing only
generated carriers and their copied selection bindings, then resolves fresh CSS.
This is a preparation operation; no restoration machinery ships in the browser.
Round-trip and repeated-preparation checks preserve source closure without a
second stored source tree. Original texture and atlas bytes are unchanged. Exact restoration was
also compared against the pre-change checked runtime for all three real packages.
The tradeoff is 128 additional retained carrier/ancestor nodes per eligible body
and 34 activation groups versus 20 previously. Camera movement does not wait for
those detail batches.

## Matched browser result

Baseline: immutable production-shaped build from `4fa34b72`, cloned before the
implementation. Candidate: the prepared depth implementation on top of
`827db935`, identified by the actual response hashes below. Canary
155.0.8043.0, Apple M3 Max / ANGLE Metal, headless, 1995 × 1236 CSS pixels.
Each pair uses the same close surface, camera input path and DPR. Recordings ran
sequentially without builds or another agent-owned browser recording.

| Surface / DPR | Draw pass p95 before → after, ms | Dropped-only sequences before → after |
| --- | ---: | ---: |
| Deimos / 1 | 27.992 → 5.295 | 138/326 → 2/184 |
| Deimos / 2 | 23.701 → 4.537 | 100/287 → 1/185 |
| Phobos / 1 | 29.599 → 4.099 | 152/340 → 0/182 |
| Phobos / 2 | 29.964 → 4.088 | 154/341 → 0/181 |
| Phoebe / 1 | 19.289 → 3.912 | 36/222 → 0/182 |
| Phoebe / 2 | 18.768 → 4.585 | 29/217 → 0/181 |

Draw means `DirectRenderer::DrawRenderPass` events with more than 200 quads.
Dropped-only means every PipelineReporter report for a source/sequence pair is
`STATE_DROPPED`. Mixed reports are not counted as clean full-frame delivery.
They fall from 166–186 per baseline run to 0–1 per candidate run. These metrics
are browser observations, not physical FPS or input-to-photon latency.

The harness sends 180 native moves on a nominal three-second schedule. Awaited
input backpressure stretches baseline runs to 3.61–5.68 seconds; candidates take
3.02–3.08 seconds. Counts therefore cover different elapsed intervals. They must
not be presented as an equal-duration frame-rate benchmark.

Other browser stages do not show a transferred large stall: candidate animation
callback p95 is 1.98–2.53 ms versus baseline 2.37–2.62 ms; style update p95 is
1.26–1.49 ms versus 1.28–1.48 ms. Layout, prepaint and paint p95 remain below one
millisecond. Individual main tasks still reach 37.7 ms in Deimos, and its runs
still contain dropped-only sequences. This is a substantial qualified reduction
in one bottleneck, not a claim that the whole application is perfectly smooth.

A separate detailed memory-dump probe used fresh Canary processes in baseline →
candidate → candidate → baseline order, the same Deimos view, DPR 2 and native
drag. The largest renderer's resident set was 964–982 MiB before and 991–996 MiB
after. The GPU process's reported `gpu` allocator was 572–626 MiB before and
532 MiB in both candidate runs. These are process/allocator observations with
shared memory and cache variability, not an additive physical-memory total or
a leak test. They show modest renderer overhead without the feared growth in
GPU allocation for this view. Dumps and process identities are retained under
`output/depth-prototype/memory-*`.

## Appearance and behavior

Paired captures cover close geometry, native orbit drag, another dataset,
marker LOD, return to geometry and resize for all three surfaces at DPR 1 and 2:
36 matched views. Both builds reload the exact same serialized camera and select
the same dataset explicitly. Camera state is deeply equal. Captures retain one
scene, all projected carriers share the camera, and the texture selection is
nonempty and correct. Separate native drag traces verify stable node identities.

Pixel equality is **not exact**. DPR 1 baseline repeats are identical; DPR 2
repeats already differ at thin surface edges (worst mean absolute channel delta
0.008401/255). Candidate versus baseline worst mean is 0.027226/255 at DPR 1 and
0.025481/255 at DPR 2. Worst-frame changed pixel fractions are 0.8626% and 0.7828%.
Full frames and enlarged edge crops were inspected: differences follow thin
surface/silhouette raster boundaries, without missing regions or broad texture
changes. These are observed rendering differences, not a zero-diff pass or a
threshold raised to declare equivalence. Source geometry and asset equality are
separate exact checks.

## Evidence that changes the priority

The short journey—wide system → Mars → Venus → overview → Makemake—completes
with retained world/input/document identity. Its apparent 117 ms Venus gap
includes six `STATE_NO_UPDATE_DESIRED` frames and is not evidence of a stall.
Mixed partial/complete presentations also prevent a blanket smoothness claim.
See [flight qualification](flight-qualification.md).

The broader recording contains a different failure. Deimos action 26 has 211
dropped-only sequences among 474 reported sequences; Haumea action 253 has 84
among 249. “Dropped-only” means every report for a `(frame_source,
frame_sequence)` group says `STATE_DROPPED`, not a gap inferred from complete
presentation endpoints. These recordings precede the replacement-flight fix and
are not controlled before/after comparisons.

An isolated Deimos probe records `DirectRenderer::DrawRenderPass` p95 24.676 ms
for passes with more than 200 quads during its short wheel phase. That is one
browser stage's elapsed duration, not JavaScript time, GPU execution time, or
physical FPS. Compositor drawing can exceed a frame budget while application
frame tasks remain short.

A new read-only native profile on the unchanged application records:

- Chrome Canary `155.0.8043.0`, headless, 1995 × 1236 CSS pixels, DPR 1.
- Hardware acceleration: Apple M3 Max, ANGLE Metal, `GraphiteDawnMetal`, with
  GPU compositing and rasterization enabled.
- A close Deimos geometry presentation, checked before input with silhouette
  radius above 300 CSS pixels. The native drag ends ready with one scene and no
  recorded application errors.
- On `VizCompositorThread`, 997 of 2,316 sampled stacks include a deeply
  recursive branch at `ChromeMain + 173246588`, with repeated child frames at
  `ChromeMain + 173247232`. These are inclusive samples, not additive durations.
  Internal symbols are stripped: the profile does **not** independently identify
  that branch as BSP construction.

The matching Chromium version supplies the mechanism worth investigating.
[`DirectRenderer`](https://chromium.googlesource.com/chromium/src/+/155.0.8043.0/components/viz/service/display/direct_renderer.cc)
creates polygons from transformed `quad.visible_rect` rectangles inside a 3D
sorting context, then constructs a `BspTree` for the group.
[`BspTree::BuildTree`](https://chromium.googlesource.com/chromium/src/+/155.0.8043.0/components/viz/service/display/bsp_tree.cc)
uses the first polygon as splitter and recursively classifies/splits the rest.
Source, trace, and native recursion support depth ordering as a strong
hypothesis; exact native-function attribution remains open.

Reordering siblings has a structural limit. For ideal convex surface faces,
each face's supporting plane puts the other faces behind it. Choosing another
face does not balance that tree: its unsplit comparison count can remain
`N × (N − 1) / 2`. CSS rectangle bounds and concavities add complications.
Changing DOM order is therefore not a general solution.

## Lessons from published adapters

The deployed css.graphics entry and imported bundles were fetched directly on
8 September; the local checkout was not assumed to match deployment. The
deployed [Galaxy](https://css.graphics/galaxy/) bundle creates a prepared-block
worker and retains a bounded materialization window. The deployed
[Cloth](https://css.graphics/cloth/) bundle creates a prepared-playback
materializer worker. Their useful boundary is preparation/transport versus
retained publication, not simply moving additional work to workers. Bundle URLs
and SHA-256 values are recorded in the local evidence manifest.

Inspected local Mario code has prepared visibility transitions; local Quake has
source-derived potentially visible sets and retained render bundles. These are
local source observations, not verified deployment claims. Finite playback
schedules and source BSP visibility cannot be copied blindly into an arbitrary
astronomical camera. Any new visibility plan must preserve free camera movement
and retain uncertain coverage. Flowerbox is not used as production authority.

This PR already has uninterrupted app-owned flight, bounded detached tree
construction, connected activation batches, worker transport, delta publication
of star membership, suspended flight annotations, shared viewport ownership,
dormant retained blocks, and lazy surface previews. Re-implementing these under
new names is not the next optimization.

## Why the final compiler does not split faces

An early spatial-cut prototype increased Deimos from 1,216 to 3,160 triangles at
a 64-leaf target and produced visible seam risk. Another flattening experiment
reduced compositor time but transferred cost to style and used incorrect depth.
Both were rejected. The implemented compiler accepts only separating planes
that preserve every original face. The 64-leaf target guides offline splitting;
an unpartitionable region is retained intact, not silently simplified.

## Reproduction and evidence

Run a production-shaped performance build once, then keep both servers immutable
while capturing. `prepared-depth-browser.mjs` accepts `ORIGIN`, `OUTPUT`, `OBJECT`,
`DPR` and `BASELINE=1`. It records native input, trace marks, camera preconditions,
retained identities, screenshots and actual fetched response hashes.
`prepared-depth-visual-browser.mjs` accepts `ORIGIN`, `REFERENCE_ORIGIN`, `OUTPUT`
and `DPR`; it emits reference/repeat/candidate numbered frames and camera metadata.
`node site/test/analyze-depth-trace.mjs <trace.json[.gz]>` reproduces the stage and
sequence statistics from the marked drag interval.

Local evidence is under `output/depth-prototype/` and
`output/playwright/prepared-depth-visual-{1,2}-v2/`. The earlier research and
matching Chromium/deployed adapter source hashes remain under
`output/architecture-analysis/`. Large traces and images are local diagnostics,
not source inputs or committed payloads. Own older traces compressed for disk
space have original-byte SHA records in `output/depth-prototype/compression.json`.

Candidate packaged runtime bundle SHA-256:
`2544fb26c63ef6af0ef3924277b1c05f2b60deef83539541f92efb1b07e5e3fe`.
Prepared bank SHA-256 values:

- Deimos: `a41fa8c5fd91d3935afd689a1b81ca64153f33e74ca1f7341563d9b8aa5ff7ae`
- Phobos: `0dd76dfbce4bda1b20b3bdd1e739d68af2e9bc3312d375fc92806d99270b8d35`
- Phoebe: `ec4ab7d06136305562bf6370c258b8362d26f6b562db5a7bd24470cf1c99487e`

Regeneration after the preparation round-trip fix reproduced these exact served
bytes and strict checked-runtime/payload equality. Broader source input and
preparation readiness limits remain in [flight qualification](flight-qualification.md).
This change does not declare every object ready or authorize merging.


The final build also corrects transparent-corner picking for resolved context
sprites. It keeps the same prepared surface banks; its packaged runtime SHA-256
is `eb0f577251961b63e732991d511a49f55526b9f443700e867c9a6b8a8dd39b05`.
A final Deimos DPR 2 drag on those bytes records draw-pass p95 5.052 ms,
2 dropped-only sequences among 184, animation callback p95 2.484 ms, and style
update p95 1.446 ms. Its retained-node and shared-camera assertions pass. Evidence:
`output/depth-prototype/final-deimos-2/`. The table above remains the original
matched before/after matrix; this is a final-build confirmation, not a substituted
baseline pair.
