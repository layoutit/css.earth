# Selection request lifecycle refactor: evidence

Tested revisions: `main` at `16e036bc87` and the change at `57b304a65a` (refactor/selection-request-lifecycle).

## Selection runtime oracle (`selection-oracle.mts`, `selection-oracle-report.json`)

`selection-main.mjs` and `selection-change.mjs` bundle each revision's `object-selection-runtime.ts` (esbuild). `object-selection.oracle-harness.mts` is the fixture of `src/platform/object-selection-runtime.test.mts`: Earth's real prepared plan, real residency and presentation, with controlled decodes and timers. The runtime under test is injected, and the intent `onCommit` receives is recorded. For every state change, commit (lens, speed, intent), fatal or material error, decode request and `stats()` snapshot, both revisions must match. The new `committedBy` field is left out of that comparison and checked instead against the intent of the latest commit.

It has 15 scenarios: startup; an A/B/A race; three quick lenses; view changes during decoding; a nearer globe that asks for finer material (frame requests, 3 commits); a lens superseding a frame request, and the reverse; a decode failure and retry; an aborted and an already-aborted signal; a dispatch that must not frame the camera; destroy during startup and with a pending lens; deferred refinement; and a view change during a supersede. All 15 are identical, with no `committedBy` mismatches.

Bugs planted in a copy of the change bundle were caught. Counting a frame request as pending broke 3 scenarios; not resetting `desired` when a request ends broke 2; recording the wrong intent produced 34 `committedBy` mismatches.

## Mount oracle (`runtime-oracle.mts`, `runtime-oracle-report.json`)

`runtime-main.mjs` and `runtime-change.mjs` bundle each revision's `object-runtime.ts` together with its own selection runtime. They run through the fixture of `src/platform/object-runtime.test.mts` (`object-runtime.oracle-harness.mts`), with the same records as the #711 oracle plus camera flights and camera resets. Four scenarios cover the commit's camera intent. A user lens action through the controls resets the camera. A programmatic dataset switch does not. A startup from a saved camera keeps it. A default startup may frame. All 16 scenarios are identical. Planted bugs were caught: ignoring the saved camera broke 1 scenario, and ignoring `frameCamera` broke 2.

## In the app (`app-comparison.txt`, `app-main.json`, `app-change.json`)

These use headless Chromium against the same local dev server with each revision's renderer, captured twice per revision. The flows are: Mars switching to Elevation, Thermal and back; three rapid dataset clicks; and Earth zoomed in until it refines from texture level 2 to 3. The selection state after every step matches, and every screenshot is 0 changed pixels at threshold 0.1 and 0. `mars-elevation.png` is the change's capture.
