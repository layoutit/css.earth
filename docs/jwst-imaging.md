# JWST imaging

JWST images reach this project as MAST products: calibrated exposures and the mosaics the pipeline builds from them. This guide describes how a band becomes part of a sky band composite, and what was measured. The time-series route for eclipse mapping ([eclipse-mapping.md](eclipse-mapping.md)) shares the toolchain and MAST access; nothing else.

## Stages

1. **Pin.** `tools/objects/jwst/imaging/archive.mts <program id> <crds context> <level-3 obs_id>...` asks MAST for each level-3 observation's mosaic, its image3 association and the level-2 `_cal` exposures that association names. It writes them as an imaging program in `tools/objects/jwst/imaging/programs/`, each file by URI and size. The band comes from the product's filter and pupil ([bands.mts](../tools/objects/jwst/imaging/bands.mts)); NIRCam's long-wave narrow filters are FILTER F444W with the narrow filter in the pupil wheel. Digests are added the first time a file is downloaded.
2. **Reproduce.** `image3.mts <program> <band> <work>` re-runs the pipeline's level-3 stage (calwebb_image3: tweakreg, skymatch, outlier detection, resample) from those exposures. It uses the pinned toolchain ([toolchain.json](../tools/objects/jwst/toolchain.json), jwst 2.0.1) and the program's CRDS context. `compare.mts` then checks the result against MAST's own mosaic at the same sky positions and writes a receipt beside the program.
3. **Resample once.** With `--grid <recipe.json>` the same stage writes straight onto a sky band recipe's TAN grid, north up at the recipe's pixel scale. The exposures are drizzled once, instead of drizzled by MAST and resampled again.
4. **Compose.** A sky band recipe names a JWST band in one of two ways. `{ band, program, sciSha256 }` uses the stage-3 mosaic on the recipe grid. It is pinned by the digest of its SCI data, because its headers carry run dates and paths. `{ band, product, sha256, bytes }` uses MAST's level-3 mosaic, which the composer resamples onto the grid through `fits-sky.mts` `skyProjection`. Both are MJy/sr as the pipeline calibrated them. The composer then applies the usual background and peak percentiles and the shared asinh display ([color-preparation.md](color-preparation.md#sky-survey-bands)). `pointSources: "mask"` reports stars as no coverage, for a lens that places the image in depth.
5. **Depth.** An image gets depth only from a fitted three-dimensional model: `src/preparation/volume/column-depth.ts` spreads each sky column over the model's depth profile for that column. The column keeps its measured value, and every channel shares the profile, so the image is reproduced from the front. A column the model leaves empty is dropped and its share is reported. Nothing is extruded.

## Measured

On NGC 3132 (programme 2733), NIRCam F470N, eight long-wave exposures:

- **Reproduction** ([receipt](../tools/objects/jwst/imaging/programs/ngc-3132-2733.NIRCAM-F470N.reproduction.json)). The re-run has MAST's grid shape and rotation. Its reference point sits within 0.21 pixel of MAST's. Up to the 99.9th brightness percentile, its median brightness is within 0.2% of MAST's in every bin; star cores differ by 0.4%. Pixel by pixel the RMS difference is 6% of the RMS brightness, because the alignment differs at the sub-pixel level. Aligning absolutely to Gaia DR3 changes the grid (2357 × 2347 against MAST's 2356 × 2348), so MAST did not.
- **Determinism.** Two runs onto the same 1024 × 1024 grid produce identical SCI, ERR and WHT data. The files differ only in their headers.
- **Two routes.** F470N through the stage-3 grid mosaic and through MAST's mosaic resampled by the composer agree: background 0.473 against 0.474 MJy/sr, peak 62.44 against 62.18 MJy/sr, display correlation 0.9998. The stage-3 route leaves 1,090 edge pixels uncovered that MAST's mosaic covers.
- **Cost.** The stage peaks at 2.3 GiB of resident memory and takes 80–95 s for eight exposures. `image3.mts` stops a run that passes its ceiling (3 GiB by default) and does not start without twice the ceiling free. Keeping the exposure library on disk (`in_memory: false`) is what brings outlier detection under that ceiling. MAST's own F187N mosaic composes onto a 1024 × 1024 grid in 2.3 s at 0.59 GB, reading only the rows the grid covers.

## Limits

- The re-run trusts MAST's level-2 exposures. Stages 1 and 2 are not re-run.
- Distortion-corrected mosaics are required. `skyProjection` refuses SIP, TPV and PV cards rather than approximating them.
- Detail finer than the depth model's cells has no depth of its own. It sits wherever the model puts matter along its column.
