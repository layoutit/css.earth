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
Embedding the complete card bank adds to the initial HTML size.

The prepared-object decoder retains one module worker across successful jobs.
Jobs are serialized and their bytes transfer only on activation. Cancelling an
active job terminates its worker and starts the next queued job; queued
cancellation never disturbs another decode. Page disposal rejects pending jobs
and releases the worker. Failed validation never falls back to main-thread
scene decoding.

For image/DOM leases, read [prepared navigation ownership](prepared-navigation-ownership.md).
For the camera handoff and interruption behavior, read [flight lifecycle](flight-lifecycle.md).

## Checks

After building the packages and renderer, check page metadata with:

```sh
node --test site/test/object-page-data.test.mjs
```

Worker reuse, cancellation and disposal are covered by
[prepared-object-worker-client.test.ts](../src/renderers/css/prepared-object-worker-client.test.ts)
in the renderer suite. Browser checks should hold a destination's actual scene
request and verify an immediate complete card, one scene swap, retained camera
and correct interruption behavior.

The [404-object migration and matched captures](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/page-navigation-transport.md#synchronized-natural-navigation-comparison)
retain their measurements, source pins, failures and later integration scope.
