# Object mount lifecycle refactor: evidence

Tested revisions: `main` at `00dd7e2fc8` and the change at `47b14edcd8` (refactor/object-mount-lifecycle).

## Replay oracle (`oracle.mts`, `oracle-report.json`)

`runtime-main.mjs` bundles main's `object-runtime.ts` and `runtime-change.mjs` bundles this change's; both were built with esbuild from the tested revisions. `object-runtime.oracle-harness.mts` is the unchanged fixture from `src/platform/object-runtime.test.mts`: real residency, selection and playback, with controlled image decodes, orbit, document and paint waits. It is exported through the harness's existing `runtimeFactory` option; to run it, place it beside that test file.

For each scenario the oracle records the `ready` outcome, `onError` calls, lifecycle events, whether `navigation` and `datasets` are exposed, `sharedView.capture()` and `detailActivated()`. It has 12 scenarios: startup; dataset selection with pause and resume; destroy before the document is ready, while decodes never settle, and after activation before the paint; a failed decode; a fatal orbit error before and after readiness; a cleanup failure; a warm decode failure; a shared view restore; and a double destroy. All 12 are identical.

The oracle was checked by planting bugs in a copy of the change bundle. Reporting fatal errors after activation instead of after readiness broke 1 scenario; not resolving `ready` on destroy broke 3. `detailActivated()` is reachable only through `navigation`, which is exposed at readiness, so the activated-but-not-ready moment is covered by reading the code rather than by the oracle.

## In the app (`app-pixelmatch.txt`)

These use headless Chromium against the same local dev server with each revision's renderer. Each view loads Earth, Earth on a phone, Mars or Saturn, or flies Earth → Mars or overview → Jupiter through search. Main was captured twice and the change three times. Every view is 0 changed pixels at threshold 0.1 between main and the change. One of the three change runs of the Jupiter flight caught a marker's selection one frame later (266 pixels); the other two match main exactly. Saturn's world-context markers mounted in one main run and not the other, which is timing on main.
