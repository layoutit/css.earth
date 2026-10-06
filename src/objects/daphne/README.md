# Daphne

Daphne is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on its published reconstruction, which combines resolved telescope images with an ADAM starting shape, with a SPHERE photograph and an Elevation view.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/41_Daphne_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [15 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 2018-08-06](https://observations.lam.fr/astero/Data/41Daphne/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/41_Daphne_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/41_Daphne_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.23](https://doi.org/10.1051/0004-6361/202141781) |

Vernazza et al. (2021) give a volume-equivalent diameter of 187 km, ecliptic J2000 pole (199°, -32°) and sidereal period 5.98798 h. The [original MPCD mesh](https://observations.lam.fr/astero/3Dshape/41_Daphne_mpcd.obj) has 2866 vertices and 5728 triangles in kilometers. Its measured volume-equivalent radius is 93.180182 km; the coordinates are not rescaled to the survey's averaged diameter.

## Processing

The mesh is simplified with meshoptimizer 1.2.0 to 700 native PolyCSS triangles, the fewest within its 1700 m error allowance. Geometry and lighting are prepared ahead of runtime. The original frame is kept with +Z north and east-positive longitude. Rotation has an arbitrary display meridian, not an absolute rotational phase.

Elevation samples the original mesh radius minus a 93.5 km reference sphere, with a -20 to 50 km legend. It includes global shape, not height above a gravitational equipotential.

The SPHERE photograph shows photographed illumination from the deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.23](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-08-06 06:26:16 | 0.952 | 0.954 | 0.965 | 0° | -2.5°, -1.5° | 117.4° against 114.7° |
| 2018-08-06 07:38:35 | 0.954 | 0.945 | 0.963 | 0° | -1°, 1.5° | 117.4° against 115.4° |
| 2018-08-06 09:32:00 | 0.949 | 0.945 | 0.969 | 0° | -1°, 0.5° | 117.4° against 116.2° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 15 native frames after the centre fit is 1.323 px at our phase; the lowest of a ±30° sweep is 1.320 px at 2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 15 | 14 | 7.07° | 4.44° | 5.50° | its other 15 frames | 1 of 15 | — | 0 of 15 | — | ×1.07 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.23](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 869.1 m and maximum 1739.0 m between source and display mesh. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features. Re-prepared 2026-10-06: the error allowance now decides the face count, 700 faces at 1682 m estimated simplifier error; checks and sampled distances recorded here before that date describe the earlier 800-face mesh.

## Known problems

- Shape uses the neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- The SPHERE photograph is not albedo or color. The frames see Daphne from 51° north, so surface the survey did not see keeps the missing-imagery grid.
- The 2017-05-20 apparition (5 frames) is left out. The level fit found no accepted overlap between it and the 2018-08-06 frames: the best pair shared 59 display samples within its angle limit, fewer than the 128 it needs. Without one, their level cannot be placed, so the figure's 2017 column shows no dataset frame.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
