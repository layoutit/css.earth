# Galileo and Rosetta asteroid mosaics

The existing SSI reflectance views on Ida and Gaspra and OSIRIS views on Šteins and Lutetia now combine two original observations each. These are improvements to four existing dataset rows. The older processed maps remain available because they retain useful coverage outside the calibrated photographs.

| Body | Original observations | Nominal source scale | Accepted display-mesh area, before → after |
| --- | --- | --- | --- |
| Ida | Galileo SSI 202561278 + 202560500, green filter | 111–170 m/pixel | 18.83% → 19.78% |
| Gaspra | Galileo SSI 107318326 + 107318313, clear filter | 54 m/pixel | 10.31% → 12.76% |
| Šteins | OSIRIS WAC 18:36:22 + 18:36:46 UTC, OI filter | 113–129 m/pixel | 23.56% → 24.68% |
| Lutetia | OSIRIS NAC 15:41:06 + 15:41:54 UTC, orange filter | 78–88 m/pixel | 29.26% → 29.51% |

Coverage is an estimate using the same 64 stratified barycentric samples per displayed triangle before and after, weighted by physical triangle area. The Galileo audit samples the final 4096×2048 preparation grid; OSIRIS samples the qualified camera/shape transfer directly. These are not percentages of atlas tiles or claims of exact global coverage. The small increase on Lutetia is complemented by a better viewing angle over overlapping terrain.

All four retain the exact previous 800-triangle terrain files, ordinary prepared grid in unsupported areas, and Shadows off. Photographs retain acquisition shadows. No renderer or interaction code is changed.

## Scientific checks

- **Ida and Gaspra:** the original Thomas shape camera catalogs supply the cameras; there is no local camera fit. Four image patches per added observation are checked against the projected published Thomas mosaic. Maximum residuals are 2.24 and 3.16 source pixels respectively, below the unchanged 4-pixel limit. The mosaic shares Galileo observations, so this is a registration check rather than independent absolute ground truth. The calibrated I/F is shown with the existing fixed display stretch and without a fitted brightness gain.
- **Šteins:** each image has its own camera profile, original kernel closure, and independent archived boresight check (within 0.000004 degrees). Source/model footprint diagnostics give 95th-percentile limb distances of 2.83 and 3.0 source pixels. These diagnostics include blur and shape uncertainty; neither image provides a surface-intercept anchor and no image-to-shape fit is claimed. Both images retain acquisition illumination. The earlier near-opposition Minnaert approximation is not extrapolated to the second image. Qualified overlaps give a 1.29646 relative display gain, below the existing 1.35 limit.
- **Lutetia:** the added camera reproduces archived RA/Dec within 0.000005 degrees and the archived intercept within 0.006 pixels before image registration. The existing bounded translation method uses two fit and two holdout windows. Maximum holdout residual is 5.41 pixels, below the unchanged 12-pixel limit. The existing phase-dependent Minnaert recipe remains, followed by a 1.09501 relative overlap gain.

Original quality arrays, interpolation separation, viewing-angle limits, source visibility and display-to-source distance limits remain enforced. Increasing coverage never relaxes a camera or photometric acceptance limit. The surfaces remain partial photographic views, not recovered global albedo maps. Šteins spans only tens of original pixels.

## Source selection and evidence

The survey also considered earlier Galileo images and later OSIRIS encounter images. Earlier Ida/Gaspra candidates failed the required spatial registration checks. The next Šteins OI frame needed a 1.56 relative gain, above the 1.35 limit; later views had worse footprint agreement. Later Lutetia frames failed either holdout registration or the independent archived-intercept check. They contribute no runtime pixels. Each body's `README.md` records the original identifiers and decisions.

- `source-restore.json`: ten new original files and companions fetched through the official acquisition plans, followed by complete manifest verification. Previously pinned inputs were copied from their verified closure.
- `contributors/ida/` and `contributors/gaspra/`: lossless per-source blend-weight planes before and after, decoded/compressed hashes, area samples and source image identities. Weights sum to one at supported grid cells and zero in gaps.
- `osiris-coverage.json`: before/after measurements, overlap fits and the hashes/counts of lossless per-atlas-texel source indices. The index files live beside each body's prepared outputs and are excluded from runtime delivery. Atlas indices include bleed; the coverage estimate does not count bleed.
- `*-source-camera.png`: original detector photographs beside projected reference maps or source-shape footprints. These are registration diagnostics, not browser pixel parity.
- `visuals.json` and `*-comparison.png`: final browser captures with the old and new atlas bytes at identical encoded view URLs. The comparison includes an absolute RGB difference panel and verifies atlas hashes, camera transforms, viewport and Shadows off.
- `runtime-delivery.json`: local hash checks, HEAD verification of changed content-addressed assets, and a fresh remote installation of all four inventories.
- `validation.json`: final integrated tests and browser checks.

## Reproduction

Build the existing packages and preparation tools, then acquire each body's source closure with `node tools/objects/dist/operations.js acquire <body>`. The original downloads and byte/hash pins are in each body's acquisition plan and source manifest. Python camera checks require NumPy, SciPy, Astropy, Pillow and SpiceyPy.

For Ida/Gaspra, use `verify-catalog-camera.py SOURCE OUT` for the first frame. Add `--frame 202560500 --profile reference/registration-202560500.json` for Ida or `--frame 107318313 --profile reference/registration-107318313.json` for Gaspra. The four measured patches, exact source hashes and tolerances are in the checked-in registration reports.

For Šteins/Lutetia, use `prepare-archived-camera.py SOURCE` for the original camera and `--profile preparation/<image>-camera.json` for the added camera. Profiles and generated camera inputs bind the original image, shape and kernels.

Prepare the body with `node tools/objects/dist/prepare-authored.js <body> --write`. Galileo contribution evidence is reproducible with `node tools/objects/terrestrial-layers/audit-camera-mosaic.mjs SOURCE OUT`. OSIRIS source indices are emitted by the ordinary preparation path. Static heliocentric context is retained from the integration base for this surface-only change; preparation-time changes to unrelated orbital paths are not included.

## Validation result

The four changed packages pass 107 focused body, source/runtime closure, mosaic, registry and router tests; all 60 object browser conformance cases; and production DOM/photographic-dataset checks at DPR 1 and 2. The production build generated 408 pages, assembled all 406 registered objects, and every built object transport matches its descriptor hash. The renderer rebuild is byte-identical. See `validation.json` for the tested implementation and integration base.

The repository-wide preparation run remains **not green**: 1,666 of 1,957 tests pass. Failures outside these four bodies include missing original inputs, a directory rule rejecting tracked `.gitignore` files, stale snapshots and older local public files. The global platform and shell audits were stopped and are not claimed as passing. `broader-checks.json` records the failure names and unchanged examples. A later upstream overview/navigation change is not included in the tested implementation.
