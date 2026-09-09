# SVG orbit paint-area investigation

SVG is a local orbit-annotation experiment, not a shipped renderer change.
It uses retained `path` elements grouped by prepared opacity, not `use`.
Detailed bodies remain PolyCSS. The user permits sparse SVG use and different
edge antialiasing; missing orbit segments remain a regression.

## Measured transparent area

At approximately 50 AU, Chrome's layer snapshot replay for the SVG Jupiter
orbit is 2,082 × 1,414 pixels. Of 2,943,948 pixels, only 1,511 have nonzero alpha:
1,508 partially covered and three opaque. **99.9487% is transparent.**
Other sampled orbit layers are also sparse: Fornjot has 37 nonzero pixels in
a 2,109 × 1,427 replay; Makemake has 610 in a 2,289 × 1,236 replay.

These are actual alpha counts from isolated layer replay PNGs. They do not
prove that every transparent pixel is rasterized on every frame. Replay omits
parent opacity and occlusion, and layer dimensions are not GPU allocations.
The trace's raster tasks do not include tile dimensions. Paint clip areas are
local-coordinate bounds, can overlap, and sometimes represent unbounded clips.
They must not be summed and reported as unique painted pixels.

The diagnostic uses Chrome's `LayerTree.layerTreeDidChange`, `makeSnapshot`
and `replaySnapshot` APIs. `layerPainted` produced no events in these captures;
timestamped trace `Paint` records remain the paint-event authority. See the
[LayerTree protocol](https://chromedevtools.github.io/devtools-protocol/tot/LayerTree/).

## Synchronized evidence

All three short captures use source commit
`0d554631f42d33ca4b4046a901f8fba9c1f355fd`, including main through #76.
They start at 50 AU, zoom out with 24 native wheel events, perform a reversible
drag, then zoom back with 24 native wheel events. Viewport: 1,995 × 1,236 CSS
pixels, DPR 2, Canary 155.0.8048.0, motion off. These are bounds diagnostics,
not replacements for the full Sun–Milky Way–Sun acceptance route.

Each capture has recorder JSON, Chrome trace gzip, contemporaneous video,
69 verified source hashes, response receipts, and `layer-area.json`.
The baseline has no response patch; each SVG experiment has exactly one.
All synchronization checks pass, with no page errors, HMR, trace loss or
retained-camera violations. The local artifacts live under
`output/world-context-zoom/` and have not been published.

| Capture suffix | Recorder | Main-frame p95 | Raster tasks | Video frames |
| --- | --- | ---: | ---: | ---: |
| `main76-paint-bounds-html-dpr2` | `ee575bec-9b18-4468-93cd-fdc9432d9d1d` | 24.544 ms | 11,497 | 812 |
| `main76-paint-bounds-svg-dpr2` | `61a36d29-0f4c-4ad1-b3a5-bf6f0261f809` | 23.433 ms | 16,848 | 771 |
| `main76-paint-bounds-svg-compact-dpr2` | `9d17b7a5-052b-448b-a3ad-00611d22fbdf` | 24.491 ms | 14,936 | 891 |

These runs do not establish a reliable SVG speedup. Host load differed and
rose substantially during the compact trial; native input durations and frame
counts also differ. Layer-tree instrumentation adds work. All three p95 values
remain above a 60 Hz frame budget. The full earlier SVG trial that hid empty
viewports reached 16.786 ms p95, but ran on older main content and is not a
qualification of the current integrated branch.

## Compact viewport experiment

Changing the SVG viewport from `100% × 100%` to `1px × 1px` with visible overflow
reduced reported layer bounds, but the full-size screenshots show lost faint
outer orbit segments. Calling this only an edge-pixel difference was incorrect.
The compact trial is rejected on content preservation, independently of timing.
Its lower raw layer area does not qualify it as an optimization.

The regular SVG trial has visibly different stroke antialiasing and alignment.
The comparison shown to the user is
`output/playwright/svg-edge-comparison/edges-8x.png`: original screenshot
colors, nearest-neighbor 8× enlargement, with source hashes and exact crop
coordinates in `provenance.json`. Antialiasing differences alone are now
acceptable; geometry, content, emphasis and interaction still need verification.

## Next decision

Any continued SVG experiment must bound real drawing without the compact
viewport's culling regression, and measure raster/layer work alongside frame
delivery. `use` can reuse a definition, but definition reuse is not evidence
that a large transparent layer disappears. There is no reason to replace each
distinct projected orbit with `use` without a concrete reusable definition.
Do not ship the current prototypes or call PR #50 merge-ready from these results.

## Latest main integration

Main through `83f1b66bb` is integrated at `9381aa75f`. Its overview-flight marker
and orbit-cutout behavior is carried into this branch's worker planner and DOM
publisher. The three new comet orbit bounds and chord orders are baked through
the existing preparation entry point. All 304 runtime transport payloads
reproduce their checked-in descriptor hashes; 296 stale or missing local JSON
files were restored from those validated payloads without changing descriptors.

Validation: 77 focused world-context/planner tests and 64 navigation/shell tests
pass; package, preparation and renderer builds pass. The aggregate renderer
suite remains at 400 passing and nine failing tests in the same four fixture
files. The contrast browser test reaches the loaded Mercury scene after payload
restoration but cannot complete: main intentionally hides the Settings button
that the test tries to click. No production UI was changed to make that test pass.
The merged branch is still a draft, not merge-qualified.
