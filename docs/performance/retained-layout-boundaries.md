# Retained layout boundaries

This pass follows the September 10 `Trace-20260910T084204` capture. Its first
style scheduling stack points at the detail camera transform, but that does
not attribute the subsequent style pass to that setter alone.

## Ownership audit

- Prepared geometry, imagery and source photometry remain prepared inputs.
  The persistent world worker projects those inputs; it does not generate
  geometry or scene assets. Its prepared bank is sent once.
- One world queue admits one in-flight plan and one replaceable pending view.
  Camera, annotations and picking consume the same accepted frame. A stale
  selection cannot publish over the current owner.
- The mount-owned opacity clock commits camera work before flushing numeric
  fades. Fade-only ticks do not request new projections. There are no CSS or
  WAAPI opacity animations on the world annotations or point field.
- The detail camera already suppresses identical transform writes. Projected
  stars and orbit segments likewise retain published transform values.
  Moving projected leaves still legitimately require browser style updates;
  this architecture does not promise zero style recalculation.
- The Surface Lens reader caches the body axes and sleeps while collapsed.
  The fixed readout and space minimap have separate publication paths; their
  costs must be measured rather than charged to the first camera setter.

Chromium's [incremental inline-style path](https://chromium.googlesource.com/chromium/src/%2B/fa9a4151f74ceb3a2e708c3b07de4307f9ba4bd5/third_party/blink/renderer/core/css/resolver/style_resolver.cc)
can reuse computed style for eligible direct property updates. This is not
equivalent to skipping style, paint or layer work. cssGraphics' Galaxy adapter
similarly publishes prepared transforms directly to retained leaf styles;
its prerecorded transforms are not a substitute for cssEarth's free camera.

## Changed allocation boundary

Orbit pools retain every prepared slot, but the first 64 slots are now grouped
as 8, 8, 16 and 32. Subsequent groups stay at 64. Dense star pools retain their
existing policy. This is a subdivision of the original layout groups, so any
visible membership can activate no more leaf layout objects than before.
Leaf identity, parentage and capacity stay fixed after mounting.

This avoids admitting 64 layout objects when an orbit only draws a few chords.
It adds three dormant grouping elements per full orbit pool; it neither adds
render leaves nor lowers the geometry budget. Reducing capacity to the prepared
positive trail count would be incorrect: hover and satellites require the full
orbit, including its normally zero-weight chords.

The pool still publishes only final block membership once per view. No idle
timer, grace period, camera-dependent allocation or runtime DOM growth was added.

## Evidence and rejected experiments

The matched overview and hover images have zero changed pixels. All 649 drawn
segments, weights, colors, thicknesses, label bounds and opacities match exactly.
Orbit layout leaves fall from 1,088 to 792; 97,200 retained leaves are unchanged.
World DOM grows from 101,255 to 102,470 due to the smaller grouping elements.
Drawn layer counts and reported layer areas are identical in both views.

Four interleaved native-wheel runs did not establish a frame-time improvement:
before main task time was 4.862/4.970 seconds, after 4.945/5.021 seconds. Callback
counts differ, so these are not equal-frame CPU comparisons. The demonstrated
result is less dormant layout participation, not a claimed frame-rate gain.

Separate probes of minimap `visibility` residency, layout containment, leaf
containment, and star layer promotion did not establish a useful improvement.
They were not shipped. The candidate does not add clipping, layers, SVG or change
any visible policy to make performance numbers look better.

Local evidence is under `output/playwright/style-boundaries/` and
`output/performance/style-architecture/`. Matched short invalidation captures are
under `output/playwright/navigation-consistency/style-boundaries-*-v2/`; each
contains recorder metadata, the Chrome gzip trace, video, DOM snapshots and
served-file hashes. Only captures with `synchronization.json.valid: true` qualify.
The earlier long diagnostic capture overflowed Chrome's buffer and is not valid
performance evidence. Its partial node stacks were used only to locate work.

Remaining browser cost includes per-visible-leaf transforms/alpha, style,
prepaint and layer construction. The next manual trace must judge smoothness.

## Qualification

- Renderer type check and all 449 renderer tests pass.
- 93 focused scene/package/router/marker and trace-tool checks pass.
- Native Sun → Mars → Earth → Sun navigation, drag, 5,000 pc zoom-out and return
  complete without page errors; world/input/document identities remain retained
  and checkpoints have exactly one mounted camera.
- Orbit picking, hover expansion, click navigation and browser history pass at
  DPR 1 and 2. Showing dormant slots for the comparison changes zero pixels;
  all 101,296 pooled orbit/star leaves keep their original parents afterward.
- The final short before/after captures have valid synchronization, complete
  traces and no errors. Clock drift is 34/10 microseconds respectively.
  The diagnostic p95 presentation intervals are 71.640/68.065 ms; these include
  expensive invalidation tracking and must not be called product frame rates.

The frozen baseline is served at port 4245. The performance build under `dist`
is served at port 4246, with its file hashes in the candidate capture report.
This is the same branch lineage as the user's September 10 trace, not a claim
that newer main changes have been integrated.
