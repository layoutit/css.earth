# Reconstruction

The Reconstruction view prepares and compares colored 3D volumes from saved starless images. It uses the same retained PolyCSS scene as the other lab view.

## Controls

1. Finish **Remove stars** in Alignment for the chosen image.
2. Open `/reconstruction` and choose the source. A completed version loads immediately; an unprocessed source keeps the previous cloud visible and reports Ready to process.
3. Press **Process**. This captures the selected native NOX result and the image's current saved Alignment placement. Merely choosing a source does not bake it.
4. Watch progress or press **Cancel**. Refresh reconnects to the existing job; it does not enqueue a duplicate.
5. Switch source images to compare completed versions at the retained camera pose. The original benchmark remains a separate reference.

LMC's VISTA, WISE and Horálek images have verified source-registration evidence. SMC's density model remains available; a registered image and completed removal must be supplied before extending its reconstruction pipeline.

## What Process does

- Validates the source, complete native NOX diffuse image, source registration, saved placement and stellar-prior identity.
- Maps original image pixels through the same prepared matrix/pivot and placement used by Alignment, including the CSS-to-physical axis conversion.
- Resamples native pixels into a 512px comparison analysis plane. The native starless result remains intact; this is not native-resolution 3D detail.
- Partitions compact, extended and diffuse morphology while retaining all three light contributions. It does not run a second star-removal pass.
- Assigns finite coherent depth using the existing component model and an unchanged stellar-density prior.
- Checks independent observer-ray integration and XYZ numerical convergence. The worker raises integration sampling before baking if needed; it does not relax the acceptance threshold.
- Writes lossless masters, compressed XYZ slice banks, a prepared object descriptor, provenance and an artifact manifest.
- Publishes the completed bank atomically. The browser loads and decodes it before swapping the displayed cloud.

The initial inspection model exposes the complete image-derived cloud as one all-light part. Brightness, axis calibration and integrated-signal cutoff remain available. Individually named nebular structures are a later modeling task; NOX residuals are not automatically asserted to be confirmed member stars.

## Saved state

Native removal images, reconstruction jobs and completed volume banks are separate local caches. The chosen source/job/result and Alignment placement survive reload. Cancelled or failed work does not replace the previous result. A server restart can interrupt an unfinished job; it is not automatically restarted.

A new source/removal result or changed placement requires Process again. Results are local artifacts until deliberately promoted into a checked-in prepared model. Promotion is separate from pressing Process.

## Method limits and next experiment

The current coherent model is a comparison baseline, not a demonstrated recovery of real LMC gas depth. A front image can fit well while an oblique view remains an implausible thick sheet. VISTA, WISE and optical images have nearly the same observing direction and trace different signals; they are not multiview triangulation inputs.

Keep their color treatments separate. The next useful experiment is one fixed Tarantula crop with connected volumetric structures and constrained depth, compared against the baseline at fixed front/oblique cameras. Improving only the front-image loss is insufficient.

- [Wenger et al.: astronomical compressed-sensing tomography](https://www.graphics.rwth-aachen.de/publication/03269/) uses priors such as symmetry for single-view nebula visualization. Those assumptions are not additional observations.
- [Differentiable Direct Volume Rendering](https://www.cs.cit.tum.de/en/cg/research/publications/2021/differentiable-direct-volume-rendering/) supplies a way to fit a volume through an image-formation model; structural priors still determine otherwise unconstrained depth.
- [Edenhofer et al.: 3D dust mapping](https://arxiv.org/abs/2308.01295) uses stellar distances and extinction. Its nearby Milky Way coverage can inform a later Orion study, not the LMC's internal depths.
- [SHAPE](https://arxiv.org/abs/1003.2012) combines structural models with observational constraints, useful for later planetary nebulae when spectra/kinematics are available.

Changing the delivery representation to NeRF or Gaussian splats alone would not supply these missing constraints. The lab keeps offline volumes and CSS delivery while testing better structure assumptions.
