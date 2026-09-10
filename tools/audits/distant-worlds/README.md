# Check distant-world packages

Run these helpers from the repository root with the supported Node version.
They cover the nine models listed in the
[source-authoring inputs](../../objects/source-authoring/distant-worlds/inputs.json).
Reports and captures are written to ignored `output/`; retain selected evidence
with its tested revision and link it from the affected body's README.

| Helper | Check or artifact |
| --- | --- |
| `qualify.mjs` | Package contracts, prepared budgets and default controls |
| `fresh-sources.mjs` | Standard acquisition into empty source roots; original byte pins |
| `fresh-install.mjs` | Standard runtime installation into an empty destination; byte pins |
| `surface-fit.py` | Radial deviations at prepared vertices, edge midpoints and centroids |
| `browser-check.mjs` | Production default views at DPR 1/2, retained drag and navigation |
| `final-interactions.mjs` | World-marker selection, designation searches, lighting and mobile layout |
| `drag-trace.mjs` | Headless interaction trace using the shared browser launch and trace parser |
| `contact-sheet.mjs` | Nine-model overview from the actual DPR 1 default captures |

For example, `node tools/audits/distant-worlds/qualify.mjs` reads the current
prepared packages. `python3 tools/audits/distant-worlds/surface-fit.py` compares
them with the adopted ellipsoids. Its finite samples are not a Hausdorff bound
or a scientific measurement uncertainty.

Fresh-source and fresh-runtime checks require empty destinations beneath
`output/distant-worlds/`. The browser checks use the existing production preview
on port 4278; `browser-check.mjs` uses the fresh runtime installation. They do
not start a server. Run only one acquisition, build, preparation or browser
capture at a time. `drag-trace.mjs` accepts origin, DPR, output directory and
body id as positional arguments.

The original reports and inspected screenshots are preserved at
[5ccf1eafa](https://github.com/layoutit/cssEarth/tree/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds).
The [browser report](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/browser-validation.json)
records actual bytes, viewport and browser settings. The
[drag comparison](https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/drag-comparison.json)
compares ʻOumuamua with an equal-face-count existing reference; their projected
areas differ, so it does not claim identical GPU work or performance on every
device. Keep new measurements separate from those original results.
