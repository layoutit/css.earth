# Volume lenses on a cold page, and discs that open framed: evidence

Tested revisions: `main` at `6d640af301` and the change at `3ab5162403` (fix/volume-lens-framing).

## In the app (`capture.mjs`, `openings.txt`, `main/facts.json`, `change/facts.json`)

Headless Chromium against the local dev server, with main's five runtime files swapped in for the main run: `system-framing`, `prepared-world-navigation`, `scene-activation`, `scene-router` and `scene-datasets`. Each page is a cold load. The last row is an in-app link from Earth. For each page the capture records the readout's distance, any dataset notice, whether the page became ready, and a screenshot.

- **Main, every volume lens fails on a cold load.** Beta Pictoris, the HD 181327 and PDS 70 ring links, the Sun's corona link, and Betelgeuse's own default all show "Dataset cloud … is unavailable. Showing the default dataset." The Beta Pictoris dataset link never becomes ready.
- **The change, no notices.** Every page becomes ready.
  - The three discs open framed: Beta Pictoris at 758.53 au, HD 181327 at 1,685.63 au, PDS 70 at 842.81 au.
  - Betelgeuse (13.91 au) and the Sun's corona link (2,723,016 km) keep main's distance, and now show their shell and corona.
- **Unchanged:** Earth and plain HD 181327, whose default lens is not a volume, are 0 changed pixels at thresholds 0.1 and 0.

Every framed view keeps the page's direction, from Earth, so each disc is seen as the telescopes saw it: Beta Pictoris edge-on.

## Pictures

- `beta-pictoris-opening.png` (change) and `beta-pictoris-opening-main.png`.
- `betelgeuse-and-sun-main-vs-change.png`: main on the left, the change on the right.
- `hd-181327-ring-opening.png` and `pds-70-ring-opening.png`.

## The ratio

A page frames a volume only when the volume reaches beyond 10 times the opening distance. The ratios measured on the five lens volumes are:

- Sun's corona: 1.
- Betelgeuse's shell: 1.5.
- Beta Pictoris disc: about 4,800.
- PDS 70 ring: about 6,500.
- HD 181327 ring: about 12,000.

The first measure was "the fit is farther than the opening", but it pulled Betelgeuse back to 156.82 au: the camera sits inside the shell, so the fit is always farther. Betelgeuse became a small dot, so that measure was replaced.

## Checks

- **Typechecks:** `pnpm typecheck` (whole repository) and `typecheck:shell` pass.
- **New test:** `site/test/scene-datasets.test.mts` passes. On main's `scene-datasets.mts` it fails with the same "Dataset cloud “beta-pictoris-disc” is unavailable." error.
- **Site suite:** 327 passed, 14 failed. The 14 are the same names as on main; they need prepared assets or a build this worktree does not have.
