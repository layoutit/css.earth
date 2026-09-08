# Remaining performance architecture

Analysis baseline: PR #27, `9409c013`, 8 September 2026. The static performance
server serves the runtime from `4fa34b72`; subsequent commits changed harnesses
and qualification. This investigation changes no application code, prepared
bank, appearance, camera behavior, or running server. PR #27 is the single
integration PR. The operator owns the merge.

## Decision

The next architectural target is the **prepared surface's compositing plan**.
Retaining DOM and preparing textures do not prevent Chrome from doing expensive
3D ordering on every moving frame. Worker offloading cannot directly remove that
browser-owned work.

The candidate is to compile a static surface into spatially separated,
independently projected CSS 3D groups, with their inter-group order described by
a prepared partition tree. This is a feasibility proposal, **not a qualified
speedup or an approved replacement renderer**. Naive partitioning increases leaf
count enough that it could make the app slower. Integration requires proof of
both complete browser cost and visual correctness.

PolyCSS remains the rendering architecture: one object scene, one camera owner,
retained HTML/CSS leaves, source-backed geometry, canonical prepared assets, and
one generic adapter. Camera motion stays continuous; selection updates the
complete sidebar immediately. Runtime must not generate geometry, textures,
visibility maps, or atlases. No canvas, WebGL, SVG scene rendering, CSS masks,
clip-path, filters, gradients, or blend modes enter this work.

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

## Candidate: prepare the depth partition, retain the camera

An optional static-surface contract would be compiled from actual transform,
material, and coverage ownership. Eligibility must not be a planet-name list
or a second object registry.

1. **Partition coverage offline.** Choose spatial planes independently of
   existing face planes. Split crossing surface pieces during preparation,
   preserve source-face and texture-coordinate provenance, and emit final
   PolyCSS leaves/assets. Assigning a crossing triangle to its centroid's side
   is incorrect.
2. **Record a bounded tree and leaf groups.** Emit immutable DOM ranges,
   projection bindings, partition planes, and child ranges. Check coverage,
   material ownership, bounds, generated-byte closure, and reproducibility.
   Existing 64-leaf activation batches are not depth partitions.
3. **Publish one camera to retained groups.** These are presentation children
   of the existing object, not independent scenes/controllers. They share its
   physical projection and object transform. Runtime classifies the observer
   against prepared planes and traverses the tree to publish group paint order;
   it neither sorts source faces nor splits polygons. Order writes occur only
   when the ordering changes.
4. **Limit Chrome's sorting to each group.** Independent flattened group
   outputs receive the prepared back-to-front order; the existing CSS 3D backend
   handles local ordering. Another `preserve-3d` wrapper does not establish this
   boundary. Setting the existing scene to `flat` breaks projection. Neither is
   a valid shortcut.

Correct perspective composition, source-over coverage, and inter-group ordering
must be proved. Animated transforms crossing partitions, transparent shells,
rings, dataset changes, and grazing edges require explicit ownership. Unsupported
bundles keep their existing representation. No surface simplification, texture
density reduction, view-angle snapping, or removal of textures during motion is
part of this proposal.

## Offline feasibility and its warning

A temporary calculation consumed Deimos's checked-in prepared
`surfaceTriangles`, split polygons at spatial planes, and conserved each source
triangle's area to relative error below `3 × 10⁻¹⁵`. No emitted vertex escaped
its group's ancestor half-spaces. It generated no application assets.

| Illustrative group budget | Groups | Triangles after splitting | Increase |
| --- | ---: | ---: | ---: |
| Original surface | 1 | 1,216 | — |
| 256 | 9 | 1,824 | 50% |
| 128 | 26 | 2,330 | 92% |
| 64 | 65 | 3,160 | 160% |

These are geometry results, not DOM, raster, timing, or image-equivalence proof.
Smaller sorting groups can increase leaves, texture seams, style work, and memory.
There is no justified universal group size. Mars and Haumea do not expose this
same prepared triangle field; the probe reports them unsupported rather than
fabricating geometry or claiming coverage.

## Implementation order and acceptance

Keep all work in PR #27. The first implementation slice is an isolated,
**preparation-only prototype on an actual failing surface**, using the existing
PolyCSS leaf backend. Demonstrate independent projection/order before extending
the generic runtime contract.

1. Capture the unchanged surface twice on the same browser/build/viewport to
   establish visual noise and timing variability. Use the same saved camera and
   native drag/zoom inputs for the candidate. Do not overlap recording with
   builds, trace analysis, or another agent-owned browser run.
2. Compare identical camera poses at DPR 1 and 2: partition crossings, grazing
   edges, off-axis views, closest supported zoom, and affected datasets. Use
   numbered frames with matching prepared-byte and pose provenance, and inspect
   worst differences. A 25 FPS recording is not 60 Hz frame proof.
3. Measure the full path: main work, style/layout, paint/raster, compositor
   drawing, and frame outcomes/freshness. A shorter callback, fewer quads, or
   fewer dropped-only groups alone does not prove success. Account for partial
   presentation and distinguish unchanged frames from drops.
4. Reject seams, wrong depth, delayed input, camera jumps, texture changes,
   significant memory growth, or a stall transferred to another stage. Reject
   timing differences within baseline variability.
5. Only then add minimal generic prepared transport and the retained publisher,
   and exercise another eligible geometry family. Re-run the agreed Mars →
   Venus → overview → Makemake journey and focused interrupted/replacement
   flights, preserving sidebar and interaction behavior.

If independent sorting contexts cannot preserve projection, or extra fragments
cost more than they save, stop this design. Do not weaken PolyCSS or visual
quality to make a benchmark pass. A remaining browser/compositing limitation
would need explicit treatment, not another speculative scheduling rewrite.

## Evidence and scope

Local diagnostic evidence lives in `output/architecture-analysis/`:

- `native-close/native-profile-environment.json`, `native-close/gpu-native.sample.txt`,
  and `native-close/native-profile-report.json`: owned process identity,
  hardware backend, valid camera precondition, native stacks, and completion.
- `chromium-sources.json`: matching-version source URLs/hashes.
- `published-assets.json`: deployed css.graphics bundle URLs/hashes.
- `partition-feasibility*.json`: results explicitly marked
  `GEOMETRIC_FEASIBILITY_ONLY_NOT_RENDERED_OR_PERFORMANCE_QUALIFIED`.

The earlier native profile at the evidence root did not enforce a close-body
camera precondition and is excluded from close-surface attribution. Previous
strip/flatten/reorder probes are not product changes or qualified wins. The
corrected strip probe's draw p95 was 31.858 ms versus an earlier 24.676 ms probe;
these are unmatched diagnostics, not a controlled regression estimate.

No runtime experiment from this investigation enters the PR. Source/preparation
gate failures in flight qualification remain unresolved. This analysis does not
make the PR merge-ready.
