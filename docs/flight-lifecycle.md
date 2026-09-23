# Shared flight lifecycle

Object selection starts one application-owned world flight. Loading a detailed
object changes its presentation owner; it does not start another camera path or
reset the flight clock. The persistent universe continues publishing the latest
pose while the incoming retained scene connects. The incoming navigation owner
joins that pose before activation finishes. A replacement selection can retire a
detail that is still activating; the persistent world then owns departure
publication while the replacement factory and assets load. Its camera starts
from the last drawn pose and retains the same destination-detail hold.

Preparation supplies `tree.activationGroups` for every registered object. Each
group contains at most 64 existing sibling leaves; containers and leaves whose
display belongs to selection are excluded. The preparation pipeline writes this
metadata, the transport validator rejects its absence, and the registry test
checks the generated bank against the checked-in tree and descriptor hash.
Runtime only restores these prepared leaves over successive frames and gives the
final batch a rendering opportunity before resolving readiness. It never
derives geometry or chooses a different asset bank. Direct and reduced-motion
arrivals remain atomic. A flight holds before the destination needs its detailed
surface if activation is still pending.

The application owns viewport measurement across mounts. Object cameras and
world overlays consume its published bounds and projection. Resize and scroll
schedule a measurement; an unchanged result preserves the snapshot and does not
notify consumers. Replacing sidebar content cannot invalidate that snapshot
synchronously inside an object mount. Each authored projection retains its own
measurement. Destination preparation resolves a new field of view before the
outgoing scene is removed, and cursor picking consumes the same viewport data.

Navigation annotations fade during flight and suspend projection, decluttering,
hit targets, and DOM writes until they are needed again. Physical sprites and
the starfield keep following the camera. Dormant orbit leaf blocks keep
their DOM identities while leaving active layout. Point publication shares one
projection/photometry sample per slot, and orbit occlusion uses a conservative
broad phase before exact chord clipping.

The shell owns one surface-axis reader shared by the minimap and view readout.
Closed minimaps unsubscribe. Preview images acquire a URL only when their
accordion and dataset are visible. Header values update at most ten times per
second, with a trailing update and immediate refresh on camera-owner changes.
Chart pixel alignment activates only for intersecting charts and batches its
reads before writes; hidden charts schedule no alignment frame. If the flight
curve reaches its exact terminal position and orientation before its duration
cap, the lifecycle completes then rather than republishing a stationary pose.
Destination-detail readiness holds still take precedence.

Picking uses the same viewport-centred geometry published by retained markers,
labels, and clipped orbit chords. It coalesces pointer movement into one frame,
refreshes a stationary hover when the presentation changes, and removes a
publisher's targets on disposal. Input never asks `elementsFromPoint` to search
the scene or flush pending style/layout. Indicator resize updates both the
visible orbit cutout and its hit geometry.

Search is owned by the user's current browsing interaction. A completed flight
or overview transition updates the selected body without replacing a newer
query; choosing a result or dismissing search relinquishes that ownership.

## Application request ownership

`site/navigation-lifecycle.mts` owns the pending request, its abort signal,
transient resources and terminal outcome. Requests move from preparing to flying
to committing; same-body dataset changes can proceed directly to committing.
Loading and flight preparation can overlap. These phases describe application
ownership, not additional camera paths or clocks.

Only the current request may commit navigation history. Saved history entries
can be installed before their camera flight completes, preserving Back/Forward
semantics. Completion, cancellation and failure invalidate the request before
running cleanup. A successful or input-interrupted arrival releases temporary
resources without aborting the handed-off scene. Scene resources retain their
own lifetime until replacement or document teardown.

Saved-view restoration on a retained scene waits on the request lifetime. A
replacement selection therefore settles the old navigation immediately, even
when the underlying restoration is still completing. Late transport results
release their resources and cannot commit a replacement's history or readiness.

`site/world-preferences.mts` retains display intent independently of navigation.
The shell binds its settings to this owner, and a newly mounted world receives
the latest settings. Playback remains governed by the shared runtime policy.

## Scene activation and prepared ownership

`site/scene-session.mts` admits one live session. Its state is loading, ready,
failed or disposed; loading distinguishes native activation from subsequent
dataset and saved-view restoration. A native handle cannot publish readiness
before its ready promise resolves and the router commits restoration. Playback
commands and the current view-URL binding belong to the session. Router
diagnostics, shell playback and DOM publication read one derived snapshot.

A session owns a returned native handle even if its factory reports an error
synchronously. Teardown invalidates the session before flushing the URL and
releasing resources; a failed URL flush or destructor cannot skip the remaining
cleanup. Cancelled activation observes late promise rejection without mounting
another scene.

`site/prepared-scene-ownership.mts` keeps the prepared bank under the request's
abort signal until `WorldHandoff.transferTo` assigns it to the session immediately
before mounting. A failed mount releases unclaimed preparation through the
session signal. Successful renderer claims continue owning native residency and
tree cleanup; the application does not introduce another bank or claim path.
Both preserved-view and animated handoffs use this transfer.

## Verification

`pnpm test:node` covers interrupted flights, history, dataset selection,
late transport disposal and superseded saved-view restoration. The focused
`site/test/navigation-lifecycle.test.mts` suite checks commit authority and
cleanup ordering, including abort callbacks and failed destructors.

Use an immutable build for sustained recording; repeated preparation and HMR
can inflate the development server's compiler heap and interrupt navigation:

Follow the [performance build commands](../tools/performance/README.md), then
serve that immutable build with `pnpm preview --port 4221`.

This mode retains production bundling and static serving while explicitly
enabling the existing diagnostic APIs and recorder. Ordinary production
builds disable them. Keep the built assets unchanged throughout the matrix.

Choose checks for the changed behavior after building and preparing its inputs:

```sh
node --test tools/prepared/prepared-activation-registry.test.mts
node --test tools/prepared/prepared-activation-transport.test.mts
HOPS=30 ORIGIN=http://127.0.0.1:4221 `pnpm test:node` (the browser suites were retired; the shell invariants they asserted are checked from the built HTML in `site/test/rendered-page.test.mts`, and scene retention in `site/test/scene-session.test.mts`)
ORIGIN=http://127.0.0.1:4221 `pnpm test:node` (the browser suites were retired; the shell invariants they asserted are checked from the built HTML in `site/test/rendered-page.test.mts`, and scene retention in `site/test/scene-session.test.mts`)
DPR=2 ORIGIN=http://127.0.0.1:4221 `pnpm test:node` (the browser suites were retired; the shell invariants they asserted are checked from the built HTML in `site/test/rendered-page.test.mts`, and scene retention in `site/test/scene-session.test.mts`)
ORIGIN=http://127.0.0.1:4221 node `site/test/rendered-page.test.mts`
ORIGIN=http://127.0.0.1:4221 node `site/test/rendered-page.test.mts`
node `site/test/rendered-page.test.mts` http://127.0.0.1:4221
node `site/test/rendered-page.test.mts` http://127.0.0.1:4221 mars
DPR=2 node `site/test/rendered-page.test.mts` http://127.0.0.1:4221 saturn
node `site/test/rendered-page.test.mts` http://127.0.0.1:4221
node `site/test/rendered-page.test.mts` http://127.0.0.1:4221
node `site/test/rendered-page.test.mts` http://127.0.0.1:4221
DPR=2 node `site/test/rendered-page.test.mts` http://127.0.0.1:4221
```

The registry browser suite covers every object at DPR 1 and 2. The interruption
suite covers arrival, cancellation during activation, superseding selection, and
reduced motion. These prove lifecycle behavior, not a guaranteed frame rate.
Frame-rate claims additionally require matched scene bytes, camera path,
viewport, browser, and full-presentation timing; JavaScript duration alone does
not measure compositor stalls. Development recordings attach an ID to navigation
marks so the metadata and Chrome trace can be correlated.

The interaction-chain recording covers scene picks, pointer movement during
flight, sustained close dragging, overview return, a native wheel interruption,
Sun arrival, zooming back to 5 AU, and subsequent body selections. It records
trace marks, diagnostics, input dispatch times, resource hashes, and whether a
selection needed the sidebar. An input probe rejects any DOM hit-test fallback.
Run recordings separately from builds and other tests; an overloaded harness is
functional evidence only. Compare matching drag phases and correlate frame
sequence outcomes, including partial presentations and unchanged frames.
Complete-presentation endpoint gaps and RAF timing alone are not delivered-frame
proof.

The seeded stress matrix uses six different starting planets, alternating DPR 1
and 2. Each document chains 30 selections, with long curved drags, fine wheel
bursts and reversals, dataset changes, native marker/label/orbit clicks, rapid
supersession, and wheel/drag/Escape interruption. Artifacts retain seeds, action
coordinates, camera state, source revision, Chrome traces, and diagnostics.
A failed chain remains failed; reloads, competing selections, lost retained
nodes, wrong destinations, and application errors are not counted as coverage.

For a shorter run, `SEEDS=2800682729,2685674292,1555659821` selects three of
the matrix's chains. `HOPS` sets selections per chain. The replacement-flight
check uses native sidebar clicks during activation, holds the destination's
prepared bank, and verifies that retained-world transforms change before
releasing those bytes, then checks arrival at DPR 1 and 2.

Recorded runs and their limits remain in the [7 September 2026 qualification](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/flight-qualification.md). They describe those tested revisions, not a new result for this checkout.
