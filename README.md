# Camera input refactor: evidence

Tested revisions: `main` at `cc7768064e` and the change at `194e7ef81d` (refactor/camera-input-gesture).

## Replay oracle (`oracle.mts`, `oracle-report.json`)

`controls-main.mjs` bundles main's `camera-input.ts` and `controls-change.mjs` bundles this change's. Each bundle includes its own `camera-motion.ts`; both were built with esbuild from the tested revisions. The oracle drives both with identical scripted input on a fake surface, window and frame clock, using the site's runtime policy and a fixed trackball. It records every `rotate()` call, onStart/onEnd, dispatched event (rotation changes and the pinch's synthetic wheels), pointer capture and release, cursor write, prevented default and `stats()` snapshot. Run with `node oracle.mts` beside the two bundles and `site/runtime-policy.mts`.

It has 20 scenarios: surface, sky and touch throws; gentle flicks under the 30°/s pitch and 90°/s yaw caps; a slow release; pointer cancel; a press or wheel interrupting inertia and fly-to; wheel during a press; a double-click fly-to that lands (230 frames); Escape and a hidden page during fly-to; pinch; disable/enable, stop and trackball invalidation; destroy during inertia; and coalesced samples. All 20 are identical. The report lists, per scenario, how many inertia and fly-to frames it exercised.

The oracle was checked by planting bugs in a copy of the change bundle. Doubling the per-frame pitch delta broke 9 scenarios; dropping the rotation-start event broke 13; scaling accumulated yaw (1.5×) and pitch (2×) each broke a gentle-flick scenario.

## In the app (`app-pixelmatch.txt`)

These use headless Chromium against the same local dev server with each revision's renderer build, captured twice per revision. The double-click fly-to on Earth and a slow drag are 0 changed pixels at threshold 0.1 between main and the change. Flicks vary from run to run in a real browser, because pointer timing is not replayable: main differs from main by up to 54,476 pixels at 0.1. Main against the change stays inside that noise, so the oracle above is the evidence for flicks. No page errors.
