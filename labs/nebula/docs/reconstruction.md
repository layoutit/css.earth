# Reconstruction

The Reconstruction view repaints one accepted benchmark cloud with saved starless images. It uses the same retained PolyCSS scene as the other lab view.

## Controls

1. Finish **Remove stars** in Alignment for the chosen image.
2. Open `/reconstruction` and choose the source. A completed version loads immediately; an unprocessed source keeps the previous cloud visible and reports Ready to process.
3. Press **Process**. This captures the selected native NOX result and the image's current saved Alignment placement. Merely choosing a source does not bake it.
4. Watch progress or press **Cancel**. Refresh reconnects to the existing job; it does not enqueue a duplicate.
5. Switch source images to compare completed versions at the retained camera pose. The original benchmark is the shared shape reference.

LMC's VISTA, WISE and Horálek images have verified source-registration evidence. SMC's density model remains available; a registered image and completed removal must be supplied before extending its reconstruction pipeline.

## What Process does

- Pins the accepted benchmark cloud, its existing 416 quads, source textures, reference projection and 943-star catalogue.
- Resolves candidate image registration into that fixed cloud frame. The separate raw-simulation preview fit is removed; additional per-image corrections remain.
- Reads the full-native NOX diffuse image and samples color on a 1024px registered plane. It does not extract stars again.
- Paints image chromaticity onto existing slice texels. Geometry and every decoded alpha byte remain identical to the benchmark, even when the source image is much brighter or fainter.
- Keeps benchmark color outside candidate coverage or at zero-RGB samples, with explicit coverage accounting. Image brightness never creates density or changes thickness.
- Preserves star positions, inferred depths, photometry and cutoff signals exactly. The shared reference projection drives cutoff for every image.
- Writes the original image with its stars as a prepared comparison plane, plus compressed material textures, provenance and resource hashes.
- Atomically finalizes the local result. The viewer decodes it before switching and preserves the camera across material choices.

**Earth view** resets to the reference observer. **Original image** overlays the selected original, with an independent opacity slider. It uses exactly the painter's registered coordinates and stays below catalogue stars. Rotate/zoom back to Earth view to judge registration; an image plane cannot establish gas depth.

The cloud remains one fixed reference object. Brightness, cutoff and the star toggle remain available. Source images provide different colors, not new shapes or inferred member stars.

For direction checks and the earlier calibration experiment, see [slice stability](slice-stability.md).

## Saved state

Native removal images, reconstruction jobs and completed volume banks are separate local caches. The chosen source/job/result and Alignment placement survive reload. Cancelled or failed work does not replace the previous result. A server restart can interrupt an unfinished job; it is not automatically restarted.

A new source/removal result or changed placement requires Process again. Results are local artifacts until deliberately promoted into a checked-in prepared model. Promotion is separate from pressing Process.

## Method limits and next experiment

The fixed benchmark is a modeled cloud with inferred depth. Replacing it with the raw stellar field made an overly diffuse shape; deriving new shapes from each candidate image also failed. Process now preserves the accepted benchmark and changes its material only. VISTA, WISE and optical images have nearly the same observing direction and trace different signals; they are not multiview triangulation inputs.

Keep their color treatments separate. The next useful experiment is one fixed Tarantula crop with connected volumetric structures and constrained depth, compared against the baseline at fixed front/oblique cameras. Improving only the front-image loss is insufficient.

- [Wenger et al.: astronomical compressed-sensing tomography](https://www.graphics.rwth-aachen.de/publication/03269/) uses priors such as symmetry for single-view nebula visualization. Those assumptions are not additional observations.
- [Differentiable Direct Volume Rendering](https://www.cs.cit.tum.de/en/cg/research/publications/2021/differentiable-direct-volume-rendering/) supplies a way to fit a volume through an image-formation model; structural priors still determine otherwise unconstrained depth.
- [Edenhofer et al.: 3D dust mapping](https://arxiv.org/abs/2308.01295) uses stellar distances and extinction. Its nearby Milky Way coverage can inform a later Orion study, not the LMC's internal depths.
- [SHAPE](https://arxiv.org/abs/1003.2012) combines structural models with observational constraints, useful for later planetary nebulae when spectra/kinematics are available.

Changing the delivery representation to NeRF or Gaussian splats alone would not supply these missing constraints. The lab keeps offline volumes and CSS delivery while testing better structure assumptions.
