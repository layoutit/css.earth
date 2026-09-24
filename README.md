# Volume lenses on a cold page, and discs that open framed: evidence

Tested revisions: `main` at `6d640af301` and the change at `ae10a2131f` (fix/volume-lens-framing).

## In the app (`capture.mjs`, `openings.txt`, `main/facts.json`, `change/facts.json`)

Headless Chromium against the local dev server, with main's five runtime files swapped in for the main run: `system-framing`, `prepared-world-navigation`, `scene-activation`, `scene-router` and `scene-datasets`. Each page is a cold load. The last row is an in-app link from Earth. For each page the capture records the readout's distance, any dataset notice, whether the page became ready, and a screenshot.

- **Main, every volume lens fails on a cold load.** Beta Pictoris, the HD 181327 and PDS 70 ring links, the Sun's corona link, and Betelgeuse's own default all show "Dataset cloud … is unavailable. Showing the default dataset." The Beta Pictoris dataset link never becomes ready.
- **The change, no notices.** Every page becomes ready, and every opening fits the volume its lens shows whenever the volume overflows the view: Beta Pictoris at 758.53 au, HD 181327 at 1,685.63 au, PDS 70 at 842.81 au, the Sun's corona link at 17,015,196 km, and Betelgeuse at 156.82 au.
- **Unchanged:** Earth and plain HD 181327, whose default lens is not a volume, are 0 changed pixels at thresholds 0.1 and 0.
- **The volumes themselves look as on main:** loading the Sun plainly and then picking COR1 in the page, after the world has loaded, ends at the same distance with 0 changed pixels on main and the change (`cor1.mjs`, `sun-cor1-picked-in-page-main.png`). Only the openings change.

Every framed view keeps the page's direction, from Earth, so each disc is seen as the telescopes saw it: Beta Pictoris edge-on.

## Pictures

- `beta-pictoris-opening.png` (change) and `beta-pictoris-opening-main.png`.
- `sun-corona-and-betelgeuse-fitted.png`: the change, with the Sun's corona link on the left and Betelgeuse on the right.
- `hd-181327-ring-opening.png` and `pds-70-ring-opening.png`.

## The rule

An opening fits the volume when the fit lies farther out than the view. An intermediate version framed only volumes reaching beyond ten times the opening distance. That left the Sun's corona overflowing the screen, so it was removed.

## Checks

- **Typechecks:** `pnpm typecheck` (whole repository) and `typecheck:shell` pass.
- **New test:** `site/test/scene-datasets.test.mts` passes. On main's `scene-datasets.mts` it fails with the same "Dataset cloud “beta-pictoris-disc” is unavailable." error.
- **Site suite:** 327 passed, 14 failed. The 14 are the same names as on main; they need prepared assets or a build this worktree does not have.
