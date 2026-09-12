# World-context delta publication

The manual 10:07:29 trace no longer contains the previous 127 ms opacity
callback, but its busiest presentation interval still includes 42.253 ms of
style work and 23.016 ms of JavaScript. World-context publication and orbit
writes appear in its sampled stacks. These timings do not prove that every
style invalidation is redundant.

## Change

The persistent world worker now sends changed annotation fields and changed
orbit slots against the last acknowledged presentation. Orbit slots use
transferable index/Float64 columns and retain their exact transform strings.
The worker copies its baseline from the planner's borrowed arrays. Receiving a
message does not acknowledge it: only the presentation owner advances the
committed identity. A discarded plan or locally changed orbit cutout forces a
full repair packet.

The receiver retains unchanged body and segment state. The DOM publisher
updates only the affected marker, indicator, label or orbit channel. Unchanged
orbits bypass the segment writer; changed slots keep the existing prepared
leaf pool, including its shrink/re-entry rules. Picking, label exclusions and
sprite residency retain their state between geometric changes. Selection,
hover, navigation, font measurements and image readiness still invalidate
presentation policy, independently of camera geometry. Depth ranks continue to
follow the same camera order.

No geometry, style rules, dimensions, color, opacity curve, content or input
policy was changed. Existing projection is still required when the observer
moves; this repair does not claim to remove that work or its browser cost.

## Verification

- Renderer typecheck and 456 renderer tests passed. After the final publication
  loop refinement, the 90 affected context tests and typecheck passed again.
- Transport tests reconstruct full projections exactly across zoom, hover,
  culling, anchor-only retirement and re-entry; a discarded response repairs
  from a full baseline. A one-chord edit sends one slot.
- An unchanged packet contains zero body updates. Replaying a settled view
  causes zero style writes in the instrumented retained renderer.
- Full-frame and delta publication match through selection, hover, flight,
  orbit hiding, timed fades and a screen-picking grid.
- Headless overview and hovered-Mars captures at 1995 x 1236 have zero differing
  pixels. All 649 visible orbit segments, annotation styles, DOM counts and
  drawn layer areas match the previous served build.
- Native Sun -> Mars -> Earth -> Sun navigation, drag, galaxy zoom-out and
  return completed without page errors, retaining the world, input surface and
  document, with one detailed camera at each checkpoint.

Artifacts and the before/after builds are in
`output/playwright/context-delta-publication/`. Correctness checks do not establish
a performance improvement. Focused agent traces now precede any request for
another manual trace; internal captures omit video by default.

## Controlled capture follow-up, September 10

The 10:39 manual recording did not establish a gain over 10:07: their gestures
differ, and p95 remained 50.041 ms. Its 104.981 ms style pass cannot be attributed
wholly to the first scheduling setter.

Headless Canary comparisons used matching saved URLs, 1995 x 1236 viewports,
DPR 2, fresh browser contexts, 32-step outward/return drags and 18 wheel packets
per direction. Each capture retains recorder clock anchors and served-code
hashes. No screencasting or video encoding ran. The baseline is the saved
pre-delta build, including the earlier opacity fix.

| Saved view | Before p95 | Delta p95 | Before p99 | Delta p99 |
| --- | ---: | ---: | ---: | ---: |
| Overview fixture | 39.588 ms | 41.078 ms | 47.831 ms | 48.227 ms |
| URL recovered from the 10:39 trace | 30.264 ms | 30.208 ms | 42.815 ms | 35.463 ms |

These pairs do not establish a repeatable frame-time improvement. Input delivery
and accepted-frame counts can still vary; the headless captures also did not
reproduce the manual recording's 105 ms style pass. Do not present them as proof
that the manual hitch is fixed.

A separate, complete 180 ms wheel diagnostic joined invalidation node IDs to
before/after DOM snapshots. It observed 3,333 orbit invalidation events across
663 nodes, 1,769 minimap events across 248 nodes, 1,525 billboard events across
265 nodes, and five detailed-scene events on one node. These are event counts,
not apportioned milliseconds. The earlier full-gesture invalidation capture
overflowed Chrome's buffer and is invalid.

A diagnostic CSS override making scene markers and labels inert to native hit
testing did not help: p95 was 31.800 ms versus 30.208 ms for the unchanged delta
build in that view. It was not applied to product source or the served app.

Capture and report directories use `delta-ab-*` and `manual-view-*` under
`output/playwright/navigation-consistency/` and
`output/performance/trace-briefs/`. The remaining target is demonstrated browser
work reduction during moving frames, not only fewer unchanged-state operations.

## Comparison charts

The rolling average now excludes only evidence-backed idle intervals: Chrome
explicitly stopped requesting frames, there was no active main callback/input,
main work was minimal, and the pipeline reported no update desired without
reported drops or smoothness impact. The old 446.576 ms tail gap qualifies;
the new trace's 124.018 ms gap does not. Raw measurements and dropped-frame
counts remain intact. The chart and portable series list every exclusion.
