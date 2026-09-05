# Shared object runtime implementation

The implementation in PR #2 replaces all eleven private runtime assemblies with
`createObjectRuntime`. Each package retains its prepared rendering facts. The
common platform owns every session, control transaction, image lease, residency
pool, playback coordinator, and orbit binding.

The required acquisition, 818-test, build and full browser gates pass. All eleven
objects have the completed DPR 1/2 visual comparison. [The proof](generic-runtime-contract-proof.md)
and [machine-readable evidence](generic-runtime-contract-evidence.json) record
the exact source, results and remaining pixel/performance qualifications.

## Main changes

- `object-runtime-contract.mjs` validates the actual definition, controls,
  prepared catalogs, synchronous hooks, retained handles and body registrations.
- `object-runtime.mjs` assembles one lifetime, resources, playback, controls,
  selection and camera. The router remains the only playback-permission owner.
- `prepared-image-store.mjs` uses explicit leases, bounded native slots,
  cancellation-safe URL coalescing, retries and batched ownership changes.
- `prepared-residency.mjs` implements all pool mechanics. Packages supply policy
  records and pure resource demand, including Earth page transitions and the
  view-sensitive Uranus/Neptune/Saturn presentations.
- `object-selection-runtime.mjs` owns desired/committed state and applies current
  camera demand at the actual publication boundary.
- `prepared-playback.mjs` registers retained CSS/WAAPI animations and applies
  readiness, router permission, selected speed and prepared roles. Late handles
  inherit current state. Pose animations stay distinct from rotation playback.
- `object-control-binding.mjs` binds the existing content once and publishes busy
  and committed state to both lens and settings panels. Motion remains shared
  shell policy.
- `object-browser-profile.mjs` provides one actual-runtime observation/action
  implementation. Package profiles contain audit facts and view mappings.

There is no new timer-driven animation clock, rendering backend, object registry,
application route, dependency, or fallback scene.

## Removed private ownership

All eleven clients are four-line bindings. The old Earth, Mercury, Mars, Jupiter,
and Uranus cache implementations, Earth surface-image owner, Mercury lens-image
owner, and Venus control coordinator are deleted. Saturn's private lifecycle,
view-bank coordination, control binding and playback wrapper were removed from
its client. Neptune's unused binary-orbit loader was removed with its private
assembly. The unused feature-control binder was removed from the platform;
its small speed-state data export remains for existing consumers.

Useful failure tests were moved to actual shared owners. In particular, the 24
Mercury/Venus/Mars orbit-failure cases now compose their real package
presentations with the real shared mount, resources, selection and orbit. They
no longer extract a function from a private client that should not exist.

The ownership checker follows imports beyond the object directory. A helper
moved into another folder is exempt only when it is part of the actual common
runtime closure. Injected private mounts, listeners, image owners, selection
schedulers, playback coordinators, control binders, hidden helpers and shared
object-ID dispatch all fail their intended checks.

## Rendering corrections and preserved behavior

The shared camera keeps prepared perspective and scene scale fixed, applies zoom
to the camera, and retains zero scene-depth translation. Body-dependent lighting
layers are registered against the actual mounted scene and checked at every
publication. These invariants address the detached Saturn material disc shown
in the original report and prevent an object from silently using a private
projection path.

Saturn also had 162 retained interior projective leaves missing their prepared
layout dimensions. `prepare-leaf-layouts.mjs` now supplies the correct 128-pixel
leaf and 2048×1024 atlas dimensions instead of the generic 64-pixel/1024×512
fallback. The prepared-leaf audit found no equivalent omission in the other ten
objects. This is a separately identified visual correction, not unchanged-pixel
parity with the broken interior.

The incoming PR shell work and common input work at `dd91897` are preserved:
factsheets/charts, sidebar placement, drag/inertia/fly-to/wheel behavior, and the
projective texture leaf's preserve-3D path. The canonical dirty main checkout and
the separate sidebar worktree were not used as implementation targets.

## Evidence method and limits

The comparison baseline is the sealed `dd91897` integration tree. The original
`ca610599` bundle remains available for migration history. Each bundle covers all
11 objects, 418 conditions and 2,508 fixed-order native GPU readbacks. Source
files, prepared assets, loaded bytes, browser/GPU identity and the unchanged
six-module audit harness are recorded. Every phase is retained, including failed
captures. No masks, increased tolerance, favorable-phase selection or software
renderer substitute is used.

Some captures differ in Chrome texture sampling or raster completion. Unchanged
baseline repeats also differ, but that alone does not establish the cause of
all candidate differences. Earth's reduced-scale sampling and Neptune's few
persistent one-level background pixels require explicit qualification. The
strict byte-identical pixel gate must remain failed where it fails. The final
proof reports visual findings separately from functional and architectural tests.

Earth's standalone performance checks pass at DPR 1 and 2. A separate production
workload fails its zero-long-task budget on both builds, with more long tasks in
the candidate measurement. All of its other production assertions pass at both
DPRs; the proof records the exact timings and preserved strict failure.

The older Mars and
Jupiter element-count expectations fail, with identical actual structure in the
integration reference and candidate: Mars has 518 leaves/1,047 stage elements;
Jupiter has 790/1,575. Jupiter's 40 ms P95 frame budget also fails: the same
Shadows-enabled sweep measures 50 ms on both versions at both DPRs. The earlier
Mercury migration comparison found the same 1,814 stage elements and 925 measured
layers on reference and candidate, exceeding its old budgets. These limits were
not increased, and report-only measurements are not budget passes. This work
makes no performance improvement, native-renderer parity, immediate GPU-memory
release, or physical-device performance claim.

Older controller-only and Earth affine-repair evidence remains in repository
history and the local evidence directories. Those earlier acceptances do not
upgrade the current full-runtime comparison to strict pixel parity.
