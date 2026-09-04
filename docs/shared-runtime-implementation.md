# Shared runtime implementation

This implements the [approved proposal](shared-runtime-architecture-proposal.md)
in one architectural PR. It covers the Sun, Mercury, Venus, Earth, Moon, Mars,
Jupiter, Saturn, Uranus, Neptune, and Pluto.

Status: implementation, independent code reviews, and full functional gates
are complete. Strict matched visual acceptance is **blocked**. The PR is a draft,
not ready to merge; the proposal's visual requirement has not been waived.

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
compositor wrapper, prepared scene generation, and asset banks are unchanged.
Both tested display scales use the same highest-density bank.

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
| Actual back/forward-cache admission | `site/test/runtime-bfcache-browser.mjs`, including `pageshow.persisted` and document identity |
| Matched scene/shell regression | `tools/audit-shared-runtime.mjs`: Chrome version, prepared hashes, loaded-response hashes, raw captures, absolute differences, and Saturn coverage |

## Local acceptance record

Implementation checkout: `/Users/ekrof/fed/cssEarth-runtime`.
Base: `4ba3c3c526abdfcf6c26def7fd635451f2d08eea` (`main`).
Candidate server: `http://127.0.0.1:4230`.
The reports below are local ignored artifacts, not hosted CI or independent
approval. Source hashes bind browser evidence to the uncommitted implementation
that was served; final commit identity is recorded by the PR.

| Gate | Result | Local report |
| --- | --- | --- |
| `pnpm acquire:planets -- --verify-only` | Pass | `output/runtime-source-verify-accepted.log` |
| `pnpm test` | 551 passed; none skipped | `output/runtime-unit-tests-final-head.log` |
| `pnpm build` | Pass | `output/runtime-build-accepted-2.log` |
| `pnpm test:browser http://127.0.0.1:4230` | Pass, exit 0 | `output/runtime-browser-accepted-2.log` |
| Matched visual regression | **Blocked: baseline is not repeatable** | `output/shared-runtime-visual-accepted/baseline/report.json`; see below |
| `git diff --check` | Pass during acceptance; repeat before commit | Git working tree |

The full browser run used installed Google Chrome `152.0.7977.76`. It passed
shared shell, introduction, and navigation gates; all 143 object conformance
cases; 22 playback cases; six complex/deferred-selection cases; real
back/forward-cache restoration for all eleven objects; and all eleven
package-specific browser suites. Both display scales loaded the same canonical
highest-density bank.

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

## Visual qualification blocker

The untouched baseline at `4ba3c3c526abdfcf6c26def7fd635451f2d08eea`
was served from a clean detached worktree,
`/Users/ekrof/fed/cssEarth-runtime-baseline`, at `http://127.0.0.1:4261`.
All 1,941 runtime assets were verified against its manifests. Both servers
displayed `Version 0.6`; an earlier server's stale `Version 0.1` label was not
treated as a rendering regression or masked out.

Chrome `152.0.7977.76` could not produce a repeatable full baseline matrix.
Some paused captures differed by one channel level; others omitted large
rectangular texture or shell regions while camera, animation times, prepared
image URLs, and computed styles remained unchanged. These are failed
qualification runs, not accepted visual comparisons.

The audit keeps immutable capture conditions, settles before each screenshot,
preserves both ordered phases, and requires three identical pairs before
comparison. It verifies prepared hashes and actual loaded-response hashes,
records source hashes, refuses evidence overwrite, compares both phases with
zero pixel tolerance, and checks Saturn body/ring coverage. It does not select
a favorable phase or use masks. Local Sun/Earth calibration runs passed in
isolation, but the full matrix still failed. Isolated success does not qualify
the complete PR.

A bounded check with preinstalled Chrome Canary `155.0.8041.0` also failed.
Native Apple M3 Max / Metal / Graphite rendering, GPU composition/rasterization,
and zero GPU crashes were verified. Sun matched across two fresh contexts, but
Earth produced 43 distinct images in 48 captures, including visibly missing
regions. The check stopped before Saturn. Evidence is local:
`/tmp/cssearth-canary-native-proof-FcQ9E6/report.json`, with raw numbered images
and the failed frame-sequence package beside it. Browser-backend overrides
that fell back to software were rejected; none are application changes.

To reproduce the full baseline attempt from the implementation checkout:

```sh
node tools/audit-shared-runtime.mjs baseline http://127.0.0.1:4261 \
  /Users/ekrof/fed/cssEarth-runtime-baseline output/shared-runtime-visual-new
# Only after the baseline has no errors:
node tools/audit-shared-runtime.mjs candidate http://127.0.0.1:4230 \
  /Users/ekrof/fed/cssEarth-runtime output/shared-runtime-visual-new
```

Use a fresh evidence directory for every attempt. Do not interpret the current
failed report as visual parity, Saturn coverage approval, or merge readiness.
Unblocking requires a qualified repeatable capture path and a complete matched
baseline/candidate run, or an explicit decision to revise the acceptance gate.
No such revision has been made.

## Evidence limits

These checks establish behavior, ownership bounds, and browser regression
evidence. They do not establish native-renderer parity, physical memory
reclamation, or compositor performance gains. Synthetic visibility/lifecycle
events test ordering; only the separate navigation/back test claims real
back/forward-cache admission.

Raw visual evidence is preserved. Failed or nonrepeatable capture runs are
invalid qualification runs, not silently discarded passing results. Pixel
tolerance and masks must not be widened to hide a refactor regression.

No source inputs, runtime asset manifests, prepared scene modules, or public
asset bytes are regenerated by this change. There is no new clock, scheduler,
renderer, dependency, object registry, or placeholder object.
