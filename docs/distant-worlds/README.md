# Distant worlds and ʻOumuamua

Nine selectable destinations share the existing object registry, world camera, navigation card, retained PolyCSS renderer and unmapped-surface grid. Shadows and Orbit default off. Each prepared model contains 480 native `u` raster triangles, reduced from a 5° analytical ellipsoid grid by the existing meshoptimizer pipeline. No observed global texture or terrain is claimed.

| Destination | Adopted full axes | Interpretation |
| --- | --- | --- |
| ʻOumuamua | 115 × 111 × 19 m | Mashchenko (2019) DISC light-curve fit at assumed geometric albedo 0.1. Its competing 324 × 42 × 42 m CIGAR fit remains possible. Arbitrary static attitude; observed tumbling is not reconstructed. |
| Sedna | 995 × 995 × 995 km | Equal-axis illustration at the Pál et al. (2012) effective thermal diameter, 995 ±80 km. Shape unresolved. |
| Gonggong | 1230 × 1230 × 1230 km | Kiss et al. (2019) spherical thermophysical interpretation, 1230 ±50 km. |
| Orcus | 910 × 910 × 910 km | Brown & Butler (2018) primary thermal size, 910 +50/−40 km; excludes Vanth. Shape unresolved. |
| Salacia | 838 × 838 × 838 km | Kiss et al. (2025) conference result, primary diameter 838 ±44 km; excludes Actaea. Conference status retained. |
| Varuna | 1098 × 659 × 474 km | Fernández-Valenzuela et al. (2019) axis ratios, scaled to an approximately 700 km volume-equivalent diameter. |
| Varda | 778 × 706 × 496 km | Proudfoot et al. (2026) example triaxial fit. Depth remains unconstrained; satellite alignment is a pole prior. |
| Máni (2002 MS4) | 824 × 824 × 770 km | Rommel et al. (2023) projected occultation ellipse, with an explicitly assumed 824 km depth. The limb feature is not extruded into invented global relief. |
| Achlys (2003 AZ84) | 940 × 766 × 490 km | Dias-Oliveira et al. (2017) Jacobi hydrostatic-equilibrium interpretation. |

[Inputs and source decisions](inputs.json) retain exact numerical extraction, primary publication links, alternatives, uncertainty, orientation assumptions, reference hashes and the IAU naming bulletins. Each package keeps its own measurements, original-source acquisition recipe, manifest and source explanation. The model volume-equivalent radius is a display scale; it is not a new independent physical measurement. No qualified spin phase is installed. The reviewed CC BY 4.0 Salacia conference HTML is retained in Git because its live page includes changing tokens; the other paper originals are reacquired through pinned URLs.

## Open trajectories

ʻOumuamua extends the common conic path: negative semimajor axis and eccentricity above one use the standard hyperbolic Kepler equation. Preparation emits a finite inbound-to-outbound path with an explicit epoch vertex and N−1 edges. The shared parser and projector preserve its open endpoints, including full-orbit highlighting. There is no periodic trail, finite physical apoapsis or repeated revolution.

The drawing window encloses at least 600 au and the current epoch position. This is a display extent, not a physical bound or an accuracy claim over that interval. Positions use heliocentric geometric JPL Horizons elements at the application's fixed 2026-09-03 epoch. All nine agree with independently retained Horizons vectors within 0.4 metres at that epoch. The largest checked ±30-day error is 549 km; these osculating two-body paths do not simulate long-term perturbations or ʻOumuamua's non-gravitational acceleration.

## Reproduction

Use the repository's supported Node version and installed dependencies. Preparation here ran sequentially with a 3 GiB Node heap limit, `UV_THREADPOOL_SIZE=1` and `VIPS_CONCURRENCY=1`.

1. Restore source originals with `node tools/objects/dist/operations.js acquire <id>`.
2. `python3 docs/distant-worlds/author.py` extracts the numerical source models from the retained inputs. It deliberately resets the selected body descriptors; follow it with the remaining preparation steps.
3. `node docs/distant-worlds/finalize-sources.mjs` generates source context markers and pins source closures.
4. `node tools/objects/dist/prepare-authored.js <id> --write` prepares each body in sequence.
5. The existing `docs/lucy-targets/navigation.mjs` appends markers against the recorded base commit; `refresh-transports.mjs` refreshes shared marker bindings and world contexts without recompiling existing presentations.
6. `pnpm setup:assets --object=<id>` installs the published content-addressed runtime assets.

Qualification receipts live beside this document: independent orbital comparisons, marker preservation, package/source closures, fresh source acquisition, fresh asset installation and actual headless DPR 1/2 browser checks. Browser images represent the selected scientific models, not resolved photographs.

The sampled radial deviation of the 480-triangle surfaces is reported in [surface-fit.json](surface-fit.json): 1.85 m for the thin ʻOumuamua model and 9.8–16.9 km for the large outer models. These are finite vertex/edge-midpoint/centroid comparisons with the adopted ellipsoids, not exhaustive surface-error bounds or measurement uncertainties.

A shared mobile CSS cascade defect was also exposed during qualification: a later generic `site.css` rule changed the responsive viewport back to `position: fixed`, letting the card cover the scene. The existing Gǃkúnǁʼhòmdímà route reproduced it. The mobile override now has body-shell specificity so the scene retains its place above the card regardless of bundle order.

The final production marker click from Varuna to ʻOumuamua, both newly named objects’ designation searches, opt-in Shadows paint, and mobile layouts passed. Scoped diagnostic conformance passed desktop, mobile, and dataset interaction cases at DPR1/2. In the DPR2 production drag trace, ʻOumuamua retained all nodes, requested no new interaction assets and had a 16.7 ms p95 animation-frame interval; the equal-face-count existing reference measured 16.8 ms. These headless captures are workload evidence, not a guarantee for every device. The existing `bodies.ts` max-lines lint violation remains (main633lines; this branch644; limit600); the selected non-registry files pass lint.
