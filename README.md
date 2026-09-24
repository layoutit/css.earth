# Surface label lifecycle refactor: evidence

Tested revisions: `main` at `56b10f9c4c` and the change at `880a23bee7` (refactor/surface-label-lifecycle).

## Replay oracle (`oracle.mts`, `oracle-report.json`)

`labels-main.mjs` bundles main's `surface-feature-labels.ts` and `labels-change.mjs` bundles this change's; both were built with esbuild from the tested revisions. The oracle mounts each in a linkedom DOM with a manual frame clock. It feeds Callisto's real prepared plan and 154-name catalogue (`public/scenes/callisto/callisto-features.json`), so population takes two batches (128 + 26). It records every catalogue request, `stats()` snapshot, `catalog()` size, number of written names, `loaded()` resolution or rejection, `onError` call and pending frame count.

It has 13 scenarios: labels off; load and populate; repeated requests while fetching; a flight holding the load until it lands; a replaced flight dropping it; an explicit load during a flight; network failure; HTTP 404; destroy while idle, held, fetching and populating; and the frame loop following play and the labels switch. All 13 are identical.

The oracle was checked by planting bugs in a copy of the change bundle. Loading after a replaced flight broke 1 scenario; doubling the batch size broke 7; never cancelling the loop broke 1.

## In the app (`app-main.json`, `app-change.json`)

These use headless Chromium against the same local dev server with each revision's renderer, captured twice per revision. Labels were switched on with the settings checkbox and the camera zoomed in with the wheel. On both revisions, Mars loads 1,941 names and places 8 of 9 eligible; Callisto loads 154 and places 10 of 10. The same names show, and screenshots are 0 changed pixels at threshold 0.1 and 0. Only the frame counter varies (±2), as it does between two runs of main. `callisto-labels.png` is the change's capture.
