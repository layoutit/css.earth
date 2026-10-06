# Julia

Julia is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on its published reconstruction, which combines resolved telescope images with an ADAM starting shape, with a SPHERE photograph and an Elevation view.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/89_Julia_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [32 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 8 nights from 2017-07-08 to 2017-10-07](https://observations.lam.fr/astero/Data/89Julia/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/89_Julia_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/89_Julia_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.31](https://doi.org/10.1051/0004-6361/202141781) |

Vernazza et al. (2021) give a volume-equivalent diameter of 140 km, ecliptic J2000 pole (14°, -24°) and sidereal period 11.388336 h. The [original MPCD mesh](https://observations.lam.fr/astero/3Dshape/89_Julia_mpcd.obj) has 3026 vertices and 6048 triangles in kilometers. Its measured volume-equivalent radius is 69.163413 km; the coordinates are not rescaled to the survey's averaged diameter.

## Processing

The mesh is simplified with meshoptimizer 1.2.0 to 708 native PolyCSS triangles, the fewest within its 1300 m error allowance. Geometry and lighting are prepared ahead of runtime. The original frame is kept with +Z north and east-positive longitude. Rotation has an arbitrary display meridian, not an absolute rotational phase.

Elevation samples the original mesh radius minus a 70 km reference sphere, with a -20 to 30 km legend. It includes global shape, not height above a gravitational equipotential.

The SPHERE photograph shows photographed illumination from the deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.31](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-07-08 09:22:49 | 0.900 | 0.905 | 0.965 | 0° | 0.5°, 0.5° | 30.3° against 28.1° |
| 2017-07-10 09:13:55 | 0.908 | 0.929 | 0.962 | 0° | -5°, -1° | 30.9° against 28.4° |
| 2017-07-14 09:47:36 | 0.944 | 0.940 | 0.963 | 0° | 0°, 1° | 32.0° against 30.6° |
| 2017-08-08 04:48:20 | 0.957 | 0.941 | 0.971 | 0° | -2°, 0° | 35.8° against 33.7° |
| 2017-08-23 02:51:42 | 0.964 | 0.959 | 0.971 | 0° | -2°, -2° | 35.3° against 33.1° |
| 2017-08-24 02:57:48 | 0.967 | 0.960 | 0.977 | 0° | -2°, 2° | 35.2° against 33.5° |
| 2017-10-02 01:20:25 | 0.921 | 0.901 | 0.974 | 100° | -8°, -8° | 30.3° against 28.5° |
| 2017-10-07 01:44:06 | 0.940 | 0.939 | 0.971 | 0° | -1°, -1° | 29.9° against 27.7° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 32 native frames after the centre fit is 1.684 px at our phase; the lowest of a ±30° sweep is 1.669 px at 2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 32 | 19 | 29.99° | 6.72° | 29.23° | its other 32 frames | 0 of 32 | — | 21 of 32, -2.00° | — | ×1.39 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.31](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 701.8 m and maximum 1355.2 m between source and display mesh. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features. Re-prepared 2026-10-06: the error allowance now decides the face count, 708 faces at 1289 m estimated simplifier error; checks and sampled distances recorded here before that date describe the earlier 800-face mesh.

## Known problems

- Shape uses the neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- The SPHERE photograph is not albedo or color. The frames see Julia from 35° to 52° south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
