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
the starfield keep following the camera. Dormant star and orbit leaf blocks keep
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

## Verification

Use an immutable build for sustained recording; repeated preparation and HMR
can inflate the development server's compiler heap and interrupt navigation:

```sh
pnpm build:performance
pnpm preview --port 4221
```

This mode retains production bundling and static serving while explicitly
enabling the existing diagnostic APIs and recorder. Ordinary production
builds disable them. Keep the built assets unchanged throughout the matrix.

Choose checks for the changed behavior after building and preparing its inputs:

```sh
node --test tools/prepared-activation-registry.test.mjs
node --test tools/prepared-activation-transport.test.mjs
HOPS=30 ORIGIN=http://127.0.0.1:4221 pnpm test:browser:navigation-stress:matrix
ORIGIN=http://127.0.0.1:4221 pnpm test:browser:interaction-chain
DPR=2 ORIGIN=http://127.0.0.1:4221 pnpm test:browser:interaction-chain
ORIGIN=http://127.0.0.1:4221 node site/test/replacement-flight-browser.mjs
ORIGIN=http://127.0.0.1:4221 node site/test/natural-navigation-browser.mjs
node site/test/flight-registry-browser.mjs http://127.0.0.1:4221
node site/test/flight-activation-browser.mjs http://127.0.0.1:4221 mars
DPR=2 node site/test/flight-activation-browser.mjs http://127.0.0.1:4221 saturn
node site/test/shared-camera-viewport-browser.mjs http://127.0.0.1:4221
node site/test/lazy-surface-preview-browser.mjs http://127.0.0.1:4221
node site/test/shell-surface-browser.mjs http://127.0.0.1:4221
DPR=2 node site/test/shell-surface-browser.mjs http://127.0.0.1:4221
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
