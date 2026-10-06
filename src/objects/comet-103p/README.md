# 103P/Hartley 2

103P/Hartley 2 is the elongated, two-lobed comet visited by EPOXI in 2010. The nucleus shows the published shape model, an EPOXI photographic mosaic, a map of how well the shape is constrained, and two infrared views.

## Sources

- The original [Farnham & Thomas (2013) PDS dataset](https://pdssbn.astro.umd.edu/holdings/dif-c-hriv_mri-5-hartley2-shape-v1.0/dataset.shtml) supplies 16,022 planetocentric vertices and 32,040 zero-indexed triangles.

- The EPOXI mosaic combines three MRI images and two mission-restored HRI images from the short 4 November 2010 encounter sequence. See [the photographic source record](source/reference/encounter-photography.md).

- [Thomas et al. (2013)](https://ntrs.nasa.gov/api/citations/20140009994/downloads/20140009994.pdf), Figures 3 and 7, maps the waist and smooth large-lobe terrain in the same east-positive planetocentric frame as the PDS shape model. The three source landmarks retain its published panel centres or a plainly approximate regional point ([landmark source record](source/features/landmarks.json)).

- The [PDS version 3 calibrated HRI-IR spectra](https://pds-smallbodies.astro.umd.edu/holdings/dif-c-hrii-3_4-epoxi-hartley2-v3.0/dataset.shtml) from 4 November 2010 supply the infrared views.

[Investigation ledger](investigations.json): tested alternatives and the evidence needed to revisit them.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Shape and photographs

The shape model marks each vertex as stereo control (7431 vertices), limb silhouette (4745) or not well constrained (3846). The Source constraints view shows these as solid gray, blue and the shared gray grid. Meshoptimizer reduces the mesh to 600 triangles while keeping original source vertices; original-mesh normals and cast shadows are baked into fixed atlases. The published equivalent-volume radius, 0.58 km, supplies scale only. JPL Horizons elements supply heliocentric placement. No dust, tails, jets or tumble simulation is included.

In the photographic view, which is the default, the finest accepted detector sampling supplies each patch, and MRI fills regions outside the HRI footprints.

## Infrared views

**Color temperature** and **Infrared slope** come from the HRI-IR spectra. The first shows a fitted temperature, weighted toward warmer parts of a detector pixel. The second measures how reflected sunlight changes across 1.5–2.2 µm, in percent per 100 nm. It does not measure terrain steepness or identify minerals. Both are false-color, partial views with approximate placement on the 2012 shape.

The [shared fitter](../../../packages/bake/src/objects/layers/terrestrial/missions/hrii-spectra.ts) follows the spectral separation in [Groussin et al. (2013), §§2.2–2.3, equations 1–4](https://doi.org/10.1016/j.icarus.2012.10.003): a solar-normalized continuum anchored at 1.8 µm and a Planck spectrum with a free amplitude over 3.1–4.4 µm. All nonzero detector flags are rejected, and only stereo-controlled facets below 75° of incidence and emission qualify. The [scan recipe](source/science/hrii/scan.json) pins the original exposures and controls, and the [preparation record](source/science/hrii/preparation.json) gives coverage, fit residuals and withheld-pixel counts.

The selected scan yields 162 accepted spatial pixels and 757 of the model's 32,040 facets. These are facet counts, not area percentages. The retained values span 337.2–364.3 K and −0.077–4.490%/100 nm. The grid marks rejected spectra, unsupported shape, and gaps; it is not filled from nearby values.

## Evidence

- A trial with the published Hapke parameters reduced accepted photographic area from 57.98% to 32.00%, so the original EPOXI mosaic remains in use.
- [Six native-row fixtures](../../../packages/bake/src/objects/layers/terrestrial/missions/fixtures/comets/hrii-native-reference.json), calculated independently with Astropy and SciPy, agree with the TypeScript fitter within 0.05 K and 0.01 percentage points per 100 nm. These check decoding and fitting, not absolute temperature accuracy.
- The infrared context image is tied to the body frame with a held-out RMS of 17.2 m. The slit fit gives 1.350 native pixels RMS on retained terrain locations.
- The [encounter FITS reader test](../../../packages/bake/src/objects/layers/terrestrial/missions/encounter-fits.oracle.test.mts) checks the pinned MRI product against an astropy reader.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mri` | 5 | 0 | — | — | — | its other 5 frames | 4 of 5 | 0.50° | 0 of 5 | — | ×1.02 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Infrared placement is coarse. Terrain residuals test alignment relative to the existing photographic/body frame; they do not establish an independent absolute position. That frame inherits source shape and earlier photographic-anchor uncertainty. Temperature and slope pixels must not be used to locate small surface features.
- These are new fits to PDS version 3 spectra, not a reproduction of the 2013 paper's published maps. That paper used earlier calibration and different meshes. Its quoted temperature errors cannot simply be assigned to these views. Calibration, unresolved temperature mixtures, scattered light and geometric uncertainty remain.
- The grid in the Source constraints view means poorly constrained by stereo or limb methods, not necessarily wholly unobserved. Neither view claims observed albedo.
- EPOXI photographic coverage is about 56% of the displayed surface; the remaining grid has no accepted photograph/shape correspondence. Original shadows and restoration grain remain.
- The cartographic north direction follows the long axis at the 2010 encounter, not a spin pole. Hartley 2 tumbles; this display holds an arbitrary rotational phase and does not simulate that motion.
- The landmarks are mapped terrain, not official names or precise boundaries. Two are published figure-panel centres; the elongate smooth area is a representative point read from the map. The ±3° and ±12° placement estimates are ours, not published measurement errors.
- No measured mass or GM is claimed. The orbit omits perturbations and outgassing.
