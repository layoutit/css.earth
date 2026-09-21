# Prepared orbit stroke groups

Current paint architecture (2026-09-12): every orbit's planned chords are drawn
by one `<path>` per trail-opacity level inside a `<g>` per orbit, all in a single
`<svg>` per world context (`prepared-orbit-lines.ts`, renderer `strokes`). The
worker still projects, clips and cuts the chords; the main thread formats one
`d` per changed level, so a camera frame writes a few strings per orbit instead
of one transform per chord, and the whole orbit bank is one paint chunk. The
retained CSS unit-bar owner (`bars`) remains as a low-level fallback and benchmark
comparison; the application has no renderer selector and always mounts `strokes`.
Measured with the same recorded motion on
the Solar System overview (per-frame task medians, user traces): CSS chords
6.2 ms, one SVG per orbit 3.8 ms, shared SVG 3.0 ms; prebaked arc images placed
in 2D (3.9 ms) or 3D (3.7 ms) did not beat it, and static 3D chord leaves behind
one transform cost 14 ms because every 3D leaf is compositor work.

The rest of this note is the record of the earlier SVG bank experiment
(one path per prepared material, 9,465 retained paths) and its 2026-09-10
replacement by CSS bars; the measurements below apply to those builds.

The world orbit renderer retained 240 independently styled bars per orbit: 97,200
bars for the current 405 orbits. Camera projection generated a CSS matrix for
every displayed chord, and publication changed bar transforms and visibility.
Retaining that topology avoided DOM reconstruction but still left substantial
style, prepaint and layer-tree work in each camera update.

Each orbit now owns a stable SVG stroke bank inside its existing wrapper. Offline
preparation enumerates the exact authored opacity materials, including the full
orbit used on hover. Rendered satellite systems already use uniform full orbits;
their bank contains one stroke. The current bank contains 9,465 paths, including
103 single-stroke orbits. Paths are anonymous and their material opacity is set
once at mount. No `use`, masks, gradients, filters or extra image assets are used.
Detailed bodies continue to use PolyCSS.

## Ownership

- **Preparation:** source ellipse vertices, trail weights, bounds, hierarchy,
  material groups and the maximum clipped chord count.
- **Worker:** existing view projection, clipping, occlusion, label decisions and
  marker cutouts. It formats the same projected chord endpoints as disconnected
  `M/L` subpaths, grouped by their prepared material. It no longer formats a CSS
  matrix for every chord of these orbits.
- **Publication:** retain every path; change only a path's `d` when its value
  changes. Resize its fixed viewport only when the scene viewport changes. Keep
  existing orbit opacity, colors, one-pixel stroke width, picking and depth order.
- **Diagnostics:** count actual nonempty paths from maintained owner membership,
  without scanning every path at each recorder sample. Empty paths remain in the
  retained-leaf count. They are not silently omitted from the census.

The free camera still requires view projection. Source geometry is not generated
at runtime. A single CSS-transformed orbit image would also scale the stroke with
perspective and zoom, changing the existing one-pixel presentation. The retained
stroke bank reduces browser ownership while preserving that presentation.

Older banks without stroke metadata keep their original bar representation. All
405 orbits in the current prepared world bank use the new representation.

## cssGraphics evidence used

Reference revision: `a16aa807b252607130ec56249d2d9ccd3c4ba802`. These are the
main-line source and its recorded qualification results; website deployment was
not inferred from the repository.

- [Galaxy publication](https://github.com/layoutit/cssGraphics/blob/a16aa807b252607130ec56249d2d9ccd3c4ba802/src/adapters/galaxy/src/cssgalaxy/polycssScene.mjs):
  prepared snapshot topology, cached element bindings and sparse direct writes.
- [Flocks performance review](https://github.com/layoutit/cssGraphics/blob/a16aa807b252607130ec56249d2d9ccd3c4ba802/src/adapters/flocks/README.md):
  324 retained roots and 1,944 leaves, with three qualified desktop traces and
  explicit geometry, color and DOM identity checks. Its recorded p95 range is
  16.667–16.720 ms; this is evidence for that adapter, not a cssEarth forecast.
- [Cityflow performance review](https://github.com/layoutit/cssGraphics/blob/a16aa807b252607130ec56249d2d9ccd3c4ba802/src/adapters/cityflow/README.md):
  prepared material/transform tables, suppressed redundant writes and a full-loop
  layer census. The review distinguishes qualified normal playback from a
  diagnostic-only CPU stress trace.

These examples motivate smaller stable publication surfaces. cssEarth's free
camera and screen-width orbits prevent copying a prerecorded transform schedule.

## Validation

Exact build and capture evidence is under
`output/playwright/prepared-orbit-batches/` and
`output/playwright/navigation-consistency/`.

- Removing only the new `strokes` fields from the regenerated world bank produces
  a deep-equal copy of the baseline JSON. Source geometry and all previous facts
  are unchanged.
- The full renderer suite passed 459 tests. The final focused publication,
  projection, clipping, material and diagnostic tests passed 100 tests. World
  preparation passed 462 tests. Renderer and preparation typechecks passed.
- The broader preparation suite cannot fully qualify this checkout: source
  assets used by other object-package tests are absent, including archived
  observations and NASA shape models. Those inputs were not replaced or faked.
- Matched overview, hover and portrait checks preserve every displayed chord,
  color, width, opacity and annotation. Endpoint differences are below 0.001 px
  from CSS matrix serialization versus path coordinates. SVG edge antialiasing
  is the accepted visual difference.
- The initial overview comparison has 649 displayed segments in both builds.
  World-context descendants fall from 102,470 to 12,305. Drawn compositor layers
  fall from 591 to 537. Summed layer bounds fall from 21.15 to 19.63 million square
  pixels; these bounds are **not** a measurement of painted alpha or GPU memory.

The final DPR 2 comparison also preserves every segment and annotation at both
1995×1236 and 700×1000 CSS pixels. An actual pointer hover on Mars's orbit sets
the pointer cursor and the existing 2 px circle growth. Clicking that orbit
selects Mars and displays its sidebar while the flight is still running; all
12,305 world-context descendants retain their identities through the flight.

The natural Sun → Mars → Earth → Sun journey passed twice in one document,
using real wheel input and scene picks. All six selections occurred before their
flights completed. The shared world, input surface and document were retained;
one camera remained mounted. No browser errors or Chrome trace data loss were
reported. See `orbit-batches-navigation-final/report.json` and the trace/recorder
artifacts beside it. No video recording was enabled.

## Repeat measurement and manual handoff

Chrome 152.0.7977.84, headless, 1995×1236 CSS pixels, DPR 1. Both builds received
the same two 32-step drags and 36 wheel packets from the same recorded overview.
Build bytes, trace and recorder IDs, and both clock anchors were verified by the
capture processor. The adaptive dispatch produces different elapsed durations;
browser-work figures below are normalized per second, not raw totals.

| Metric | Before | Final candidate |
| --- | ---: | ---: |
| Presentation p95 | 29.720 ms | 26.109 ms |
| Presentation p99 | 39.181 ms | 34.831 ms |
| Longest presentation interval | 60.083 ms | 51.547 ms |
| Style work | 82.574 ms/s | 67.409 ms/s |
| Layout work | 16.244 ms/s | 20.637 ms/s |
| Paint work | 30.561 ms/s | 28.816 ms/s |
| Layer-tree work | 174.924 ms/s | 95.781 ms/s |

This final pair is `orbit-batches-before-3` versus
`orbit-batches-after-final`. An earlier valid pair, `orbit-batches-before-1`
versus `orbit-batches-after-2`, showed the same direction: p95 27.975 → 26.812 ms,
style 87.944 → 68.589 ms/s, and layer-tree work 180.332 → 91.096 ms/s. Layout rose
slightly in both comparisons. These repeated local results support the structural
change; they do not establish universal smoothness or a completed 16.6 ms target.

The comparison chart uses the processor's existing 500 ms rolling average. Only
Chrome-explicit idle gaps are eligible for exclusion; these two captures had
zero such exclusions. Real hitches remain in the data and chart.

- Final chart (`output/playwright/prepared-orbit-batches/performance-comparison.png`, local run output, not tracked)
- Processed final comparison (`output/performance/trace-briefs/orbit-batches-after-final/report.html`, local run output, not tracked)
- DPR 2 geometry/appearance checks (`output/playwright/prepared-orbit-batches/final-dpr2/comparison.json`, local run output, not tracked)
- Actual orbit hover/click check (`output/playwright/prepared-orbit-batches/orbit-click.json`, local run output, not tracked)

Excluded exploratory captures: `orbit-batches-after-1` used the wrong local
directory for served-file verification; `orbit-batches-before-2` had a mistyped
view URL. Neither is used in the performance comparison.

Manual trace candidate: `http://127.0.0.1:4247/sun/`, serving
`output/playwright/prepared-orbit-batches/site` from this worktree. The frozen
baseline remains on 4246. Final prepared-world SHA-256:
`c216db5e8a01f0ae19128feeab6319298bd68dbecec54919233777250dd36478`.
