# @cssearth/astronomy — operator notes

Pure math. Time scales, float64 vectors, the reference-frame tree, and (from M2)
the ephemeris series. `CLAUDE.md` is a symlink to this file.

## Hard boundaries

- **Zero dependencies.** Not "few". Zero. This package is imported by the
  pipeline, by workers and by the renderer; a transitive dep would be dragged
  into all three.
- **Zero browser globals.** `lib` is `ES2022`, no `DOM`. If you need `window`,
  `performance` or a canvas, the code belongs in `packages/engine`.
- **No three.js types.** Not even as a type-only import. This package must be
  usable by something that has never heard of three.
- Everything is float64. Nothing here knows that float32 exists — the downcast
  is the renderer's job and happens after camera-relative resolution.

## Conventions that are not negotiable

| Rule | Why |
|---|---|
| Unit in every name — `radiusKm`, `posPc`, `epochJd` | A bare `radius` has silently been metres and kilometres in the same file before |
| Angles in radians internally | Degrees only at the UI edge |
| Epochs are Julian Date in **TT** | UTC has leap seconds; using it for physics is a bug with a 37-second signature |
| `Vec3` is a readonly tuple | Cheap, structurally typed, and copies into a `Float64Array` without a shim |

`TAI_MINUS_UTC_S` in `time.ts` must be bumped when the IERS announces a leap
second. A stale value is a sub-arcsecond pointing error with no other symptom.

## The frame tree is the whole point

`resolve(observerFrame, position, epochJd)` walks both frame chains to their
common ancestor and differences *there*. That is what keeps the subtraction
between two numbers of comparable magnitude. Two ways to break it:

1. Adding a `worldPosition()` helper. There is no world. If a caller wants one,
   they want `resolve` against a chosen observer frame instead.
2. Lifting to the root when the common ancestor is closer. Resolving an ISS
   antenna against the ISS hull through the CMB frame is numerically absurd and
   will read as jitter.

Frames are **translation-only** and share ICRF axes. A body's spin does not move
its frame origin, so no rotation matrix belongs here. Orientation is the
renderer's concern.

## Two resolution paths — `resolve` and `resolveInto`

`resolve(observerFrame, position, epochJd)` returns a fresh `Vec3` tuple and
evaluates `Frame.originInParent` inline as it walks. It allocates on purpose:
a `Set` and two arrays per `commonAncestor` call, plus a new tuple at every
step of `liftToAncestor`'s walk. That is the right default — cheap to reason
about, easy to test, structurally typed — for everything that is not a
per-frame render-loop call: catalogue ingestion, the pipeline, one-shot camera
moves like `flyTo`, tests.

`resolveInto(out, observerFrame, position, snapshot)` is the same walk, same
operand order at every step (so results are bit-identical to `resolve`, proven
in `frames.test.ts`), but it writes into a caller-owned `Float64Array` and
reads frame origins out of a **snapshot** instead of calling
`originInParent`. Two consequences, both load-bearing:

- **It calls no user code at all.** Re-entrancy into the tree's shared scratch
  buffers is therefore not expressible, rather than merely unlikely — no
  guard, no scratch stack, no `try/finally`.
- **Ephemeris cost drops from O(objects x depth) to O(frames) per tick**, and
  every object resolved within a tick sees the same frame positions.

## `snapshot` — evaluate the tree once per tick

`snapshot(epochJd, reuse?)` walks the frames in topological order (insertion
order, which `add`'s parent-must-exist rule guarantees is topological) and
writes every `originInParent(epochJd)` into a flat `Float64Array(3N)`. Pass
`reuse` and the per-tick call allocates nothing.

Reading a frame that has not been evaluated yet **throws**. During
construction that catches a definitional cycle — a frame whose origin depends
on a frame later in the order — and afterwards it never fires, because every
slot is filled.

`refreshSnapshot(snapshot, epochJd)` re-evaluates an existing snapshot in
place and THROWS if it belongs to a different tree — checked against a
private per-tree identity token stamped on the snapshot, not frame count,
because two unrelated trees can easily land on the same count and a
count-only check would silently accept one tree's snapshot as another's.
`snapshot(epochJd, reuse?)` is the allocating convenience over it, for
construction and tests.

`refreshSnapshot` is not `@noalloc`, and that is deliberate: it calls
`Frame.originInParent`, which is user code returning a
tuple. That is the whole point of the split — this happens O(frames) once per
tick so that `resolveInto`, which is O(objects × depth), can call no user
code at all.

The shipped tree is complete before its first snapshot; `Engine.frame` calls
`refreshSnapshot` directly once per tick, followed by any number of
`resolveInto` calls against that snapshot. A star needs no frame: its `Focus`
sits on `sol`, with its parsec offset converted to kiloparsecs by exact division
by 1000. At 714 pc the float64 quantisation is 3.3e-8 rad at 1 au arrival,
below M0's 8.08e-7 bound, which is not crossed until ~17,642 pc. Reintroduce a
growable-snapshot capability only for a stellar SURFACE tier that lands at a
stellar radius rather than an au, as T0 does on a planet.

## `add` enforces the structure re-anchoring depends on

A child's unit must be strictly finer than its parent's, and its exit ball
must lie inside its parent's:

    maxOffsetInParent + FRAME_EXIT_BALL_UNITS * (child.unitM / parent.unitM)
        <= FRAME_EXIT_BALL_UNITS

`Frame.maxOffsetInParent` is the supremum over epochs of the origin's length,
in the parent's unit — an upper bound, not a sample. Understating it silently
breaks the termination argument for the camera's eviction rule (see
`packages/engine/src/camera/cameraRig.ts`). Same-unit and coarsening nesting
are unsupported, which is why sibling frames at the same scale hang off a
coarser parent rather than off each other.

## Testing numerical code

Assert against a reference value with a documented error budget, never an
equality. Reference sources, in order of preference: JPL Horizons vectors, the
published catalogue row, then a second independent implementation.

`vitest run` here is fast and has no browser. Keep it that way — a test that
needs a DOM belongs in `packages/engine`.

## The ephemeris layer (M2)

`src/data/*.data.ts` and `src/__fixtures__/*.ts` are **generated**. Never edit
them by hand — every one carries a header naming the generator that made it.
Change the generator in `tools/` and re-run it. The generators re-download their
sources into `tools/.cache`, which is gitignored, so a clean checkout costs one
fetch and nothing else.

| Rule | Why |
|---|---|
| Everything returns **ICRF equatorial** | Frames share ICRF axes. Ecliptic exists only at the edge, via `eclipticJ2000ToIcrf` |
| Ecliptic conversions use **84381.448"**, not 84381.406" | It is the obliquity Horizons builds `REF_PLANE='ECLIPTIC'` on, verified by recovering it from a fixture pair. The IAU 2006 value is 0.042" — 4 km at 1 au — of silent bias |
| VSOP87 and ELP2000 output goes through `vsop87ToIcrf`, not the obliquity rotation | The published matrix also carries the ~0.1" offset between the DE200 dynamical equinox those theories were fitted to and FK5/ICRF |
| Rotation is **not** a frame | `rotation.ts` exports orientation for the renderer and imports nothing from `frames.ts`. A `Frame` with a rotation matrix breaks the translation-only invariant the whole tree rests on |
| VSOP87 gives **system barycentres** | `jupiter` in `vsop87.ts` is the Jupiter system barycentre, up to 227 km from Jupiter. `solarSystem.ts` subtracts the moons' mass-weighted offsets to get the planet. For Earth that difference is 4671 km |

### Frame units come from a rule, not a table

`chooseFrameUnitM` in `solarSystem.ts` is the only place a `unitM` is decided.
Adding a body means adding it to `bodies.ts` and letting the rule run; it does
not mean picking a unit. If the rule cannot serve a new body, change the rule
and re-run `solarSystem.test.ts`, which pins each output unit explicitly so the
change is visible in the diff.

### Testing an ephemeris: two tolerances, never one

Every ephemeris assertion carries **both**:

1. a **budget** — `truncation + theory`, where the truncation part is generated
   from the coefficients that were dropped and the theory part is measured
   against Horizons with the *untruncated* series. This is the claim, and it is
   derivable rather than observed.
2. a **regression guard** — the measured worst case plus about 15 %, asserted to
   be inside the budget.

A budget alone cannot fail usefully: Neptune's is 69 000 km, and a dropped
periodic term would live inside it forever. A guard alone is just a snapshot of
whatever the code happens to do. Both, and the assertion that the guard is
inside the budget, is what makes the claim real.

Fixtures come from `tools/fetch-fixtures.mjs` and each records the Horizons URL
that produced it. Never assert against a value this package computed. Never widen
a tolerance to make a test pass without changing the sentence in the README that
the number is quoted in.

### Validity window

**1900-01-01 to 2100-01-01** (JD 2415020.5 to 2488069.5). Both series were
truncated against this window and the moons' elements fitted over it. Evaluation
outside still works and is still continuous; it is simply not bounded by
anything this package has measured. If the window moves, `generate-series.mjs`
has to run again — the truncation thresholds depend on it.

### The moons are a fit, and the README says so

There is no satellite theory here. Twenty moons are precessing Keplerian
ellipses whose elements were fitted to Horizons; their errors are fit residuals
and range from 0.07 % of orbit radius (Io) to 76 % (Mimas, which librates 49
degrees from its resonance with Tethys). Do not quote them as accuracy. Do not
quietly improve one moon by hand-tuning its elements — the fit is reproducible
and a hand-tuned element is not.
