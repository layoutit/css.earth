# Atlas removal and navigation simplification

Candidate: `817f256edef8547289f51736b0372713b54c77f3`.
Baseline for this extension: `c3f222a5a61d5a7b288e0bbc6a2631b827a6b353` (the previous PR head).

The application now owns its navigation model, components, styling and prepared marker presentation under `site/`. The separate Atlas/Starlight application and its documentation route/asset-origin modes are removed. Search keeps one open state; its unused hierarchy filter is replaced by reset-to-selection.

- `dependencies.json`: 89 package/version entries removed from the lockfile; none added or changed; remaining workspace importer resolutions unchanged.
- `jankmonster-comparison.json`: same analyzer fingerprint and 500-commit history window; 95 fewer source branches, 46 fewer functions, 19 fewer exports and 22 fewer mutable bindings. These are static source counts, not runtime state-space or performance measurements. Full reusable bundles remain in local `output/router-deep/before/` and `after/` (hundreds of MB, intentionally not published).
- `before-navigation-tree.json` and `after-navigation-tree.json`: identical bytes, including all destinations, hierarchy, counts and marker styles.
- `pixelmatch.json`, `compare.mts`, paired screenshots and diffs: 0 changed pixels at both threshold 0.1 and threshold 0; all three PNG pairs are byte-identical. Initial Earth and expanded navigation include the rendered Earth. The settled search capture documents the search UI; both versions show only the sky background at that point, so it does not qualify post-search body visibility. Settings, camera, source hashes and input details are in the JSON.
- `matched-capture.log`: both servers used the same initial camera URL, viewport and prepared assets; awaited scene readiness and feature-search completion. Captures precede the source commit and retain its parent version stamp; the captured source tree matches the candidate.
- `interaction-flows.log`: Escape, retained query, deferred branch expansion, reset to selected path and category toggling pass, with one mounted scene and no page errors. Some planet search thumbnails are absent in this sparse checkout (404s); these do not affect the captured Earth result.
- `navigation-checks.log` plus `navigation-relocation.log`: 13 existing checks pass after adapting the relocated fixture. The first log retains the initial fixture failure; the second records the corrected pass. Tree reset replaces the removed filter assertion. No new test infrastructure.
- `typecheck.log`: Astro checks 209 files, zero errors/warnings. Two missing Uranus metadata inputs were restored from their inventories before the passing run.
- `lint.log`: affected TypeScript files pass ESLint.

The initial router/context evidence remains in the parent evidence commit. Its routing/session code is unchanged in this extension. No prepared sources or geometry were changed or rebuilt. Full-suite, deployment, performance and native bfcache qualification were not run.
