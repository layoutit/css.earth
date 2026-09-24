# Audit fixes: evidence

Tested revisions: `main` at `34b6031730` and the change at `52e752c1ca` (fix/audit-2026-09-24).

## The sidebar tree (`tree-before.txt`, `tree-after.txt`, `tree-diff.txt`, `tree-dump.mts`)

`tree-dump.mts` prints `navigationTree()`, one row per node with its link, on each side. The diff is the whole change to the tree:

- **Attached volumes:** the Beta Pictoris debris disc moves from Other, where it had no link, to under Beta Pictoris, opening `/beta-pictoris/?dataset=debris-disc`. The HD 181327 ring, the PDS 70 ring, Betelgeuse's shell and the Sun's corona density, hidden before, are listed under their bodies, each opening its body on the lens that shows it.
- **Kepler-16:** Kepler-16 A and Kepler-16 (AB) b form the Kepler-16 system. Before, the planet was in Other and the star was a lone star.
- **Epsilon Indi:** it was listed as two systems with the same name (A with Ab, Ba with Bb) and is now one.
- **Milky Way:** Omega Centauri and Sagittarius A* move from Other into it.
- **Other:** the section is gone. LMC, SMC, M31 and M33 stay exactly where they were, now placed from their catalogue membership.

Every other row is unchanged.

## In the app (`app-check.mjs`, `tree-beta-pictoris.png`, `disc-opened.png`)

Headless Chromium against the local dev server at DPR 2:

- **The link:** on `/beta-pictoris/`, the browse tree lists "Beta Pictoris debris disc" under Beta Pictoris with the link above.
- **After clicking:** the page is `/beta-pictoris/?dataset=debris-disc` with the debris-disc lens selected, and no page errors.
- **Served tree data:** `/navigation-tree.json` carries the same nodes. There is no `other` node, the Kepler-16 system has both members, and each attached volume has its lens link.

Limit, not changed here: the star page's opening camera sits about 4.2 million km from the star. The disc spans 16 to 126 au, so it is off screen when the page opens (`disc-opened.png`). The same happens on main for plain `/beta-pictoris/`, whose default lens is the disc.

## Helpers (`helper-sweep.mjs`, `helper-files.txt`, `helper-census-after.txt`)

`helper-sweep.mjs` removes a local `dot`, `clamp` or `isRecord` only when its one-line body matches the shared helper exactly, and only in files with no other binding of that name. It then imports the shared helper under the same local name.

- **`dot3`:** for three-component copies.
- **`dotN`:** for the `reduce` copies. It sums the same products in the same order, starting from 0.
- **`clamp` and `isRecord`:** straight replacements.

71 copies in 68 files were replaced. What remains is in `helper-census-after.txt`: bindings with other meanings (a single-argument clamp, a matrix-row product, variables named `dot`), `packages/*`, and the `record` validators, whose error messages differ.

## Checks

- **Typechecks:** `pnpm typecheck` (the whole repository, tools included), `typecheck:shell`, `typecheck:renderer` and `typecheck:oracles` all pass.
- **Site tests:** `node --test site/test/*.test.mts` gives 326 passed and 14 failed, including the new `shell-settings.test.mts` and the updated route test in `navigation-ontology.test.mts`. The 14 failures are the same names as on main (`site-test-failures-*.txt`); they need prepared assets or a build this worktree does not have.
- **Tool tests:** the 212 test files in every tools directory the sweep touched (`tool-test-files.txt`) give 2,846 passed and 23 failed on both sides, with the same names (`tool-test-failures-*.txt`).
- **Renderer tests:** 672 of 673 pass. `volume/loader.test.ts` fails locally, as on main.
