# Shared flight lifecycle

Object selection starts one application-owned world flight. Loading a detailed
object changes its presentation owner; it does not start another camera path or
reset the flight clock. The persistent universe continues publishing the latest
pose while the incoming retained scene connects. The incoming navigation owner
joins that pose before activation finishes.

Preparation supplies `tree.activationGroups` for every registered object. Each
group contains at most 64 existing sibling leaves; containers and leaves whose
display belongs to selection are excluded. The preparation pipeline writes this
metadata, the transport validator rejects its absence, and the registry test
checks the generated bank against the checked-in tree and descriptor hash.
Runtime only restores these prepared leaves over successive frames. It never
derives geometry or chooses a different asset bank. Direct and reduced-motion
arrivals remain atomic. A flight holds before the destination needs its detailed
surface if activation is still pending.

The application owns viewport measurement across mounts. Object cameras and
world overlays consume its published bounds and projection. Resize and scroll
schedule a measurement; an unchanged result preserves the snapshot and does not
notify consumers. Replacing sidebar content cannot invalidate that snapshot
synchronously inside an object mount.

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

## Verification

After the normal package/renderer build and `pnpm prepare:object-json`:

```sh
node --test tools/prepared-activation-registry.test.mjs
node --test tools/prepared-activation-transport.test.mjs
node site/test/flight-registry-browser.mjs http://127.0.0.1:4210
node site/test/flight-activation-browser.mjs http://127.0.0.1:4210 mars
DPR=2 node site/test/flight-activation-browser.mjs http://127.0.0.1:4210 saturn
node site/test/shared-camera-viewport-browser.mjs http://127.0.0.1:4210
node site/test/lazy-surface-preview-browser.mjs http://127.0.0.1:4210
node site/test/shell-surface-browser.mjs http://127.0.0.1:4210
DPR=2 node site/test/shell-surface-browser.mjs http://127.0.0.1:4210
```

The registry browser suite covers every object at DPR 1 and 2. The interruption
suite covers arrival, cancellation during activation, superseding selection, and
reduced motion. These prove lifecycle behavior, not a guaranteed frame rate.
Frame-rate claims additionally require matched scene bytes, camera path,
viewport, browser, and full-presentation timing; JavaScript duration alone does
not measure compositor stalls. Development recordings attach an ID to navigation
marks so the metadata and Chrome trace can be correlated.
