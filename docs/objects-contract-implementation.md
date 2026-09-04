# Objects contract: Pluto implementation evidence

Delivery: one pull request on `feat/pluto-object-contract`. This document records
the local validation completed before PR publication. Merge and deployment are
outside this delivery step.

Worktree: `/Users/ekrof/fed/cssEarth-pluto`.
Base: `ba1efaf32da7d02bdf041006455e7735e9c0d074`.
The dirty primary checkout at `/Users/ekrof/fed/cssEarth` was not edited.

## Included

- A source-backed Pluto package and `/pluto/` route, with three observation
  lenses, prepared sky/Sun, retained DOM, and the full interaction contract.
- Factual classification in the sole `OBJECTS` registry. Search includes every
  object; the planet-only scale is classification-derived.
- Provider-neutral package closure validation. The existing NASA importer still
  validates all ten of its checked snapshots. Pluto owns its NASA/JPL inputs.
- Object-owned marker presentation for all eleven packages, one generated
  atlas/presentation table, and no planned-object marker fallback.
- Negative package/marker tests, reproducibility tests, and real-browser
  navigation through every object on desktop and mobile.

No runtime renderer, shared camera/input policy, lifecycle, router, or adapter
changed. No production dependencies or capability flags were added. Pluto's
fit and source limits are in `src/planets/pluto/FIT.md` and `SOURCE.md`.
Every mount uses one canonical highest-density prepared asset bank. Browser
screen scaling is a test condition, never an asset-selection mode.
The five verbatim upstream HTML/label snapshots are exempt from Git whitespace
linting so their pinned bytes stay intact. Authored code and documents remain
subject to the whitespace check.

## Adversarial review repairs

All three actionable review findings are addressed in this same change:

- Navigation preparation renders every atlas and utility marker in an isolated
  staging directory before publishing the presentation table or any assets.
  A failed publication restores the previous files, including obsolete markers;
  newly created files are removed. Tests cover corrupt object inputs, failure
  at the final utility source, and a late publication failure. This is an
  offline preparation safeguard, not a crash-atomic live release system.
- Marker scale overrides are checked both as partial values and as a complete
  merged presentation. An override cannot introduce rings without their
  required dimensions. Valid inherited Saturn-style overrides remain valid.
- The visual audit requires three consecutive identical captures within a
  bounded 24-capture settling window, checks the
  shell again after hiding and restoring it, and rejects unsettled evidence.
  It compares both scene and shell pixels at every viewport and screen scaling
  condition. Only the measured marker image rectangles, including a fixed
  one-physical-pixel antialias fringe, may differ. Their geometry must match,
  each stays small, and the scene comparison has no mask.
  A negative test proves that a missing scene rectangle fails this gate.

The earlier `object-contract/baseline/saturn-1440-dpr2-shell.png` is **INVALID**:
it omitted a rectangular part of Saturn's rings. The corrected gate rejects
254,492 changed pixels outside all marker exclusions when comparing it with
the fresh baseline. The old files remain untouched for diagnosis; they no
longer support shell acceptance. This was a capture defect, not evidence of a
candidate renderer regression.

Intermediate audit failures are also retained. The unchanged baseline exposed
a one-level red-channel fluctuation at one scene pixel; its eight raw samples
are under `object-contract-review-final-20260904/baseline/`. That justified a
longer settling window, not a pixel-difference allowance. The earlier candidate
attempts under `object-contract-review-fixed-20260904/` include an unsettled
capture and the marker-edge diagnostic. All 30 edge pixels lie within one
physical pixel of the measured marker boxes; the footprint diagnostic is in
`review-fixes-marker-footprint-diagnostic.json`. It is not replacement evidence.

## Baseline and narrowly scoped repairs

The initial preparation exposed a missing `textureTintFactors` import in the
Earth preparer. The one-line import is included; no Earth renderer changed.
An initial full preparation also changed some accepted asset bytes. Those
regenerated banks are not used as acceptance evidence or included in the diff.
The exact accepted Earth, Mars, and Saturn banks were restored only after every
file matched the base commit's byte count and SHA-256 manifest.
The matching accepted Saturn staging inputs were restored as well; its 40
package tests verify their hashes and exact decoded correspondence to the
deployed atlas. Neither those staging inputs nor the restored runtime banks
introduce tracked changes.

The untouched base was served from `/Users/ekrof/fed/cssEarth-pluto-baseline`
on port 4211 for fresh Saturn captures. Its process CWD was checked. That
server was stopped before serving the candidate from its own worktree on the
same port. The user's primary server on port 4210 was left alone.
`object-contract/runtime-source-binding.json` independently checks every Saturn
runtime file and its asset manifest against the baseline worktree, and verifies
both capture reports' fingerprints. All 13 files match. The audit script also
accepts an explicit served-worktree path so future runs bind the right checkout.

Venus's existing browser rebase scenario failed both on the base and candidate.
Its default zoom, 1.9, multiplied by the fly-to factor, 2.33, exceeds maximum
zoom 4. Wheeling inward leaves the clamped target unchanged by design. The
test now wheels outward, keeping its exact-one-rebase assertion and all other
assertions. There is no runtime fix or waived interaction requirement.

A second Venus assertion also failed on the untouched base. Its "short" 150 px
pitch gesture rotates about 44.5 degrees at zoom 1 and changes material frame
30 to 26. That test now uses 30 px (under 9 degrees), preserving the original
one-frame maximum and the subsequent wide-drag/free-orbit assertions. Both
baseline failures and the measured camera/material state are retained in
`pluto-venus-smoke-baseline.log` and `pluto-venus-material-diagnostic.log`.

## Evidence

Evidence is local under `output/playwright/`; it is regenerated by the checked
audit scripts, not treated as an unchecked readiness declaration.

| Check | Evidence |
| --- | --- |
| Source closure | `review-fixes-acquire.log`: all 11 packages, Pluto 9 inputs and 5 metadata/license documents. |
| Pluto package | `pluto-package-test.log`, `pluto-focused-tests.log`: source identity, signed DEM/no-data, runtime closure, retained scene, three lenses. |
| Reproduction | `pluto-reproduction.json`: two complete Pluto prepares produced identical hashes for all seven generated modules/manifests; the runtime manifest binds all 43 assets. |
| Chrome source binding | `pluto-visual/report.json`: actual response bytes verified against the manifest, 23 loaded assets per screen condition across all lenses, no external requests or page errors. |
| Pluto visuals | `pluto-visual/`: source references, full shell, and 18 lens/view/screen-condition scene captures. Source-map/globe pixel parity is not claimed. |
| Saturn regression | `object-contract-review-accepted-20260904/{baseline,candidate}/report.json`: all 12 scene/shell comparisons pass at widths 390/820/1440 and both screen scaling conditions. Zero changed scene pixels; zero shell changes outside marker footprints. All 13 runtime/manifest files match, and all 38 loaded asset hashes and selections match in every capture. |
| Saturn playback | `object-contract/{baseline,candidate}-playback.json`: matched Chrome 152.0.7977.76, 1,918 stable nodes, six advancing animations, three 2-second samples per screen condition, zero layouts. |
| Browser behavior | `review-fixes-browser.log`: full shell, introductions, 22 desktop/mobile navigation selections, shared conformance, and all 11 package-specific suites pass. No skipped target requirements. |
| Unit tests and build | `review-fixes-final-test.log`: all 351 tests pass after the final audit refinement, zero failures/skips. `review-fixes-build.log`: 12 pages built and all 11 object asset packages assembled. |

The Pluto runtime contains 931 stable stage nodes and one camera in both screen conditions.
The observed 3-second rAF/CDP samples produced 180 intervals and about 16.7–16.8
ms p95. These are short diagnostics, not compositor frame-drop, power, or
native-timing parity proof. The report preserves that qualification.

Matched Saturn playback samples have 16.7–16.8 ms rAF p95 on both builds.
CDP task duration per 2-second sample ranges from 35.5–58.0 ms on the base and
33.3–52.1 ms on the candidate. These short samples show no observed retained-DOM,
layout, or rAF regression; they do not establish a performance improvement,
compositor smoothness, or power equivalence.

The full-shell audit does not exclude navigation panels, text, or broad scene
regions. Its narrow marker exclusions are recorded in each capture report.
The absolute-diff images retain all differences, including intentional marker
changes. The independent scene comparison requires zero changed pixels.

The accepted run uses headless installed Chrome 152.0.7977.76. Raw shell changes
are 532/532/1,164 pixels at standard screen scaling and 2,098/2,098/4,548 at
doubled screen scaling, ordered by viewport width. Every changed pixel is within
a measured marker footprint. The full Saturn scene is pixel-identical in all
six comparisons. No image was edited to obtain these results.

To repeat the audit, use a new shared evidence directory. Serve each specified
worktree on the same URL in turn; do not run these against a stale server:

```sh
node tools/audit-object-contract.mjs baseline http://127.0.0.1:4211 /Users/ekrof/fed/cssEarth-pluto-baseline output/playwright/new-contract-audit
node tools/audit-object-contract.mjs candidate http://127.0.0.1:4211 /Users/ekrof/fed/cssEarth-pluto output/playwright/new-contract-audit
```

The script refuses to overwrite an existing capture directory. It checks
browser-loaded asset bytes, source fingerprints, marker geometry, capture
stability, and the identical bank selection across display conditions.

## Final gates

Run from the implementation worktree against its own server:

```sh
pnpm acquire:planets -- --verify-only
pnpm test
pnpm build
pnpm test:browser http://127.0.0.1:4211
git diff --check
```

Review-fix status (2026-09-04): source verification, all 351 unit tests, the
production build, the aggregate Chrome suite, and whitespace checks pass.
All 12 final matched scene/shell comparisons pass. The full unit suite was
repeated successfully after the final capture-window refinement.

All three actionable adversarial-review findings are fixed. The unchanged
renderer, one highest-density asset bank, and prior source/parity qualifications
remain intact. Ready for review as one PR-sized change.

This remains one PR-sized change. No merge or deployment has been performed.
The local preview is `http://127.0.0.1:4211/pluto/`.
