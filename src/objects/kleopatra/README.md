# Kleopatra

Kleopatra is shown as its released shape model and as a photograph built from VLT/SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/216_Kleopatra_mpcd.obj), [Marchis et al. (2021)](https://doi.org/10.1051/0004-6361/202140874) |
| SPHERE photograph | [55 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 10 nights from 2017-07-14 to 2019-01-14](https://observations.lam.fr/astero/Data/216Kleopatra/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/216_Kleopatra_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/216_Kleopatra_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.37](https://doi.org/10.1051/0004-6361/202141781) |

The geometry is the original `216_Kleopatra_mpcd.obj` from the [LAM VLT/SPHERE asteroid survey release](https://observations.lam.fr/astero/3Dshape/). Cite Marchis, Jorda, Vernazza et al., [(216) Kleopatra, a low density critically rotating M-type asteroid](https://doi.org/10.1051/0004-6361/202140874), A&A 653 A57 (2021), and Vernazza et al., [VLT/SPHERE imaging survey: final results and synthesis](https://doi.org/10.1051/0004-6361/202141781), A&A 654 A56 (2021). Original inputs and authored preparation data are pinned in `source/manifest.json`.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

**Shape** applies the shared neutral-gray material to the released geometry. It conveys the two lobes, their neck, and the model's broad relief. It is not a photograph, measured albedo, natural color or a map of metal abundance. The source was reconstructed with multiresolution photoclinometry by deformation (MPCD), starting with an ADAM model constrained by lightcurves, adaptive-optics images, occultations and radar. These ground-based observations do not measure small-scale terrain.

`source-meshoptimizer` simplifies the original 3,168-face mesh to 734 faces without sampling replacement radial geometry. The 734-face result has volume 855,483.71 km³, 1.12% below the original. The physical reference radius is 59.1 km, from the MPCD volume-equivalent diameter of 118.2 ±0.8 km. The pole is λ=74.1°, β=+21.6° with a 5.385282 h period; the display phase is arbitrary.

Restore with `node packages/bake/cli/object-operations.mts acquire kleopatra`; verify with `acquire kleopatra --verify-only`; prepare with `node site/build/prepare/authored/prepare-authored.ts kleopatra --write`.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.37](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-07-14 05:00:59 | 0.891 | 0.925 | 0.936 | 0° | -3.5°, -0.5° | 131.2° against 127.4° |
| 2017-07-22 04:18:07 | 0.898 | 0.921 | 0.941 | 0° | -2.5°, 0° | 130.6° against 126.7° |
| 2017-07-22 05:05:06 | 0.909 | 0.907 | 0.948 | 0° | -1.5°, -1.5° | 130.6° against 128.4° |
| 2017-07-27 04:27:42 | 0.878 | 0.848 | 0.932 | -10° | -3°, -0.5° | 130.2° against 126.6° |
| 2017-08-10 05:21:58 | 0.873 | 0.905 | 0.937 | -10° | -3°, 0° | 129.3° against 125.1° |
| 2017-08-22 01:42:34 | 0.899 | 0.889 | 0.945 | 0° | -1.5°, -3.5° | 128.8° against 126.1° |
| 2018-12-10 06:53:28 | 0.920 | 0.878 | 0.953 | 0° | -2°, 4° | 50.7° against 49.0° |
| 2018-12-19 06:57:24 | 0.900 | 0.895 | 0.945 | 0° | -4°, 4.5° | 51.7° against 51.6° |
| 2018-12-22 05:58:43 | 0.921 | 0.885 | 0.956 | 0° | -1°, 2° | 52.1° against 52.0° |
| 2018-12-26 08:08:27 | 0.926 | 0.890 | 0.949 | 0° | -2.5°, 4.5° | 52.6° against 52.7° |
| 2019-01-14 05:10:04 | 0.914 | 0.854 | 0.954 | 0° | -2.5°, 5.5° | 55.0° against 56.6° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 55 native frames after the centre fit is 2.004 px at our phase; the lowest of a ±30° sweep is 1.810 px at -2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 55 | 55 | 5.24° | 2.88° | 4.37° | its other 55 frames | 0 of 55 | — | 21 of 55, 0.00° | — | ×1.76 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.37](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

A nearest-surface comparison of 8,192 area-stratified samples on each mesh gives source-to-result mean/p95/p99/maximum distances of 231.562/662.354/926.825/1272.402 m, and result-to-source values of 233.714/660.592/934.525/1307.387 m. This is sampled evidence, not an exhaustive Hausdorff bound. Fine features become more angular at the 734-face budget.

## Known problems

Shadows defaults off. There are no terrain-cast shadows. Pole orientation is source-supported, but absolute rotation phase is deliberately arbitrary, so the lit view is not a predicted observation at the displayed date.

Elevation is deferred. The mesh has concavity near the neck and lobes, so a body-centered radius map would assign the wrong radius to farther surfaces along the same ray: in the source, the largest discrepancy is 27.5 km. No radial-height dataset is published.

No unannotated, registered global optical, geological or compositional map was established in this bounded survey.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, each apparition placed through the surface it shares with another, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or color. The frames see Kleopatra from 37° south to 32° north, so surface the survey did not see keeps the missing-imagery grid.
