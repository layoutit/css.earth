# Shared selection presentation evidence

Baseline: `ce04971713d51192975ae68824b293034f086f61` (main at branch creation).
Candidate: `8f3f6cc694f4fd7de3b153f28d9f45cd978e67a2`.
All nine changed files in the isolated baseline copy were checked byte-for-byte against that baseline commit. The baseline native middleware and edge route use their own copied sources. Unchanged prepared inputs and inventory-addressed assets are shared; nothing was rebaked.

## Matched live browser captures

`before-{earth,tree,search}.png` and `after-{earth,tree,search}.png`: Chrome 153.0.8010.53, 1440 x 900, DPR 1, same fixed camera URL in capture.mts, default surface dataset, labels off and motion off. Each pair has identical PNG bytes and zero changed pixels at both threshold 0.1 and threshold 0 with includeAA true. No crops, masks or scaling. Inputs, hashes and results: pixelmatch.json; diffs: diff-*.png.

The captures preceded the final overview-only routing addition and its test assertion. All captured browser code is identical to the final commit; the fixed camera URL already has `v`, so its route is unchanged. The test-file hash in pixelmatch.json describes the earlier capture revision. This evidence is reused for that reason, not represented as a second run.

browser.json records search, selected Earth, two named feature results, Escape/reopen, one mounted scene and zero page errors on both revisions. The named browser was isolated from the user's tabs.

## Native response correction

`before-native-system.png` and `after-native-system.png` use `/earth/?overview=system` with JavaScript disabled at 1440 x 900. Main ignores the overview-only query and shows the Earth card/source. The candidate shows the Solar System card and Sun-owned source document. These intentionally different captures are not a zero-diff claim. They prove card/source presentation, not a native 3D overview camera; the static Earth scene remains unchanged. See native-browser.json.

The local TRAPPIST-1 static page is absent in this sparse checkout, so its non-Solar header is covered by the existing fixture check, not a real-page browser claim. The fixture exercises body, TRAPPIST-1 system, Milky Way, Local Group, Nearby Universe, and focus precedence through native and live presenters.

## Focused checks

- 26 existing affected tests pass (search response, source links, system-header fragment, prepared focus card): checks.log.
- After adding the overview-only route, its affected search-response file passed again: 15 tests, route-checks.log.
- Shell TypeScript, affected ESLint, and the three browser-import boundary checks pass.
- No full-suite rerun, new test framework or CI configuration.

## Static source comparison

Jankmonster export --scope site / compare summary: 21 fewer branches, 2 fewer functions, 3 fewer mutable bindings and 4 fewer controls. The scope includes test fixtures. Original fingerprints and dirty-path provenance are in jankmonster-comparison.json. These are static source counts, not performance or leak measurements; some static candidate counts remain unchanged.
