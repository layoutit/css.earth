# Prepared page and navigation ownership

Object pages and navigation fragments come from `ObjectPage.astro` and the same
shared shell components. `OBJECTS` supplies all static route identities; `/` is
an Earth alias. Object packages declare their authored stylesheet order in
`object.json` → `properties.page.stylesheets`. Astro emits only that package's
CSS, followed by the shared planet shell CSS. The offline presentation compiler
consumes the same list. There is no page-source regex or second object registry.

Preparation writes `prepared/page.json` from the finalized scene definition.
Its descriptor pin validates the small metadata file and its `sceneSha256`
binds controls/preloads to the full scene transport. A first-load page also
decodes the authenticated scene during the build and serializes its prepared
tree into the existing `.planet-stage`. Navigation fragments use the small page
metadata without including another scene. The `/objects/<id>/<sha256>.json` endpoint still
verifies the complete transport's hash independently. Changing prepared scenes
must update both outputs through `writeObjectJson`.

Navigation fetches `/navigation/<id>/`: the same panels, attribution, metadata
and styles, without a repeated object catalog. The existing shell, card selection
ownership, stylesheet nodes and world camera stay retained.

## One scene before and after JavaScript

`serialize-prepared-scene.mts` publishes the package's prepared reference pose,
initial variant and texture addresses. It does not generate another mesh or
process source images. The page remains the same shell at the same URL.
Information tabs use native radio selection, including body overview, prepared
focus and dataset credit cards. Their labels use the existing shared tab styles;
CSS selects the panels. The mobile information sheet uses a checkbox, and
ordinary object/source links remain links. Prepared surface previews use native
lazy image loading. JavaScript observes selection where a map or dataset context
needs it; it does not install the information tabs' click or arrow-key behavior.

The interactive renderer verifies the prepared object revision, node identities,
tags, parents and sibling order, then takes ownership of those exact elements.
Its normal camera, material and animation publishers update that tree. An early
startup failure restores the original attributes and children on the same
elements. No second scene is kept as a fallback. Successful startup releases the
initial attribute snapshot; subsequent navigation uses the existing lifecycle.

JavaScript still provides camera input, animation, search and category filtering,
dataset switching and world navigation. Dataset buttons remain disabled until their owner is ready.
The HTML reference pose does not restore a saved camera URL or publish the
surrounding interactive world. This change adds prepared HTML to the first page;
it does not claim a smaller JavaScript bundle.

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
node --test site/test/object-page-data.test.mts
node --test tools/serialize-prepared-scene.test.mts
node site/test/progressive-enhancement-browser.mts http://127.0.0.1:4210
```

Worker reuse, cancellation and disposal are covered by
[prepared-object-worker-client.test.ts](../src/renderers/css/prepared-object-worker-client.test.ts)
in the renderer suite. Browser checks should hold a destination's actual scene
request and verify an immediate complete card, one scene swap, retained camera
and correct interruption behavior.

The progressive enhancement browser check disables JavaScript at desktop and
phone widths, exercises native controls and links, then holds and releases
scripts on one page to verify retained element identity, unchanged tab styles,
selection-dependent dataset context and exactly one scene.
It also aborts the object transport to check that the base scene stays usable.

The [continuous Saturn capture](../site/test/evidence/progressive-enhancement.mp4) shows
this change at 1280×900: application scripts are held for the first ten seconds,
while the existing information tabs work by click and keyboard. Script startup
then adds camera input and dataset switching to those same 972 scene elements.
The capture's assertions verify element identity and exactly one detailed scene.
It illustrates this implementation; it is not a matched camera-pose comparison.

![Factsheet selected while application scripts are held](images/progressive-enhancement.png)

The [404-object migration and matched captures](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/page-navigation-transport.md#synchronized-natural-navigation-comparison)
retain their measurements, source pins, failures and later integration scope.
