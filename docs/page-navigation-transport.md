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
