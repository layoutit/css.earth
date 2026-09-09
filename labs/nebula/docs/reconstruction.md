# Reconstruction

The Reconstruction view repaints the exact density cloud shown in Alignment with saved starless images. It uses the same retained PolyCSS scene as the other lab view.

## Controls

1. Finish **Remove stars** in Alignment for the chosen image.
2. Open `/reconstruction` and choose the source. A completed version loads immediately; an unprocessed source keeps the previous cloud visible and reports Ready to process.
3. Press **Process**. This captures the selected native NOX result and the image's current saved Alignment placement. Merely choosing a source does not bake it.
4. Watch progress or press **Cancel**. Refresh reconnects to the existing job; it does not enqueue a duplicate.
5. Switch source images to compare completed versions at the retained camera pose. The Alignment density is the shared shape reference.

LMC's VISTA, WISE and Horálek images have verified source-registration evidence. SMC's density model remains available; a registered image and completed removal must be supplied before extending its reconstruction pipeline.

## What Process does

- Pins Alignment’s full-density descriptor, existing 144 prepared quads and source grid. The older 416-slice photo-derived benchmark is not this cloud.
- Keeps the full saved image placement, including the authored scale/rotation fit. Reads native NOX colors and samples them through the same observer rays as Alignment.
- Changes chromaticity only: every quad and decoded alpha byte stays identical to Alignment. Outside the photo or at zero RGB, retain explicitly counted neutral density color.
- Preserves observed stellar records and uses one configured reference fit to condition their modeled depths on actual density. All materials share the same 943 resulting stars and encoded cutoff signal.
- Writes the original-image comparison plane, nine source landmarks, material textures and hash/provenance records, then finalizes the complete local result atomically.

**Earth view** uses the same observer and framing in both tabs. **Original image** and its independent opacity compare the photograph with the painted cloud. A direct cross-tab check compares the same nine image landmarks at Earth view; a reconstruction checking only its own mapping is insufficient.

Changing an Alignment placement requires Process again. An older saved reconstruction records its original fit; it cannot silently track a later edit to the image. Source switching preserves the camera and loads completed variants without reprocessing.

Cloud brightness, cutoff and the star toggle remain available. Star **Exposure** scales the shared prepared magnitude-based light; **Size** scales point diameters. Point size and opacity are prepared together so faint stars recede without becoming uniformly bright dots. Their brightness stays the same when switching image material. See [validation and remaining limits](slice-stability.md).

## Saved state

Native removal images, reconstruction jobs and completed volume banks are separate local caches. The chosen source/job/result and Alignment placement survive reload. Cancelled or failed work does not replace the previous result. A server restart can interrupt an unfinished job; it is not automatically restarted.

A new source/removal result or changed placement requires Process again. Results are local artifacts until deliberately promoted into a checked-in prepared model. Promotion is separate from pressing Process.

## Method limits and next experiment

The Alignment cloud is simulated stellar density. Earlier implementations substituted either a freshly sampled volume or the older photo-derived benchmark, and stripped the Alignment fit. Both broke the user-visible correspondence. Current processing retains Alignment’s actual prepared density bank and placement. VISTA, WISE and optical images share nearly the same observing direction and trace different signals; they are not multiview triangulation inputs.

Keep their color treatments separate. The next useful experiment is one fixed Tarantula crop with connected volumetric structures and constrained depth, compared against the baseline at fixed front/oblique cameras. Improving only the front-image loss is insufficient.

- [Wenger et al.: astronomical compressed-sensing tomography](https://www.graphics.rwth-aachen.de/publication/03269/) uses priors such as symmetry for single-view nebula visualization. Those assumptions are not additional observations.
- [Differentiable Direct Volume Rendering](https://www.cs.cit.tum.de/en/cg/research/publications/2021/differentiable-direct-volume-rendering/) supplies a way to fit a volume through an image-formation model; structural priors still determine otherwise unconstrained depth.
- [Edenhofer et al.: 3D dust mapping](https://arxiv.org/abs/2308.01295) uses stellar distances and extinction. Its nearby Milky Way coverage can inform a later Orion study, not the LMC's internal depths.
- [SHAPE](https://arxiv.org/abs/1003.2012) combines structural models with observational constraints, useful for later planetary nebulae when spectra/kinematics are available.

Changing the delivery representation to NeRF or Gaussian splats alone would not supply these missing constraints. The lab keeps offline volumes and CSS delivery while testing better structure assumptions.
