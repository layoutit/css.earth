# JWST imaging

JWST images reach this project as MAST products: calibrated exposures and the mosaics the pipeline builds from them. This guide describes how a band becomes part of a sky band composite, and what was measured. The time-series route for eclipse mapping ([eclipse-mapping.md](eclipse-mapping.md)) shares the toolchain and MAST access; nothing else.

## Stages

1. **Pin.** `tools/objects/jwst/imaging/archive.mts <program id> <crds context> <level-3 obs_id>...` asks MAST for each level-3 observation's mosaic, its image3 association and the level-2 `_cal` exposures that association names. It writes them as an imaging program in `tools/objects/jwst/imaging/programs/`, each file by URI and size. The band comes from the product's filter and pupil ([bands.mts](../tools/objects/jwst/imaging/bands.mts)); NIRCam's long-wave narrow filters are FILTER F444W with the narrow filter in the pupil wheel. Digests are added the first time a file is downloaded.
2. **Reproduce.** `image3.mts <program> <band> <work>` re-runs the pipeline's level-3 stage (calwebb_image3: tweakreg, skymatch, outlier detection, resample) from those exposures. It uses the pinned toolchain ([toolchain.json](../tools/objects/jwst/toolchain.json), jwst 2.0.1) and the program's CRDS context. `compare.mts` then checks the result against MAST's own mosaic at the same sky positions and writes a receipt beside the program.
   A NIRCam coronagraph band ([bands.mts](../tools/objects/jwst/imaging/bands.mts) names its focal-plane mask) is pinned from a coron3 association instead: the target's per-integration `_calints` exposures at each telescope roll, and the PSF reference star's as `references`. `coron3.mts <program> <band> <work>` re-runs calwebb_coron3 from them: stack the references, align them to each integration, subtract the star by KLIP, flag outliers, and resample the rolls into one mosaic. `compare.mts` checks it the same way, and also by distance from the star, since how well the subtraction matches changes with separation.
3. **Resample once.** With `--grid <recipe.json>` the same stage writes straight onto a sky band recipe's TAN grid, north up at the recipe's pixel scale. The exposures are drizzled once, instead of drizzled by MAST and resampled again.
   `--grid` is image3's only; `coron3.mts` writes the pipeline's own grid.
4. **Compose.** A sky band recipe names a JWST band in one of two ways. `{ band, program, sciSha256 }` uses the stage-3 mosaic on the recipe grid. It is pinned by the digest of its SCI data, because its headers carry run dates and paths. `{ band, product, sha256, bytes }` uses MAST's level-3 mosaic, which the composer resamples onto the grid through `fits-sky.mts` `skyProjection`. Both are MJy/sr as the pipeline calibrated them. The composer then applies the usual background and peak percentiles and the shared asinh display ([color-preparation.md](color-preparation.md#sky-survey-bands)). `pointSources: "mask"` reports stars as no coverage, for a lens that places the image in depth.
5. **Depth.** An image gets depth only from a fitted three-dimensional model: `src/preparation/volume/column-depth.ts` spreads each sky column over the model's depth profile for that column. The column keeps its measured value, and every channel shares the profile, so the image is reproduced from the front. A column the model leaves empty is dropped and its share is reported. Nothing is extruded.

## Measured

On NGC 3132 (programme 2733), NIRCam F470N, eight long-wave exposures:

- **Reproduction** ([receipt](../tools/objects/jwst/imaging/programs/ngc-3132-2733.NIRCAM-F470N.reproduction.json)). The re-run has MAST's grid shape and rotation. Its reference point sits within 0.21 pixel of MAST's. Up to the 99.9th brightness percentile, its median brightness is within 0.2% of MAST's in every bin; star cores differ by 0.4%. Pixel by pixel the RMS difference is 6% of the RMS brightness, because the alignment differs at the sub-pixel level. Aligning absolutely to Gaia DR3 changes the grid (2357 × 2347 against MAST's 2356 × 2348), so MAST did not.
- **Determinism.** Two runs onto the same 1024 × 1024 grid produce identical SCI, ERR and WHT data. The files differ only in their headers.
- **Two routes.** F470N through the stage-3 grid mosaic and through MAST's mosaic resampled by the composer agree: background 0.473 against 0.474 MJy/sr, peak 62.44 against 62.18 MJy/sr, display correlation 0.9998. The stage-3 route leaves 1,090 edge pixels uncovered that MAST's mosaic covers.
- **Cost.** The stage peaks at 2.3 GiB of resident memory and takes 80–95 s for eight exposures. `image3.mts` stops a run that passes its ceiling (3 GiB by default) and does not start without twice the ceiling free. Keeping the exposure library on disk (`in_memory: false`) is what brings outlier detection under that ceiling. MAST's own F187N mosaic composes onto a 1024 × 1024 grid in 2.3 s at 0.59 GB, reading only the rows the grid covers.

On HIP 65426 (programme 1386), NIRCam F444W behind MASK335R, two rolls and nine PSF reference exposures:

- **Reproduction** ([receipt](../tools/objects/jwst/imaging/programs/hip-65426-1386.NIRCAM-F444W-MASK335R.reproduction.json)). The re-run is on MAST's grid, with the same shape, reference pixel and blank pixels. Correlation with MAST's mosaic is 0.9966 at 0.5–1″ from the star, 0.984 at 1–2″, 0.917 at 2–5″ and 0.995 at 5–20″. Inside 0.5″, under the mask, it is 0.66. HIP 65426 b, the brightest source beyond 0.5″ (0.78″ from the star), keeps 98.2% of MAST's flux in a 7 × 7 pixel box. The outlier-flagged exposures are identical to MAST's. The PSF-subtracted rolls are not, but they leave the same residual (RMS 0.2796 against 0.2799 MJy/sr in the first roll); the pixel differences arise in alignment and KLIP. Platform numerics are a likely cause, but that is not verified.
- **Determinism.** Two runs give identical SCI data.
- **Cost.** 17 s at 0.66 GiB resident memory.

MIRI's four-quadrant phase masks do not reproduce, measured on HIP 65426 F1140C (observation c1021). The level-2 exposures and their outlier flags are identical to MAST's, but the PSF-subtracted rolls are not: ours keep a residual RMS of 1.59 MJy/sr against MAST's 1.14, and their mosaic correlates at 0.60 at 5–20″. The pipeline's alignment step fits each reference slice with scipy's least squares at a tolerance of 1e-15. In the first roll all 90 slices stop at the 800-evaluation limit, at y-shifts from −0.45 to −1.42 pixels; across both rolls 171 of 180 fits do (NIRCam: 0 of 36). Refitted at a tolerance of 1e-8, slices with near-equal cost settle anywhere from −0.26 to −1.32 pixels, and one still does not converge. The data do not fix the shift, so the mosaic depends on where each search stopped. `coron3.mts` therefore fails a run with any unconverged alignment, and no MIRI coronagraph band is defined.

## Limits

- The re-run trusts MAST's level-2 exposures. Stages 1 and 2 are not re-run.
- Coronagraphy is NIRCam's only. MIRI's four-quadrant phase-mask alignment does not converge (above).
- Distortion-corrected mosaics are required. `skyProjection` refuses SIP, TPV and PV cards rather than approximating them.
- Detail finer than the depth model's cells has no depth of its own. It sits wherever the model puts matter along its column.
