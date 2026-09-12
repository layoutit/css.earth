# One owner for scene opacity

The September 10 `Trace-20260910T080437` capture includes browser opacity
animation work before the world rAF and a 20.42 ms style update afterward.
The source had CSS transitions re-interpolating values already interpolated by
JavaScript. The trace does not attribute all of that style cost to opacity.

## Publication

Each retained scene leaf has one numeric opacity writer. It combines the
camera/admission alpha, classification and hover/selection weight, and flight
suppression into one inline value. The existing 200 ms linear admission fade
and 120 ms eased emphasis/suppression remain explicit. Removing the second CSS
interpolation intentionally removes its extra lag.

A mount-owned clock runs completed world-camera commits before flushing their
final alpha values. The world context, point field, and environment captions
share that clock. Fade-only ticks never request worker projection, rebuild
picking, measure labels, or republish transforms. Each element receives a write
only when its final numeric opacity changes. Culled, fully suppressed, and
settled entries leave the active set; revealing one samples current wall time.
The DOM, prepared assets, and geometry remain retained.

Classification weights come from the existing object registry and preserve the
previous CSS values. CSS still owns the authored 120 ms circle padding change;
it no longer transitions scene opacity or supplies dynamic opacity variables.
No WAAPI or SVG was introduced. Existing detailed-body prepared pose/rotation
playback is outside this change.

## Validation

- Renderer type checking and all 448 renderer tests passed.
- All 76 focused navigation, router and marker checks passed.
- Performance build completed: 814 pages and 406 assembled object packages.
- Headless Chrome compared the baseline (4244) and candidate (4245), at the same
  overview camera and after Mars focus. All 649 compared orbit segments had
  exactly equal endpoints and trail weights. Colors, stroke widths, annotation
  opacity, fonts and bounds matched. DOM counts and reported layer bounds also
  matched. These are settled-state checks, not a frame-rate claim.
- Native wheel/click navigation Sun → Mars → Earth → Sun, followed by dragging,
  completed without page errors. World, input and document identities were retained;
  all journey checkpoints had one camera and zero scene opacity animations.
- In both candidate checkpoints, active fades and browser opacity animations
  on scene annotations were zero.

Evidence and the executable browser checks are in
`output/playwright/opacity-ownership/`. `source.json` records source hashes;
`geometry.json` and `comparison.json` record the matched views;
`interaction.json` records native wheel/click navigation and retained identities.
The manual trace candidate is `http://127.0.0.1:4245/sun/`; 4244 remains the
previous baseline. No merge readiness or dropped-frame improvement is inferred
from these checks. The next manual trace measures that outcome.
