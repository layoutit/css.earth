# Prepared page and navigation ownership

Object pages and navigation fragments come from `ObjectPage.astro` and the same
shared shell components. `OBJECTS` supplies all static route identities; `/` is
an Earth alias. Object packages declare their authored stylesheet order in
`object.json` → `properties.page.stylesheets`. Astro emits only that package's
CSS, followed by the shared planet shell CSS. The offline presentation compiler
consumes the same list. There is no page-source regex or second object registry.

Preparation writes `prepared/page.json` from the finalized scene definition.
Its descriptor pin validates the small metadata file and its `sceneSha256`
binds controls/preloads to the full scene transport. Page rendering no longer
reads/parses the full scene. The `/objects/<id>/<sha256>.json` endpoint still
verifies the complete transport's hash independently. Changing prepared scenes
must update both outputs through `writeObjectJson`.

First-load pages retain the complete inert card bank so selection is synchronous
and complete, even while a destination's scene request is held. Subsequent
navigation fetches `/navigation/<id>/`: the same panels, attribution, metadata
and styles, without the bank or repeated object catalog. The existing shell,
card selection ownership, stylesheet nodes and world camera stay retained.
Initial HTML/card-bank duplication remains a separate cost; this change does
not introduce background card loading or a partial selection state.

The prepared-object decoder retains one module worker across successful jobs.
Jobs are serialized and their bytes transfer only on activation. Cancelling an
active job terminates its worker and starts the next queued job; queued
cancellation never disturbs another decode. Page disposal rejects pending jobs
and releases the worker. Failed validation never falls back to main-thread
scene decoding.

Migration qualification on the 404-object registry:

- All scene pins and ordered authored CSS bytes preserved.
- Page metadata: 1,593,524 bytes aggregate, versus 2,605,646,460 bytes of scene
  transport formerly read by page rendering. This is aggregate input, not peak memory.
- Astro static build: 810 HTML pages, plus all hash-addressed scene endpoints.
- Object metadata/package/shell checks: 19 passing. Worker lifecycle: 4 passing.
- Renderer build and typecheck pass.
- Browser selection at DPR 1 and 2: actual hash-addressed requests held,
  synchronous full Ceres card, one swap, retained card through mount, Venus
  interruption restores Ceres, one mounted scene, no page errors.
- Existing Deimos preparation test still fails its facing-count assertion
  (0 versus 1600). The three synthetic CSS compilation tests pass. This is
  not an aggregate merge-readiness claim.

## Synchronized natural-navigation comparison

The same Sun → wheel out → Mars → wheel out → Earth → wheel out → Sun
procedure was captured at baseline `af85bc0f6` and implementation `8fd4b9586`.
Both use Canary 155.0.8048.0, 1995×1236 CSS pixels, DPR 2, the normal renderer,
and motion off. Recorder JSON, Chrome trace gzip and contemporaneous variable
frame-rate video were collected together. Artifact hashes and exact input
receipts are in [the evidence record](evidence/navigation-page-transport.json).

| Measurement | Before | After |
| --- | ---: | ---: |
| Navigation HTML (decoded), four requests including automatic Sun handoffs | 31.297 MB | 0.874 MB |
| Main-thread HTML parsing during capture | 172.207 ms | 10.005 ms |
| Decoder worker module requests, including initial load | 5 | 1 |
| Presented animation-frame intervals over 25 ms | 88/1,937 | 36/1,643 |
| Presented interval p95, nearest rank | 23.558 ms | 19.043 ms |
| Worst presented interval | 905.844 ms | 545.003 ms |

This proves the redundant transport/parse work and worker churn were removed.
It does not prove that the old 889 ms GPU flush wait was caused by that work:
that wait did not recur, but GPU cache/driver conditions were not controlled.
The remaining Earth stall includes a 403 ms main-thread commit wait and 254
concurrent raster tasks. Presentation is still not consistently smooth.

The after capture has 1,210 captured/encoded frames, −22 µs clock drift and
0.611 ms maximum video timestamp error. World, input and document stay retained,
with one camera and Sun selected at completion. Both runs contain the same
missing Earth cloud-thumbnail request; they are synchronized, not error-free
application qualifications. Natural wheel inputs stop on target visibility,
so different packet counts and departure distances prevent a strict identical
input or whole-route duration speedup claim. No response or renderer patches
were used. Mars, Earth and Sun arrival frames were inspected.

Latest-main integration after the matched capture includes `2f6f8614a` (#80),
`96d930930` (#81), and the navigation-failure camera fix `0e7af35cf`. The seven
updated object transports were restored only after matching their new main
pins, then their small page metadata was regenerated. The chart above remains
explicitly tied to its captured revisions; it is not relabeled as a capture of
that subsequent integration.

The integrated static build also passes (810 pages). Metadata/package checks
pass for all 404 objects. Router/preparation checks report 40 passes and one
blocked source-reproduction check: Squannit's
`source/presentation/context.png` is missing locally. No source bytes were
fabricated and that check was not weakened or declared passing.
