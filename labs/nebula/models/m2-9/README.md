# M2–9: image-to-volume experiment

An independent TypeScript implementation of the axial group-sparsity method in [Wenger, Lorenz & Magnor (2013)](https://doi.org/10.1111/cgf.12216). It reconstructs **relative RGB emission**, not gas mass density. Unlike LMC/SMC, this experiment has no simulation density to paint.

## Reproduce locally

From the repository root, with Node and pnpm installed:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node --experimental-strip-types labs/nebula/src/run.ts test solver
node --experimental-strip-types labs/nebula/src/run.ts prepare-emission labs/nebula/models/m2-9/experiment.json
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

Open <http://127.0.0.1:4331/reconstruction?subject=m2-9-inferred>. If the lab is already running, leave that process alive and omit the final command. Source acquisition checks the pinned hash; processing is explicit. Selecting the object or refreshing only loads prepared results.

The experiment caches originals, intermediate RGB volumes, projection comparisons, receipts and all 144 XYZ slice textures under `.local/nebula-lab/planetary/`. These are ignored. A completed rebake preserves the previous directory. Only the recipe and implementation are versioned.

## Observation and authored assumptions

- [NASA APOD, 1 February 2004](https://apod.nasa.gov/apod/ap040201.html), distributing the 1997 HST/WFPC2 image. Credits: B. Balick, V. Icke, G. Mellema and NASA. Preserve these credits; the APOD page links its applicable rights statement.
- Pinned original: 800 × 525 JPEG, SHA-256 `29b1575bff3bb8dbbe8cb9934ef214676c98d49fcf488df488576e3723049e71`. This is an outreach composite, not native calibrated observation data. The NASA [observation description](https://science.nasa.gov/asset/hubble/supersonic-exhaust-from-nebula-m2-9/) identifies neutral oxygen, nitrogen and doubly ionized oxygen as the RGB bands. Do not use that page's inconsistent sky-coordinate metadata to place the model.
- Crop `(6,6,788,438)` removes the white frame and caption. The original bytes remain unchanged. A 144 × 80 reduction keeps effectively square pixels (aspect difference below 0.1%).
- Four inspected point-source masks attenuate compact light using local annular medians, including the central star. The two bright extended lobe knots remain. This is a deliberately small baseline, **not completed NOX extraction** or an astrophysical stellar-membership catalogue.
- Axis: −25° in the source raster, zero inclination to the image plane. Center: the central source. Both are modeling assumptions. No WCS, distance, physical dimensions or measured gas density are inferred.
- Three display-RGB channels are fitted independently in `[0,1]`, with black level 0.035 and regularization 0.001. These are display choices, not photometric calibration. The regularization value is not numerically comparable with the paper without matching its image intensity normalization.

## Method and checks

1. Assign voxels to cylindrical radius/axis bins around the authored symmetry axis.
2. Minimize the nonnegative image-fit objective with weighted group L-infinity regularization using FISTA. A deterministic sort-based proximal operator replaces the paper's randomized quickselect. Source code from the authors was not copied.
3. Save the inferred RGB voxel fields and their source-facing projections. The difference image is amplified four times.
4. Sample **that volume** into the existing offline XYZ baker and PolyCSS compiler. Every side bank samples the same field; no repeated photographic planes are created.
5. Inspect Front, Y +60°, Edge X, Edge Y and continuous pointer rotation. Numerical image fit and CSS visual quality are separate checks.

The deterministic shell test verifies hollow radial structure as well as reprojection. Its zero-regularization negative control becomes a depth-uniform extrusion. Browser checks live in `src/browser/browser-emission.ts` and write local screenshots and a positive completion receipt.

This baseline uses the existing shared-opacity slab renderer, which approximates the paper's additive emission model. Brightness changes under rotation can originate in both inferred geometry and this display approximation. Do not claim measured side structure, photometric fidelity, or production acceptance.

Initial local result (2026-09-11): 4.4–5.1 seconds for three channel fits, approximately seven seconds through baking. Relative source-projection L2 error: R 6.94%, G 4.91%, B 4.18%. All 144 prepared textures total 3.75 MB. The synthetic hollow-shell test and browser rotation/refresh checks pass. Front, oblique and both side views retain connected lobes. Visible rings, residual point/background artifacts and directional color/brightness changes remain; this is ready for a first visual decision, not production acceptance. Screenshots and browser receipt are local under `.local/nebula-lab/planetary/browser/`.

Checkpoint validation: all 163 lab tests, lab TypeScript checking and the lab Vite build passed. A bounded external solver review produced no completed report, including one timeout retry; independent review is **not complete**. No production qualification is claimed. The descriptor's unit scale and J2000 epoch are local transport placeholders, not measured astrometry.

## Bounded experiment

One baseline, at most two adjustments. Success means connected lobes visible obliquely, a recognizably preserved input projection (per-channel relative L2 error below 10%), functioning retained PolyCSS navigation, and reproducible inputs/outputs. If front agreement improves while the sides collapse, stop and record whether the prior, solver or renderer owns the failure.

See [the planetary-nebula method notes](../../docs/planetary-nebulae.md) for papers, limits and follow-up work.
