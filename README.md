# Search sidebar refactor: evidence

Tested revisions: `main` at `1f10f73a24` and the change at `97f5d36f6f` (refactor/object-browser-features). Only `site/object-browser.mts` differs.

## How it was tested

`record.mjs` drives headless Chromium on `/earth/` against a local Astro dev server. After every step it records the sidebar facts: the search value, whether the browser, tree, results and "No matching results" message are hidden, the browser's label and search attributes, the pressed category pill, the feature rows (count, hint, names), the visible object rows and overview rows, and a screenshot. The dev server's own feature search answers. The recorder delays it by 1.5 s where a step needs to see a feature search still in flight, and fails it (HTTP 500) for queries starting with "failq".

The flows:

- **Typed searches:** open the browser; "tycho" and "zzqx" each while the feature search is in flight and after it settles; a failed feature search; "sat" (objects and features); "all objects"; a system name; an overview row; whitespace only; "SAT " (the same query in other case and spacing).
- **Pills and clearing:** two category pills, the second one pressed again to turn it off, a query with no match, then the clear button.
- **Close and reopen:** close and reopen on the same query. Then type a no-match query and close before its feature search answers, and reopen.
- **Search before the catalogue loads:** the catalogue index is delayed 2.5 s, and "sat" is typed while it loads.
- **Native submitted search:** `/earth/?q=tycho` opened directly.

Each run writes `runs/<label>/facts.json`; they are copied here as `facts/<label>.json`. `compare.mjs` compares the facts and Pixelmatch-compares the screenshots (1280×800, DPR 1, threshold 0.1 and 0). `mutants.py` plants one bug at a time in the change.

## Production catalogue list (`w-*`, `windowed-comparison.txt`)

`astro dev` renders the catalogue as inline rows unless `CSSEARTH_TEST_CATALOGUE_WINDOW=1` is set. Production uses the windowed list, which closing the browser actually empties. These runs use the windowed list.

- Main and the change ran twice each. Both change runs record the same facts as main-1 at every one of the 25 steps. Main-2 differs from main-1 in one fact: whether the feature rows had arrived by the "catalogue loading" snapshot. That is timing within main itself.
- Screenshots differ only in frames that also differ between the two runs of main: the loading frame, the first frame and the submitted-search frame.
- All five planted bugs are caught:
  1. the message ignores a feature search in flight;
  2. the message ignores "not searching";
  3. a new query never marks its feature search as pending;
  4. feature results never update the message;
  5. closing keeps the cached query, so reopening shows no rows.

## Dev inline list (`main-*`, `change-*`, `mutant-*`, `inline-comparison.txt`)

These runs came first, before the catalogue-loading flow existed. The facts are identical across main and the change, twice each, and planted bugs 1 to 4 are caught. Bug 5 is not caught here, because the inline list is never emptied on close, so re-filtering on reopen changes nothing visible. That miss is why the windowed runs above were added.

## Pictures

`no-match-waiting-for-features.png` shows "zzqx" while its feature search is in flight: no message yet. `no-match-settled.png` shows the same query once the feature search answered with nothing: "No matching results".
