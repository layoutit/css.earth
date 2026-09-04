# Shared runtime implementation

This implements the [approved proposal](shared-runtime-architecture-proposal.md)
in one architectural PR. It covers the Sun, Mercury, Venus, Earth, Moon, Mars,
Jupiter, Saturn, Uranus, Neptune, and Pluto.

Status: the shared architecture and explicitly authorized Earth repair are
implemented. Source verification, all 598 tests, build, and the full headless
browser suite pass.
The inspected `earth-8x` raster workaround introduced close-up stretching and
was withdrawn. The PR remains a draft; visual acceptance is not yet complete.

## What changed

The router now owns automatic playback permission. It combines readiness,
the user's Motion request, visibility, and reduced-motion preference. Objects
keep their own animations and clocks. Changing speed does not grant playback
permission, and clearing reduced motion does not turn Motion on.

Three small shared modules coordinate work without knowing object IDs:

- `scene-lifetime.mjs` owns once-only cleanup and cancellable waits.
- `prepared-image-store.mjs` handles prepared image decoding and ownership.
- `latest-selection.mjs` prevents stale selections from publishing and
  separates recoverable preparation failure from fatal publication failure.

The existing speed control is shared across all eleven clients. Each package
exports its actual lens and extra-settings content. The shell always supplies
Settings, Motion, and high contrast; a package needs no fake lens or setting
to use that shell. Browser profiles validate the declared controls against
the rendered controls.

Specialized row, material-neighborhood, and grouped-image caches remain inside
their object packages. Camera math, drag/inertia/fly-to behavior, Saturn's native
compositor wrapper, and all non-Earth asset banks are unchanged.
Both tested display scales use the same highest-density bank.

The user identified `earth-8x` as a possible source of an Earth fix. Commit
`849ac46` temporarily copied only its uncommitted 16.25-to-4 raster-scale
change. A later close-up review rejected it; the generator, regenerated scene,
and added scale-bound assertions were restored exactly to `91dae216`.
The subsequent Earth repair below changes Earth preparation and its surface
image ownership. City paging, deeper zoom, yaw changes, dependencies, and
policy WIP were never copied.
The user's `earth-8x` worktree was not modified.

### Earth surface repair

Earth now bakes the surface's projective texture warp into transparent raster
pixels ahead of runtime. The retained scene transports affine rectangles;
the shared renderer is unchanged. This follows the existing Pluto preparation
approach, with Earth-owned source mapping and image-bank ownership.

The plan contains 448 exterior cells. The 308 cutaway outer cells reuse their
exact geometry and atlas addresses. Source sampling remains tied to the 8K
input, the existing geometry and overlap remain, and maximum zoom stays 8.
Tests check composed geometry, directional source-sampling density, continuous
latitude sampling, longitude wrapping, page bounds, and cutaway reuse.

Seven static pages, each no larger than 4096×4096, replace one large image.
The largest page is 61.75 MiB and the complete exterior bank is 361.375 MiB
when expressed as uncompressed RGBA byte counts. These are dimensional costs,
not measurements of browser or GPU memory. A single-image trial had unacceptable
cold-start stalls and was rejected; paging bounds individual image size, not
the complete bank's size.

The object owns only its active surface bank and latest pending bank, with
two owned page decodes at a time. Hidden surface palettes contain no image URLs.
Retirement clears image ownership without waiting for a cancelled native
decode promise to settle. Tests cover stale A/B/A completion, never-settling
cancelled decode, failed preparation preserving the visible view, fatal
publication, and teardown. Neither display scale selects another asset bank.

Full Earth regeneration also corrects seven pre-existing recipe/asset
mismatches: the six inner-shell pole images and the night-lights thumbnail.
The unchanged main preparation functions reproduce the new bytes exactly;
the old/new execution order gives identical bytes and does not mutate source
buffers. The old poles were lossy despite the checked lossless recipe. Source
inputs and image-library versions match. These are real RGB changes with
unchanged pole alpha, not merely container metadata. Their historical encoding
settings are unknown. Restoring only old bytes would conceal the reproducibility
mismatch. Evidence: `output/earth-affine-asset-reproducibility.md`.

## Proof map

| Obligation | Executable evidence |
| --- | --- |
| Playback policy and stale session isolation | `site/test/runtime-policy.test.mjs`, `site/test/router-runtime.test.mjs`, `site/test/runtime-playback-browser.mjs` |
| Cleanup, cancellation, and callback failure | `src/platform/scene-lifetime.test.mjs`, `src/platform/cubic-sky-lifetime.test.mjs`, `site/test/shell-lifetime.test.mjs`, package lifetime tests |
| Image ownership, late settlement, retry, and bounded caches | `src/platform/prepared-image-store.test.mjs` and object-owned row/group/neighborhood cache tests |
| Selection order, rollback, and publication failure | `src/platform/latest-selection.test.mjs`, package coordination tests, shared browser conformance |
| Real compound/deferred publication | `site/test/runtime-complex-browser.mjs`: Neptune's later material row and Saturn's coupled lens/interior/rings/shadows |
| Optional controls without weaker existing coverage | `site/test/load-browser-profile.test.mjs`, shell/contract/package tests, rendered-control conformance |
| Retained DOM, interactions, and canonical bank | `site/test/planet-browser-conformance.mjs` and all eleven package browser suites |
| Earth affine preparation and complete paged-bank selection | `src/planets/earth/test/surface-raster.test.mjs`, `preparation.test.mjs`, and prepared-page-derived `browser-profile.mjs` |
| Earth page ownership, stale selection, failed decode, and hidden palettes | `src/planets/earth/test/surface-image-banks.test.mjs` and `runtime-lifetime.test.mjs` |
| Actual back/forward-cache admission | `site/test/runtime-bfcache-browser.mjs`, including `pageshow.persisted` and document identity |
| Matched scene/shell regression | `tools/audit-shared-runtime.mjs`: Chrome version, prepared hashes, loaded-response hashes, raw captures, absolute differences, and Saturn coverage |

## Local acceptance record

Implementation checkout: `/Users/ekrof/fed/cssEarth-runtime`.
Base: `4ba3c3c526abdfcf6c26def7fd635451f2d08eea` (`main`).
Candidate server: `http://127.0.0.1:4230`.
The reports below are local ignored artifacts, not hosted CI or independent
approval. The initial architecture implementation is commit `91dae216`.
The completion audit then repaired two additional object-local failure paths
in Moon/Pluto and Venus, described below. The temporary scalar Earth workaround
has no net effect; the separately authorized affine repair is described above.

The following table records the latest Earth-repair qualification. Browser and
visual checks remain separate from source, unit, and build success.

| Gate | Result | Local report |
| --- | --- | --- |
| `pnpm acquire:planets -- --verify-only` | Pass with Earth repair | `output/runtime-source-verify-earth-final.log` |
| `pnpm test` | 598 passed; none failed or skipped | `output/runtime-unit-tests-earth-final.log` |
| `pnpm build` | Pass with Earth repair | `output/runtime-build-earth-final.log` |
| `pnpm test:browser http://127.0.0.1:4230` | Pass with Earth repair; exit 0 | `output/runtime-browser-earth-pages-final.log` |
| Earth preparation | 6 passed; 221 runtime asset hashes verified | `output/earth-affine-paged-preparation-tests.log` |
| Matched visual regression | Unmet; independent Earth-only baseline repeatability failed | See below |
| `git diff --check` | Pass before commit | Git working tree |

The completed architecture browser run before the Earth repair used installed headless Google Chrome
`152.0.7977.76`. It passed
shared shell, introduction, and navigation gates; all 143 object conformance
cases; 22 playback cases; six complex/deferred-selection cases; real
back/forward-cache restoration for all eleven objects; and all eleven
package-specific browser suites. Both display scales loaded the same canonical
highest-density bank.

The final Earth-repair run passed that same complete browser suite, including
all 143 conformance cases, 22 playback cases, six complex-selection cases,
real back/forward-cache admission for all eleven objects, and all eleven
package suites. Conformance now verifies requests for all seven canonical
Earth surface pages and its pole asset at both display scales. Earth smoke
checks actual rendered page URLs, complete requested banks, empty hidden
palettes, and one settled owned bank. Its separate doubled-scale run also
passed with 999 retained leaves (`output/earth-affine-smoke-pages-2.log`).

The final run includes two evidence-harness corrections. Playback observation
now waits for permitted, mounted, nonpending native playback before requiring
actual clock advancement; it still fails stuck or frozen clocks. Earth's
old single-image count and unused pseudo-element checks were replaced with
prepared-page-derived counts and actual rendered texture checks. The earlier
failed runs are retained, not relabeled as passing. Final playback and complex
reports are `output/playwright/runtime-playback-1788542752082/report.json` and
`output/playwright/runtime-complex-1788542839353/report.json`.

Independent Earth closure reviews checked source mapping, geometry, sampling,
bank retirement, stale selection, publication failures, and fixture isolation.
They reran 35 focused tests and verified all 221 runtime asset hashes. A final
finding that canonical-page declarations were not consumed by conformance was
closed: conformance now asserts their actual requests, and the full rerun
passes both display scales. The separate visual review verified the failed
288-frame baseline check below; it did not approve visual acceptance.

Independent implementation reviews covered playback/lifetime/error boundaries,
async presentation races, cleanup after partial failure, image ownership, and
all eleven integrations. Repaired findings received focused regression tests
and review. Matched visual acceptance remains a separate, unmet requirement.

Late acceptance checks found and closed stage-attribute cleanup omissions,
old-camera cleanup affecting replacement state, and an enabled speed button
before the object module loaded. New tests cover those failures, including
JavaScript-disabled initial HTML and speed changes while Motion, visibility,
or reduced-motion policy blocks playback. The browser race harness now delays
successful native decode completion: withholding HTTP while an owner retires
an image can leave Chrome's cancelled decode unsettled. Per-case deadlines
prevent that kind of test stall from appearing as an indefinitely running gate.

The completion audit found two more failure paths and repaired them without
changing rendering, prepared data, or camera behavior:

- Moon/Pluto now register lens-metadata cleanup beside camera ownership, before
  a sky/Sun constructor can fail. Ten cases cover both failure points, cleanup
  errors, pre-attachment metadata, and replacement-root protection. Six fail
  against the previous code and all ten pass with the repair.
- Venus atmosphere/stars callbacks now observe disposal and route live
  publication failures through the existing `onError` boundary. Those handlers
  and shadows stop state writes after synchronous disposal. Nine cases cover
  normal use, partial publication failure, retained callbacks, nested disposal,
  and startup throw semantics.

An independent reviewer checked source and test fidelity and reran all 19 new
cases, then both complete test files (69 passed, none failed or skipped). The
constructor tests execute the production functions with actual prepared plans
and controlled dependencies; they prove ownership behavior, not raster parity.
The Venus tests import the production controls directly. The full post-repair
source, 570-test, build, and browser gates then passed on the unchanged code
under review. Playback and compound-selection reports are
`output/playwright/runtime-playback-1788537310414/report.json` and
`output/playwright/runtime-complex-1788537396845/report.json`; their recorded
source hashes were rechecked against the reviewed files. This closes the two
architecture findings, not the separate Earth visual-comparison blocker.

## Visual qualification and the rejected Earth workaround

The untouched baseline at `4ba3c3c526abdfcf6c26def7fd635451f2d08eea`
was served from a clean detached worktree,
`/Users/ekrof/fed/cssEarth-runtime-baseline`, at `http://127.0.0.1:4261`.
All 1,941 runtime assets were verified against its manifests. Both servers
displayed `Version 0.6`; an earlier server's stale `Version 0.1` label was not
treated as a rendering regression or masked out.

Chrome `152.0.7977.76` could not produce a
repeatable full raw-main baseline matrix.
Some paused captures differed by one channel level; others omitted large
rectangular texture or shell regions while camera, animation times, prepared
image URLs, and computed styles remained unchanged. These are failed
qualification runs, not accepted visual comparisons.

The audit keeps immutable capture conditions, settles before each screenshot,
preserves both ordered phases, and requires three identical pairs before
comparison. It verifies prepared hashes and actual loaded-response hashes,
records source hashes, refuses evidence overwrite, compares both phases with
zero pixel tolerance, and checks Saturn body/ring coverage. It does not select
a favorable phase or use masks. Early Sun/Earth calibration runs passed in
isolation, but the full raw-main matrix still failed. Isolated success does not qualify
the complete PR.

A bounded check with preinstalled Chrome Canary `155.0.8041.0` also failed.
Native Apple M3 Max / Metal / Graphite rendering, GPU composition/rasterization,
and zero GPU crashes were verified. Sun matched across two fresh contexts, but
Earth produced 43 distinct images in 48 captures, including visibly missing
regions. The check stopped before Saturn. Evidence is local:
`/tmp/cssearth-canary-native-proof-FcQ9E6/report.json`, with raw numbered images
and the failed frame-sequence package beside it. Browser-backend overrides
that fell back to software were not accepted as native-GPU evidence; none are
application changes. A later explicit software-composited headless diagnostic
also failed on two unchanged Earth baseline captures (3,095 changed pixels).
Its failed report is `output/headless-software-calibration-1/report.json`.

The affine Earth diagnostic at `output/earth-affine-paged-diagnostic-1/report.json`
completed 24 fresh contexts. Twenty met the exact repeated-pair criterion.
Four did not: default desktop and maximum-normal mobile at doubled display
scale, each repeated twice. Analysis of all six retained frames per failure
found only 11–27 isolated varying pixels, maximum RGB range one, no alpha
change, and no edge-adjacent varying pixels. These exact failures remain
failures; they are not reported as zero-pixel parity. The separate calibration
investigation is recorded in `output/earth-affine-readback-calibration.md`.

### Independent Earth-only baseline and fixed-schedule check

The new comparison fixture at
`/Users/ekrof/fed/cssEarth-runtime-earth-affine-baseline` contains raw main plus
only the Earth affine repair. It retains main's shared runtime, router,
lifetimes, clocks, and selection handling. All 221 Earth assets and 26 source
files match the candidate. The minimally adapted old Earth client has SHA256
`f3c55b98aae8832f972da7cb6bda22e9f595866e105cc27e40bb273c0c5f84d1`.
The independent fixture review is in `output/earth-affine-baseline-fixture/`.

Its fixed-schedule A/A check captured 288 frames across 48 fresh contexts:
16 Earth conditions, three contexts each, six frames each. Two contexts per
condition established observed bounds, frozen before the third holdout.
Every frame was retained. No favorable pair, region mask, or discarded early
frame was used. This was a measurement, not an authorized tolerance change.

The check failed. Early default-shell captures changed by up to 65 RGB levels
on mobile and 55 on desktop; the desktop scene changed by up to 16. Later
frames became exact or showed sparse one-level variation. Eleven conditions
were byte-identical across all 18 frames, but that does not qualify the other
five. The desktop doubled-scale shell holdout exceeded its frozen maximum
pair count (39,194 versus 39,193) and union count (39,223 versus 39,217).
These findings supersede any suggestion that the broader failure consists
only of one-level readback noise.

Independent review verified all 288 PNG hashes, 576 pre/post state snapshots,
763 source hashes, seven harness hashes, actual loaded-byte hashes, and native
GPU/server identity. Camera, styles, paused animation times, and bank state
were unchanged. Early raster-detail settling is consistent with the images,
but the check does not prove a particular Chrome internal cause. Neither
later stable frames nor a fitted bound establish image-quality acceptance.
Full evidence: `output/earth-affine-aa-baseline-1/report.json` and
`output/earth-affine-aa-review.md`. The result remains failed; the strict
matched baseline/candidate gate is unchanged and unmet.

### Earlier rejected diagnostics

A headed diagnostic completed 88 baseline conditions but its candidate failed
after 29: only 54 of 58 completed phase comparisons matched. Four Earth phases
had missing tiles, and the next Earth condition was unstable. The reports at
`output/shared-runtime-visual-headed/{baseline,candidate}/report.json` are not
accepted full comparisons. The user prohibited headed checks afterward; the
audit now always launches headless Chrome. No further headed checks are used.

### What the 8K branch actually supplied

The inspected branch is `earth-8x`, at `419a0d9e38ec7e7fd3624f2585c7c093648a7d9e`,
in `/Users/ekrof/fed/cssEarth-earth-8x`. Its commit message explicitly says texture
stretching is unresolved and the experiment is not a validated rendering fix.
Its dirty generator changes the projective raster scale from 16.25 to 4 amid
city paging and deeper-zoom WIP. Independent review found no complementary
change to the globe's projective helpers, imagery, or CSS.

The isolated trial changed exactly 756 generated texture-layer records: 448
exterior and 308 cutaway-shell leaves. Local nonpolar CSS boxes changed from
520×520 to 128×128, while source imagery, UV mapping, geometry, and the existing
maximum zoom of 8 stayed unchanged. Matrix composition remained equivalent
within `2e-12`; that numerical result did not establish raster quality.
These are local CSS dimensions, not measured GPU allocation or sample counts.

The trial fixture at `/Users/ekrof/fed/cssEarth-runtime-fixed-baseline` contains
main plus only that generator and scene change. All 972 other tracked files
and 1,971 public files matched the untouched baseline. Its scene SHA256 is
`b99fb56f5cac54be6ca6b54208fc9f59d6dabe669325d5dcd04a3fb48b46f00a`.
The fixture is preserved as diagnostic evidence, not an accepted baseline.

Its full headless run produced 96 repeatable conditions, 192 phase images,
and 576 sequence frames, with no capture errors. Independent checks verified
124 served-source hashes, 800 repository harness hashes, 76 prepared/manifest
fingerprints, 293 unique loaded assets, and all 44 Saturn coverage probes.
The record is `output/shared-runtime-visual-earth-fix/baseline/report.json`.
**Repeatability was not image-quality acceptance:** visual inspection found
stretched wedges across Tibet and western China at maximum zoom.

Eight matched close-ups of untouched main confirmed the wedges were introduced
by the scale-4 trial, not by the runtime refactor. See
`output/earth-raw-closeups-1/report.json`, particularly the matching
`earth-1440-scale1-maximum-normal-scene.png` images in both directories.
Raw main is smooth in that region; the trial is visibly stretched. These are
intentional-change diagnostics, not unchanged-pixel parity. The same trial
had passed 551 tests and the complete browser suite; those gates did not catch
this sampling regression.

Bounded headless diagnostics then injected alternative offline-prepared matrices
before module load, without changing application code. Scales 8 and 8.125 still
showed close-up stretching. Scale 16 gave different default-shell captures
across repeated contexts and failed to stabilize the mobile scene in both
repeats. Reports are `output/earth-raster-scale-diagnostic-{1,2}/report.json`.
No alternative was accepted. The likely boundary is Chrome's flattened raster
coverage/filtering; its exact GPU mechanism remains unproven.

The trial was withdrawn before the affine repair. At that point, Earth's
generator, scene, and existing preparation tests matched `91dae216` exactly;
the restored scene SHA256 was
`865e1b5e813c8de649b0050ddfca96c5d49708f291d02d2de6203d12cdd2f8b6`.
All six Earth preparation tests passed after that regeneration. No complete candidate
matrix was run against the rejected trial, and no 192-comparison pass is claimed.
The later affine repair supersedes that restored scene. Its independent
baseline qualification remains failed as described above; the branch pointer
alone did not supply a validated fix.

### Capture contract retained for the eventual comparison

The audit is `immutable-headless-native-readback-pairs@4`: installed Chrome,
hardware renderer/device identity, enabled GPU composition and rasterization,
zero GPU crashes, matched recorded repository harness inputs, and unchanged
served source hashes. It retains all 88 original conditions and adds eight
object-owned Earth exterior/cutaway close-ups at the existing maximum zoom,
two widths, and two display scales: 96 conditions and 192 phase comparisons.
No software-composited or headed result can qualify this protocol.

Run the complete comparison only with a qualified, explicitly identified
baseline. The eventual architecture comparison uses main plus the identical
Earth-only repair, not raw main: prepared-byte identity checks correctly reject
raw main paired with the repaired candidate. The current Earth-only fixture
still fails its independent repeatability check, so these are conditional
reproduction commands, not a completed or currently qualified comparison:

```sh
node tools/audit-shared-runtime.mjs baseline http://127.0.0.1:4281 \
  /Users/ekrof/fed/cssEarth-runtime-earth-affine-baseline output/shared-runtime-visual-new
# Only after the complete baseline has no errors:
node tools/audit-shared-runtime.mjs candidate http://127.0.0.1:4230 \
  /Users/ekrof/fed/cssEarth-runtime output/shared-runtime-visual-new
```

Use a fresh evidence directory for every attempt. Both recorded servers display
the same Git-derived `Version 0.6` build metadata. For a fresh reproduction,
keep that metadata matched too: apply the candidate diff without committing it
to a second checkout of the same base before starting its server. Do not mask
the label. The audit verifies the rendered label and served source hashes.
No complete baseline/candidate comparison qualifies this PR. Neither failed
raw-main captures, the rejected trial's repeatability, nor isolated calibration
counts as complete acceptance.

## Evidence limits

These checks establish behavior, ownership bounds, and browser regression
evidence. They do not establish native-renderer parity, physical memory
reclamation, or compositor performance gains. Synthetic visibility/lifecycle
events test ordering; only the separate navigation/back test claims real
back/forward-cache admission.

Raw visual evidence is preserved. Failed or nonrepeatable capture runs are
invalid qualification runs, not silently discarded passing results. Pixel
tolerance and masks must not be widened to hide a refactor regression.

Source inputs and all non-Earth prepared assets are unchanged. The authorized
Earth exception changes its preparation, manifest, generated scene and lens
metadata, and reproducible public assets as described above. There is no new
clock, scheduler, renderer, dependency, object registry, or placeholder object.
