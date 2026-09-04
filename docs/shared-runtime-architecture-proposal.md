# Shared runtime architecture before catalog expansion

Status: All five shared-runtime workstreams are implemented. The separately
authorized Earth affine-texture repair is implemented. Source verification,
598 tests, build, and the complete headless browser suite pass. Strict matched
visual acceptance remains unresolved. The inspected
`earth-8x` scalar workaround was withdrawn; its other WIP is excluded.
The PR remains a draft, not ready to merge. See the
[implementation and evidence record](shared-runtime-implementation.md).

Date: 2026-09-04

Delivery: One new architectural PR, with reviewable commits. This is the full
proposal, superseding the playback-only outline. The user approved implementation
and opening the PR on 2026-09-04. Merging remains a separate decision.

## 1. Outcome

Unify the runtime architecture before adding many more objects. New objects
should supply their prepared content and rendering behavior, not copy lifecycle,
playback-policy, image-request, or control-race machinery from a neighboring
object. Existing objects must migrate to that same foundation in this PR.

The PR includes five connected workstreams:

1. One authority for automatic playback and shared status.
2. A common mount lifetime, cancellation, and failure boundary.
3. Reusable prepared-image loading with explicit cache ownership.
4. Shared speed binding and latest-request-wins control transactions.
5. Optional object controls, content-derived conformance, and a documented
   authoring path for the next object.

Unify coordination, not every rendering technique. Different prepared materials
and cache policies are valid object behavior; competing lifecycle or playback
authorities are not. Passing the playback fix alone does not complete this PR.

### Decisions that stay fixed

- One `OBJECTS` registry, one generic adapter, one shell, one mounted scene,
  and one camera per scene. Classification remains a reporting filter.
- One canonical highest-density prepared asset bank, selected once per mount
  independently of display scaling. No bank switching or runtime quality modes.
- Object-owned geometry, materials, scientific content, prepared inventories,
  camera plans, and retained rendering. Preserve stable DOM and existing bounded
  on-demand mount exceptions.
- Existing camera input, inertia, fly-to, zoom limits, and responsive policy.
- Existing animation mechanisms. **No new clock or time source.** Saturn's
  clock wrapper already drives native browser animations without a per-frame
  timer. Sharing playback decisions does not require replacing that wrapper.
- No runtime source derivation, geometry generation, rasterization, canvas,
  WebGL, scene SVG, masks, filters, gradients, blend modes, or `clip-path`.
- No new dependency, event bus, base class, universal renderer, feature-plugin
  system, global cache, or second application state store.

## 2. Evidence and design basis

Source inspection used merged objects-contract tree
`4ba3c3c526abdfcf6c26def7fd635451f2d08eea`. Inspected worktree HEAD
`78bc4d7e779ece382873d3bd957773684f497963` has the same tracked tree. Reconcile
this design with then-current main before implementation; concurrent work in
the main checkout is outside this document's evidence baseline.

Three subagents independently examined lifecycle/playback, assets, and controls.
Findings below are source-backed unless identified as a previous browser
observation. This proposal-writing pass did not run browser acceptance gates.

| Evidence | Design consequence |
| --- | --- |
| [Router](../site/scene-router.mjs), lines 187–194, omits readiness/reduced motion from playback. [Saturn](../src/planets/saturn/runtime/client.mjs), lines 266–269, independently resumes when reduced motion clears. | One playback authority, not coordinated copies. |
| Moon/Pluto's 425-line clients match after substituting names. | Extract their repeated coordination; do not turn their sphere renderer into a universal renderer. |
| [Router](../site/scene-router.mjs), lines 69 and 81–94, can lose a malformed mount's cleanup handle or interrupt cleanup if a destructor throws. | Retain raw handles before validation and complete failure cleanup. These are source-derived failure paths, not reproduced browser incidents. |
| [Uranus](../src/planets/uranus/runtime/client.mjs), lines 189–198, retains a rejected static-image promise. | Define retry semantics once. |
| [Earth's row cache](../src/planets/earth/runtime/preparedRowCache.mjs) protects applied rows and bounds its pool; Saturn and other clients release inactive material/lens groups. | Preserve specialized residency rather than retaining every decoded image until unmount. |
| [Saturn](../src/planets/saturn/runtime/client.mjs), lines 430–466 and 515–522, combines material selection with an independent interior toggle. | Do not require one exclusive active lens ID. |
| [Neptune](../src/planets/neptune/runtime/client.mjs), lines 540–550 and 649–658, mutates material inside an awaited setter before the outer selection guard runs. | Guard actual publication, including nested material work. Browser reproduction remains required. |
| [PlanetShell](../site/components/PlanetShell.astro) makes settings optional but puts Motion inside that conditional panel. [The shell client](../site/planet-shell-client.mjs) requires it; [profile validation](../site/test/load-browser-profile.mjs) requires lens/speed scenarios universally. | Separate mandatory shared controls from optional object controls and derive coverage from supplied content. |

A previous author-local Chrome 152.0.7977.76 probe observed Saturn go from zero
to six running animations after reduced motion was enabled then cleared, while
Motion remained off and the router reported paused. Pluto stayed paused. This
is prior evidence, not fresh acceptance proof or a claim that Pluto introduced
the defect. Reproduce it on the resolved baseline and save a report before fixing.

## 3. Ownership and interfaces

| Owner | Owns | Must not own |
| --- | --- | --- |
| `site/runtime-policy.mjs` | Pure playback permission and blocked reason; existing input policy. | Listeners, clocks, object IDs, rendering. |
| `site/scene-router.mjs` | Generation, readiness, Motion intent, environmental gates, effective playback, fatal failure, shared lifecycle/status. | Asset lists, lens models, cache algorithms. |
| Shell and control binders | Shell markup, events, labels, enabled/busy state, rendering supplied control state. | Playback authority or object rendering decisions. |
| Shared lifetime | Disposal bookkeeping and cancellation notification. | Another router or renderer wrapper. |
| Shared image transport/store | Decode/release primitives for all objects; deduplication/lifetime for ordinary selected URLs. | Density selection, manifests, global residency, row/atlas policy. |
| Shared selection runner | Request identity and guarded commit ordering. | Interior/rings/shadows meaning or prepared material schemas. |
| Object package | Prepared selection, startup requirements, rendering, speed application, desired presentation state, specialized caches/disposal. | Browser playback policy or global shell status. |

Keep the returned mount interface and add one narrow error-reporting input.
The following signatures are interface sketches, not drop-in implementation.

```js
mountScene(stage, { onError }) -> {
  ready,       // Promise: initial success, failure, or logical cancellation
  pause(),     // synchronous, idempotent; remembers a pre-ready target
  resume(),    // synchronous, idempotent; remembers a pre-ready target
  destroy(),   // synchronous invalidation and idempotent cleanup
}
```

The router always supplies `onError(error)` for fatal failures after a mount is
returned, including while loading. It is generation- and mount-identity-bound,
does not throw, and may synchronously destroy the mount. Its caller stops work
immediately. Old mounts cannot fail their replacements.

Before returning, constructor/startup failures throw or reject `ready`; a
constructor cleans its partial resources if it throws. Invalid input and failed
lens preparation are recoverable and do not call `onError`. Unexpected partial
presentation or speed-application failure is fatal: `ready` cannot reject again
after success, and a corrupt scene must not remain reported as healthy. Direct
adapter tests supply an explicit error spy/handler, not a silent no-op default.

This callback is the only planned mount-signature addition. Do not add a service
container, capability negotiation, subscription protocol, or control registry.

## 4. Playback and mount lifetime

### Shared playback policy

```js
allowAutomaticPlayback =
  sceneState === "ready" &&
  motionRequested &&
  !documentHidden &&
  !reducedMotion;
```

Motion starts off. The checkbox records intent; environmental events never
rewrite it. Reduced motion blocks automatic playback even after the user asks
for Motion on, preserving that request for later. This is an intentional common
product policy, not unchanged behavior for every current client. Direct camera
motion remains out of scope.

The pure function returns permission plus a reason, in this precedence:
unavailable scene, Motion off, hidden page, reduced motion, allowed. The shell
gets that result through a small `setPlaybackState(...)` method. Rendering it
does not emit another Motion-change event. Show a reduced-motion block in the
existing Motion row, including accessible text, without another control/layout.

Speed zero is separate: playback may be permitted while an object's clock is
stopped. `data-playing` means shared permission, not observed clock advancement.

Move every write/removal of `html[data-playing]` into the router. Remove object
environment listeners and CSS rules that independently decide automatic
playback; retain unrelated accessibility styles. Startup, speed changes, lens
completion, and newly attached animations obey the last shared command.

| State | Publication |
| --- | --- |
| Loading or ready but blocked | `data-playing="false"`. |
| Ready and permitted | `data-playing="true"` only after `resume()` succeeds. |
| Destroyed or failed | Remove the attribute; publish existing destroyed/error lifecycle. |

### Mount and failure ordering

1. Start a generation and publish loading with playback denied.
2. Mount the shell with generation-bound callbacks; load the adapter.
3. Retain the raw mount before lifecycle validation. If invalid, use any
   available `destroy()` handle before failing.
4. Initialize a paused target. New automatic animations must be paused before
   their first visible frame.
5. Await readiness. Inputs may change, but the app never dispatches `resume()`
   while loading.
6. Recheck generation/identity, mark ready, and recompute policy. Apply the
   command before publishing successful status.
7. Suppress duplicate effective commands, but initialize every replacement mount.

Preserve pre-ready adapter target-memory semantics. The app deliberately uses
the stricter policy of never requesting the running target before readiness.
Do not remove direct adapter lifecycle tests because the router is stricter.

Startup, event-time playback-command, and reported fatal errors converge on one
router failure path. Invalidate generation and detach active references first;
attempt all cleanup even if one destructor throws. Preserve the primary error,
report cleanup errors, and complete terminal publication. A later rejection or
duplicate report cannot clean up twice or affect a replacement. A destructor
exception is not proof of resource release: tests must expose surviving work.

### Shared lifetime

Add `src/platform/scene-lifetime.mjs`:

```js
createSceneLifetime() -> {
  get disposed,
  onDispose(callback), // returns cleanup errors if already disposed, otherwise []
  wait(promise),       // cancellation-aware await; defined below
  destroy(), // returns collected cleanup errors
}
```

Disposal marks the scope closed before callbacks, runs each once in reverse
registration order, and continues after failures. Registration after disposal
runs immediately and reports any failure explicitly; it never revives the scope.

Every current object uses this lifetime for mount-owned resources. Register
ownership as resources are created, including partial controls, image stores,
cache subscriptions, timers, frame handles, and event listeners. Register a
specialized cache once and let it manage its owned image handles; registering a
permanent finalizer for every evicted image would retain those images until
unmount. Caches keep their entry/request identities, not a competing mount
lifetime. Remove equivalent duplicated mount-disposal bookkeeping.

Likewise, register each recurring timer/frame controller once, with cleanup of
its current handles. Do not append a mount-finalizer closure for each completed
frame, timer, or request. Lifetime storage must be bounded by live owners/work,
not the total historical number of scheduled operations.

Cleanup removes only owned handles/roots. Old cleanup must not clear a replacement
stage through unconditional `replaceChildren()` or delete its diagnostics.
Check lifetime after awaits and immediately before publication. The helper does
not load scenes, choose assets, decide playback, or implement a renderer.

`lifetime.wait(promise)` returns a promise for `{ cancelled: false, value }` on
live success, rejects a live failure, or promptly resolves `{ cancelled: true }`
on disposal. It observes late rejection without changing an already-settled
result and unregisters its internal cancellation waiter on settlement. Waiting
after disposal immediately returns the cancelled result while still observing
the supplied promise. It does not cancel underlying browser work.

All clients use this operation for startup settlement rather than copying their
own cancellation races. Guard intermediate publication as well as the final
result; cancelling the outer wait alone cannot stop an inner async function.
For frame/DOMContentLoaded waits, also cancel the owned handles/remove listeners.
Destroyed `ready` settles without image work or another frame, and may fulfill
without a value; router generation prevents ready publication. Live startup
failure still rejects. A hidden live scene may await paint; a destroyed scene
may not depend on that paint to settle.

### Document lifetime versus scene lifetime

Keep `pagehide`/`pageshow` listeners at document/router lifetime so restoration
still works. Visibility and reduced-motion subscriptions belong to the live
session: remove them on teardown and attach each exactly once on restoration.

Pagehide invalidates the generation, revokes playback, and disposes scene/shell.
Persisted pageshow preserves Motion intent, rereads the environment, and creates
one fresh paused mount before policy applies at readiness. Repeated events are
idempotent. No storage or ordinary-navigation persistence is added.

## 5. Prepared images and cache ownership

Add `src/platform/prepared-image-store.mjs`:

```js
// Every object/cache uses these transport primitives.
decodePreparedImage(image, selectedUrl); // Promise<HTMLImageElement>
releasePreparedImage(image);

// Ordinary prepared assets use this ownership layer.
createPreparedImageStore({ createImage, decoding }) -> {
  load(url),     // Promise<HTMLImageElement | null>
  release(url),  // retire this store's current entry for the URL
  destroy(),
  stats(),      // pendingCount, retainedCount
}
```

The transport primitive sets `src`, awaits decode, checks natural dimensions,
and adds URL/cause error context. Allocation/reuse, decoding hint, request
identity, retry, and release remain with the owner. Row pools pass their existing
image slots. The primitive must not clear `src` in an old request's failure
handler: only the owner knows whether that image has since been reused.

The store accepts a nonempty, already-selected URL. Preserve the caller's
decoding hint; `createImage` is a test seam. Do not interpret object descriptor shapes,
manifests, or density. The object selects the canonical bank once and supplies
the same selected URLs to loading and presentation.

- Deduplicate pending work per URL/store; reuse a successful retained image.
  Track allocation immediately, including pending images.
- Require positive natural dimensions. Live failure removes that exact entry,
  releases references, and rejects with URL/cause context. A later explicit
  load retries; no automatic retry loop.
- Release retires the current entry; reloading creates a new one. Old handlers
  compare entry identity and can never delete/populate its replacement.
- Retired requests resolve `null` when native work settles, including late
  rejection. Destroy invalidates/releases entries synchronously; later loads
  return `null` without allocating. Startup cancellation must not wait for
  these native settlements.
- Callers still check mount/request identity before using a result. Clearing an
  image source is best-effort release, not proof of cancelled decoding/network
  work or immediate browser-memory reclamation.
- One logical owner controls eviction. No global cache, reference counts,
  eviction scheduler, or cross-mount sharing.

### Required migration

| Consumers | Shared loading migration | Object-owned behavior preserved |
| --- | --- | --- |
| Moon, Pluto | Replace ordinary pending/retained URL maps. | Prepared URL mapping, startup/lens requirements, rendering. |
| Earth | Replace ordinary static/lens URL map. | Both row caches, protected rows, capacities, coalescing, publication. |
| Uranus | Replace static `decoded` map, including rejection retry. | Separate material-neighborhood cache and eviction/generation. |
| Mercury, Venus, Mars, Jupiter, Saturn, Neptune, Sun | Use shared decode/release primitives inside existing loaders and integrate common lifetime/retry/publication rules. Do not force mount-long URL retention. | Warm-only initialization, active-lens groups, bounded rows, single-atlas residency, decode scheduling. |

All eleven use shared decode/release transport, release owned pending/retained
references, prevent late publication, allow explicit retry after retryable
failure, and preserve current cache limits.
The shared store is the default for ordinary prepared images. Specialized
residency remains object-owned and tested, not a license to copy the ordinary
store into a new object. Four real consumers prove the reusable store without
imposing one memory policy on every renderer.

Group loaders must record every allocated image before awaiting `Promise.all`,
not only store the returned array after total success. Mercury/Saturn currently
assign group images on success. A partial failure needs to release successful
and pending siblings, contain late settlement, retain the previous presentation,
and allow retry. Test that sequence explicitly.

Warm-only startup uses a temporary owner/group: track handles before decoding,
then drop its explicit image references after the prepared scene has consumed
the warmup and established its own DOM/CSS asset references. Empty that group;
do not promote warm-only handles into mount-long retention. Failure/disposal
releases its remaining handles immediately. Preserve the current successful
warmup behavior; do not force re-decoding by clearing a source still in use.

## 6. Controls and presentation transactions

### Speed binding

Extract this binder inside `src/platform/planet-feature-controls.mjs`, using the
existing `PLANET_SPEED_STATES`:

```js
bindSpeedControl({ button, initialValue: 1, lifetime, onChange, onError }) -> {
  state(),
  setEnabled(enabled),
}
```

It owns one listener, cycling, value, label, and accessibility state. It never
collects animations or calls `play()`/`pause()`. The object applies the rate
through its current mechanism. Existing feature controls and standalone
clients use the binder; remove duplicate speed tables and binding mechanics.

Start at normal; disable speed until runtime binding is ready. This explicitly
standardizes inconsistent pre-ready behavior. Attaching later animation handles
does not reset speed: apply current speed and last playback command before they
can run. Callback failure cannot publish a successful label; fatal application
failure enters the router error path.

### Latest-selection runner

Add `src/platform/latest-selection.mjs`. Bind one runner to the mount lifetime
for each independently committed presentation:

```js
const selection = createLatestSelection({ lifetime, onBusyChange, onFatalError });
await selection.run({
  prepare: async ({ isCurrent }) => preparedResult,
  commit: (preparedResult) => { /* synchronous object publication */ },
  onCurrentFailure: (error) => { /* restore object desired/control state */ },
  discard: (preparedResult) => { /* optional request-owned release */ },
});
```

It returns true for commit, false for stale/cancelled work, and rejects current
preparation failure. Fatal commit failure is reported through `onFatalError`
and then rejects; callers observe the rejection without publishing into a
disposed scope. It owns request identity and busy ordering, not a universal
lens state. Validate control IDs before a request; reject duplicate, missing,
or mismatched IDs before leaving listeners attached. Equal map sizes do not
prove identity.

1. Record the request and mark its participating control regions busy. Preserve
   committed pixels and pressed lens buttons while preparing. Coupled checkboxes
   may show desired values, explicitly pending under that busy state; they are
   not proof that the presentation has committed.
2. Finish required asset/material preparation without mutating visible state.
   Check both lifetime and request identity immediately before commit.
3. Commit synchronously: publish object presentation, then committed state and
   pressed-control projection. No await inside commit. Validate required handles
   before the first visible write.
4. A current preparation failure preserves committed presentation. While still
   current/live, the runner calls synchronous `onCurrentFailure(error)` to restore
   desired state and coupled controls, then clears busy and rejects. A failure
   in that restoration is fatal. Caller catches only observe/report rejection;
   they must not mutate selection state outside the runner's identity guard.
   Recheck identity after callbacks before further publication. Retry is allowed.
5. Stale/cancelled work never commits or reports a live-scene error. `discard`
   releases only request-owned resources, never cache entries shared with a
   winner. All owned outcomes, including late rejection, must be handled.
6. Unexpected commit failure invokes `onFatalError` and stops publication. There
   is no generic rollback of partial DOM writes. After synchronous disposal,
   neither runner nor caller may touch old controls.

### Complex objects prove the boundary

Every current client with lens controls uses the shared transaction mechanism.
Start with Moon/Pluto, then migrate the other presentation models:

- Saturn retains material selection plus an independent interior toggle, with
  potentially multiple pressed controls. Earth/Mercury retain exclusive interior.
- Neptune completes material-row preparation before visible lens commit. A guard
  after `await setLens(...)` cannot protect writes inside that setter.
- Saturn's lens, interior, rings, and shadows share one object-owned desired
  presentation snapshot and winning transaction where they affect the same
  material. Each action updates desired state and captures an immutable snapshot
  before submitting: a rings toggle
  during pending methane selection must not restore the last committed normal
  lens. Competing outer/UI and inner/material winners must not remain.
- Camera caches may warm independently, but callbacks publish only the current
  committed presentation and current camera state, not a captured obsolete
  lens/frame. Keep continuous camera updates outside the transaction runner;
  do not add per-frame coordination or change camera scheduling/timing.

On current recoverable failure, the object resets desired state to its last
committed snapshot and restores toggle/pressed-control values. Do this only if
the failed request is still current through `onCurrentFailure`: a stale rejection
cannot overwrite newer intent. A later unrelated toggle must not silently retry
a failed lens. A successful commit advances the committed snapshot for the
entire presentation.
One busy projection covers all lens/settings regions participating in that
transaction; a settings winner must not leave an older lens spinner stranded.

Split nested async setters into preparation and guarded synchronous publication.
Do not solve races by serializing all input, disabling selection until every
request settles, or rebuilding a scene. Rendering state and resource requirements
remain object-owned callbacks/data, not flags in the shared runner.

## 7. Optional controls and the next-object path

The shared Settings panel, Motion, and high contrast exist even with zero object
settings. Use the existing shared Settings title; packages supply optional rows.
No lenses means no lens panel or binding, not a placeholder capability.

Each package exports `objectControls = { lenses, settings }` from
`site/control-content.mjs`, moving the existing props out of its panel component
without changing their values. Both the panel and profile loader import that
same content; the profile loader uses the object-ID path convention it already
uses for browser profiles. No capability flags or second registry.

Require the export and validate unique IDs/defaults and supported setting shapes.
Then compare expected and rendered IDs/names/kinds and counts, including mandatory
shared controls. Only after that comparison select optional scenarios. Missing
DOM for a declared control is a failure, not a skip. Missing descriptors or
required profile methods also fail. All eleven current objects retain their
lens/speed coverage; empty descriptors are explicit, not inferred from absence.

Playback, lifecycle, camera, assets, and retained-DOM tests always apply. Test
omitted-content cases in component/helper fixtures, not fake product scenes.

Route every app-level lifecycle mutation through the router: pause/resume use
the shared Motion path; teardown/restoration tests use the router-owned lifecycle
path. Remove object-global pause, resume, and destroy shortcuts, including their
callers in package smokes and profiles. Otherwise direct resume can bypass policy
and direct destruction can leave router generation/readiness inconsistent.
Retain object-specific camera, material/cache, and clock observations. Direct
adapter lifecycle tests can call all three methods outside the app router.

### How an additional object is implemented after this PR

1. Add the existing required package/source/preparation/page files and one
   `OBJECTS` entry. No new router case or second discovery list.
2. Validate and select prepared inputs at mount. Use the shared lifetime and
   ordinary image store; a specialized cache needs a demonstrated residency
   requirement, shared decode/release transport, and its own bounded tests.
3. Mount retained rendering paused. Register each resource's cleanup and resolve
   readiness only after required visible assets and presentation are ready.
4. Supply object-owned pause/resume/rate application and presentation callbacks;
   bind common speed/selection machinery only for supplied controls.
5. Expose actual prepared control content and object observations to the common
   profile, plus package-specific material/camera/cache tests.
6. Pass the same registry-derived gates. Do not copy another client's media
   listeners, disposal flags, ordinary image maps, speed handlers, or request
   counters as onboarding scaffolding.

Document this path in `src/planets/README.md` using migrated Moon/Pluto as small
examples and Saturn/Neptune as complex examples. These are examples of one
contract, not renderer categories. Adding an ordinary object should require no
shared runtime change; a genuinely new shared requirement needs a demonstrated
case and executable contract tests.

## 8. Implementation order: one PR

| Commit-sized slice | Required result |
| --- | --- |
| 1. Baseline regressions | Reproduce Saturn; add controlled readiness, nested-material, rejection/retry, and cleanup tests. Separate hypotheses from observed failures. |
| 2. Playback/lifetime/error boundary | Pure policy, router/shell integration, raw-handle cleanup, generation-bound `onError`, cancellable lifetime; all-object removal of policy bypasses. |
| 3. Image ownership | Shared decode/release in all clients; tested store and four ownership migrations; every specialized loader satisfies disposal/retry/publication rules without changed cache limits. |
| 4. Controls | Shared speed/selection; Moon/Pluto, Sun/Venus, Mars/Jupiter, Earth/Mercury/Uranus, then Neptune/Saturn. Preserve each presentation model. |
| 5. Authoring surface | Optional controls, content-derived profiles, diagnostic cleanup, and next-object documentation. No reduction in existing coverage. |
| 6. Final combined proof | Full gates at final head; fresh baseline/candidate comparisons; unchanged prepared bytes except the documented Earth repair; identical prepared bytes in the Earth-only comparison fixture and candidate; updated contract/proof map. |

Tests accompany each slice. Complete every workstream in this PR rather than
merging a playback-only first installment. Start from then-current main in a
safe implementation worktree; do not publish to the already-merged objects PR.

Expected new shared production modules: lifetime, image store, selection runner. Extend
existing policy/router/shell/feature-control modules and add tests and small
object-owned content exports. No universal scene wrapper. A shared helper that
requires object-ID branches or renderer flags has crossed the intended boundary.

Update object-authoring docs, scene-contract explanations, and proof mappings.
Remove stale duplicated policy literals from docs. Preserve source/runtime
closure and package checks; executable proof must not become declaration-only
constants.

## 9. Acceptance and evidence

### Focused tests

| Area | Required cases |
| --- | --- |
| Policy | Complete readiness/Motion/visibility/reduced-motion truth table and reason precedence; speed separate from permission. |
| Router | Motion-on during delayed readiness; initial pause; duplicate events; stale ready/rejection/error/shell callbacks; malformed mount; event-time playback error; cleanup continues after destructor failure. |
| Lifetime | Reverse once-only cleanup; registration after disposal; no old-stage clearing; destroyed readiness settles with frames never fired; shared wait cancellation/late rejection; repeated schedule/complete keeps owner/waiter storage bounded; no surviving owned listeners/timers. |
| Images | Shared transport validation; pending coalescing; retained reuse; invalid dimensions; failure/retry; partial group success/failure/late sibling; release A/reacquire B/late A resolve and reject; pending+retained disposal; no post-destroy allocation; independent-store isolation. |
| Speed | Exact cycle/labels; disabled-before-ready; invalid initial rate; one listener; callback failure; later animation handles inherit current state; disposed controls inert. |
| Selection | A/B and A/B/A permutations; immutable desired snapshots; current failure then unrelated toggle; stale/current rejection; retry; disposal; nested preparation; commit failure; old/new binding sharing DOM nodes; no stale busy/pressed publication across coupled regions. |
| Shell/profile | No lenses or extra settings; mandatory Motion usable; exact declared/rendered controls; missing declared controls fail; current coverage retained. |

Use existing test owners: router tests live in
`site/test/planet-shell.test.mjs`, policy tests in
`site/test/runtime-policy.test.mjs`; new platform helpers get adjacent tests.
Keep all object, specialized-cache, source/runtime closure, and package tests.

### Real Chrome behavior, derived from `OBJECTS`

- Motion off; reduced motion on then off: never plays. Motion on; preference
  changes: resume only if still requested, visible, and ready.
- Hidden page plus preference/Motion changes: no hidden playback. Speed
  zero/nonzero and later animation attachment never bypass policy pause.
- Delayed startup with changed inputs; destroy before ready; release/reject old
  work after restoration: no early running frame, late publication, or teardown
  of the replacement by old work.
- Lens actions through real buttons as well as diagnostics; fail then retry the
  same URL. Delay a later material-row decode at nondefault camera pitch, after
  surface decoding, then supersede or destroy it.
- Saturn material/interior/rings/shadows combinations: check actual material
  addresses, retained interior, and pressed controls. Preserve Earth/Mercury's
  different interior semantics. After failed lens preparation, change an unrelated
  toggle and verify the failed lens is not selected/retried implicitly. An
  attribute alone is not material proof.
- Repeated restoration: one scene/camera, one effective event response, stable
  base nodes, and unchanged specialized-cache limits.
- Actual animation states and frame-separated time samples, not just attributes.
  Allow an in-flight frame to settle at pause, but not continued advancement.

Use installed headless Chrome under standard and doubled display scaling.
**Both conditions load the same canonical highest-density bank.** Record actual
URLs and loaded-byte hashes; a selected-density constant is not proof.

Synthetic pagehide/pageshow tests establish ordering, not real back/forward-cache
admission. Also exercise navigation/back and record `pageshow.persisted`; report
admission or its concrete blocker. Do not call an ordinary reload BFCache proof.

### Visual, resource, and final gates

Compare base/candidate at matched paused poses, viewport, lens/settings, Chrome
version, and loaded asset identities. Require unchanged scene pixels, including
Saturn body/ring coverage. Investigate differences rather than widening masks.
Preserve ordinary shell layout and existing ready-state controls. Intentional UI
changes are the reduced-motion explanation, disabled pre-ready speed, and truthful
busy/pending states. No-control fixtures also retain the shared Settings panel.
Test those states separately from unchanged ready-state scene comparisons.

Source inputs remain unchanged. Prepared assets and runtime-manifest bytes stay
unchanged except for the explicitly authorized Earth repair below. Do not
regenerate unrelated assets to make a refactor pass. If testing a clean checkout requires
restoration/preparation, use the existing isolated workflow and verify that it
reproduces baseline bytes.

Execution note, 2026-09-04: the user identified `earth-8x` as a possible source
of an Earth fix. Its uncommitted raster-scale change was tested in isolation,
but matched close-ups showed new stretched wedges. It was withdrawn. The
trial did not qualify as a repair. The user subsequently explicitly authorized
fixing Earth within this PR. The narrow exception is Earth-owned preparation:
bake its surface homography into RGBA atlas pixels and transport affine frames,
including matching cutaway-outer addresses. Preserve checked source inputs,
canonical 8K source sampling, geometry, retained leaf counts, and zoom 8. No
city paging or deeper-zoom WIP is included. Earth regeneration also corrects
seven demonstrated pre-existing recipe/output mismatches: six inner-shell pole
images and the night-lights thumbnail. The unchanged checked recipes reproduce
the corrected bytes; these RGB changes are explicitly included in the Earth
exception and identical comparison fixture. The implementation record documents
their provenance and limits. Qualify the repair separately, then
compare the architecture against `main` plus that identical Earth-only repair.
The temporary `main` plus workaround fixture is diagnostic evidence only;
its repeatable captures do not qualify either image quality or this PR.

Record startup requests, retained images, cache bounds, and listener/timer state
before/after repeated interactions and remounts. No new per-frame coordination
or polling. Counts are ownership evidence, not memory measurements; removing
duplicate code is not a performance claim. Investigate startup/playback
regressions with matched measurements before calling the PR ready.

Run these existing gates from the implementation checkout. Verify that the
explicit server URL serves that checkout; reuse a matching server or start one
on a free loopback port and pass that URL instead.

```sh
pnpm acquire:planets -- --verify-only
pnpm test
pnpm build
pnpm test:browser http://127.0.0.1:4211
git diff --check
```

Record exact base/candidate commits, dirty-state qualifications, commands,
browser version/channel, served routes, prepared/loaded hashes, and fresh
evidence paths. Keep large captures local/ignored. Provide reproducible tests
and scripts in the PR; label local reports as local, not hosted CI or independent
approval. Passing these gates is not native-renderer or compositor-performance
parity.

## 10. Completion and overengineering limits

Complete all five workstreams, migrate every current object to common
coordination, and pass the strengthened contract and final gates on one
candidate. Review fatal lifecycle paths, async presentation races, and cache
ownership adversarially at final head; repaired findings need fresh proof.

Do not expand this into a universal clock, renderer, scheduler, plugin system,
camera redesign, route/package rename, or unrelated source/preparation rewrite. Shared
helpers must accept prepared data/operations, not grow per-object switches.
Specialized rendering/cache algorithms stay local, while their lifetime and
publication obligations remain shared and enforced.

The optional-control fix and authoring path make expansion safer; they do not
prove arbitrary future shapes/datasets fit without work. Each future package
earns support through the same executable checks. No placeholder scenes or
declaration-only assurances.

If a required workstream cannot be completed safely, revise the proposal before
reducing scope. Do not quietly leave older objects on a parallel orchestration
path or call a partial extraction the unified architecture.

### Proposal review disposition

Three independent adversarial reviews were followed by targeted closure reviews.
They required explicit removal of resume/destroy bypasses, bounded lifetime
registration, reusable cancellation-aware waits, warm-only resource release,
and current-failure rollback/busy ordering for compound controls. Those changes
are incorporated above; each reviewer confirmed its findings were addressed.

This is agreement on the written design within those review scopes, not evidence
that the implementation exists, browser gates pass, or the future PR can merge.
