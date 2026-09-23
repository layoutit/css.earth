# WD 1856+534 evidence — 2026-09-23

These results apply to the WD 1856+534 and WD 1856+534 b packages, records and tool changes committed with this evidence, on top of main at `874b508c84`.

## Numerical and source checks

- Astronomy: `hostedOrbits.test.ts` and `stars.test.ts` passed 18 tests, covering catalogue registration, stellar placement and hosted-orbit propagation for the new planet.
- Packages: the runtime-package suite passed 75 tests over both packages. System membership, package consistency (every placed star, including this one), exoplanet radius, source records, factsheet sources, body additions, reader text, both scaffolds, title sources and the VO discovery tests passed 92 tests; one test skipped while other stars' files were not yet restored, then passed with them restored.
- Ledgers: both `investigations.json` files parse with the shared ledger reader (5 entries each).
- `pnpm typecheck:pr` passed.
- Colour: `tools/objects/source-authoring/stellar-spectra/author.mts --check wd-1856-534` recomputes `#ffe2bf` (sRGB 255, 226, 191) from the committed Gaia sampled spectrum.
- Delivery: `publish-runtime-assets.mts` uploaded both packages and verified 67 keys live on `earth-assets.lowpoly.cc`.

## Inspected browser views

Chromium headless, 1280 × 900 CSS pixels, dev server with `ASSET_ORIGIN=https://earth-assets.lowpoly.cc`. The three routes had no page errors and no failed requests.

- [Star](star.png): the Gaia colour on a uniform disc. The vertical line is the planet's orbit seen almost edge-on from the default camera.
- [Planet](planet.png): the gray sphere at its measured radius, lit by its white dwarf.
- [System](system.png): one orbit track, both labels, the planet on its orbit. The star's marker sits above the ellipse's centre. The orbit and the star come from the same Kepler elements, so this is perspective on a nearly edge-on view, not an offset in the data.

These are appearance and delivery checks, not a photographic comparison: no image of either body exists.
