# Search/sidebar presentation evidence

Baseline: `a9bbe317bb66950bfcbc8cb8edfc163029200f50` (main when this branch started).
Candidate: `95fc80fea32c521f5c0d19f7afc9f9dc6c200ace`.

Ten matched desktop views have zero changed pixels at thresholds 0 and 0.1, with antialiasing included. Every view retains before, after and both diff images. [Pixelmatch settings, hashes and reuse details](pixelmatch.json).

| View | Before | After | Exact diff |
| --- | --- | --- | --- |
| earth | [before](before-earth.png) | [after](after-earth.png) | [diff](diff-earth-exact.png) |
| tree | [before](before-tree.png) | [after](after-tree.png) | [diff](diff-tree-exact.png) |
| search | [before](before-search.png) | [after](after-search.png) | [diff](diff-search-exact.png) |
| closed | [before](before-closed.png) | [after](after-closed.png) | [diff](diff-closed-exact.png) |
| cleared | [before](before-cleared.png) | [after](after-cleared.png) | [diff](diff-cleared-exact.png) |
| planets | [before](before-planets.png) | [after](after-planets.png) | [diff](diff-planets-exact.png) |
| empty | [before](before-empty.png) | [after](after-empty.png) | [diff](diff-empty-exact.png) |
| native-search | [before](before-native-search.png) | [after](after-native-search.png) | [diff](diff-native-search-exact.png) |
| native-empty | [before](before-native-empty.png) | [after](after-native-empty.png) | [diff](diff-native-empty-exact.png) |
| city | [before](before-city.png) | [after](after-city.png) | [diff](diff-city-exact.png) |

[Live browser states](browser.json), [native and city results](remaining-browser.json). The city flow opens Buenos Aires, opens search, confirms the city is hidden, and presses Escape to reveal the same selected city. Native empty submission still lists 1,437 rows; an empty live query still shows the navigation tree.

[Jankmonster ownership comparison](ownership.json) uses identical analyzer fingerprints and a `site` slice. Browser, selected content, navigation tree, feature results and destination visibility each move from 2–3 decision sites to one. Empty-result selectors changed parent paths and are not counted as equivalent IDs. This is source evidence, not a performance claim or complete debt score.

27 existing focused checks passed; the nine destination/API checks were rerun after deleting the destination state/API. Shell TypeScript and affected ESLint passed after the final production edits. No CI infrastructure or test files were added; the existing destination checks were updated to remove calls to the deleted API.

Limits: desktop only; no full-suite or timing claim. Both installations lacked the same eight planet search thumbnails. Earth, search and city screenshots render their assets. Baseline and candidate share unchanged prepared assets and dependencies; only the copied baseline's Vite allow-list was extended to serve those local assets. See the JSON for the capture/code reuse details.
