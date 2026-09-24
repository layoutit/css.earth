# Search sheet and focus card ownership: evidence

Tested revisions: `main` at `62d8e75683` and the change at `fd4a5fba7e` (refactor/search-focus-owners). Both ran on the same local `astro dev` server, with the change's source files swapped in. Captures come from headless Chromium at 1x device scale: 375 × 812 for the phone flows and 1280 × 800 for desktop. Each step waits for `window.__cssEarth.ready`, then 700 ms.

## Flows

`flows-main.json` and `flows-change.json` record the sheet state, whether search is open, the visible results, the visibility of the focus card, context and information panels, and the sidebar scroll after every step.

| Flow | Steps | Difference |
| --- | --- | --- |
| desktop-pill | Planets pill, pill again | none |
| desktop-type-escape | type "mars", Escape | none |
| desktop-focus-then-body | open `?focus=m42`, type "mars", pick Mars, arrive | none in recorded states |
| mobile-type-escape | focus search, type "mars", Escape | none |
| mobile-type-clear | type "mars", clear | none |
| mobile-type-scene | type "mars", press the scene | sheet `full` on main, `peek` here (the fix) |

## Pixelmatch (`pixelmatch.json`)

These compare the final screenshot of each flow (`main-*.png`, `change-*.png`, `diff-*.png`) at threshold 0.1, with anti-aliasing included, and at threshold 0.

- desktop-pill, desktop-type-escape, mobile-type-escape and mobile-type-clear: 0 changed pixels at both thresholds.
- mobile-type-scene differs by design (`scene-tap-main-vs-change.png`, left main, right change).
- desktop-focus-then-body: 385 pixels at threshold 0.1 (2,952 at 0), all in the scene at x 498 to 688. The Betelgeuse label and an orbit line settle differently between runs after the flight. A second run of the change differed from the first by 562 pixels in the same area and matched main's label layout. The sidebar is identical.

## Direct URLs without JavaScript (`native-facts.txt`)

These are responses from the search function for `/earth/?focus=m42`, `?q=mars`, `?overview=system` and the plain page. On both revisions, the focus card is shown only for `?focus=m42`, and the sheet opens for `?focus=m42` and `?q=mars`. The context and information panels match. The only HTML differences are the deleted rail and About markup and their CSS.
