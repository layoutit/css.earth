# 52 Europa

52 Europa is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on its published reconstruction, which combines resolved telescope images with an ADAM starting shape, with a SPHERE photograph and an Elevation view.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/52_Europa_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [65 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 7 nights from 2018-07-08 to 2019-08-06](https://observations.lam.fr/astero/Data/52Europa/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/52_Europa_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/52_Europa_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.27](https://doi.org/10.1051/0004-6361/202141781) |

Vernazza et al. (2021) give a volume-equivalent diameter of 319 km, ecliptic J2000 pole (255°, 40°) and sidereal period 5.629954 h. The [original MPCD mesh](https://observations.lam.fr/astero/3Dshape/52_Europa_mpcd.obj) has 3666 vertices and 7328 triangles in kilometers. Its measured volume-equivalent radius is 159.129728 km; the coordinates are not rescaled to the survey's averaged diameter.

## Processing

The mesh is simplified with meshoptimizer 1.2.0 to 800 native PolyCSS triangles, each a 128 × 128 px raster leaf. Geometry and lighting are prepared ahead of runtime. The original frame is kept with +Z north and east-positive longitude. Rotation has an arbitrary display meridian, not an absolute rotational phase.

Elevation samples the original mesh radius minus a 159.5 km reference sphere, with a -50 to 40 km legend. It includes global shape, not height above a gravitational equipotential.

The SPHERE photograph shows photographed illumination from the deconvolved frames, with matched relative frame levels. Each apparition is placed through the surface it shares with another; frames are averaged where they overlap, each fading out toward its disc edge.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.27](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-07-08 06:15:40 | 0.970 | 0.955 | 0.973 | 0° | -2°, -0.5° | 36.6° against 34.6° |
| 2018-07-08 07:17:12 | 0.972 | 0.969 | 0.972 | 0° | -1.5°, -1° | 36.6° against 34.7° |
| 2018-07-08 08:33:04 | 0.974 | 0.971 | 0.977 | 0° | 0°, 0° | 36.6° against 34.5° |
| 2018-07-10 02:47:21 | 0.971 | 0.968 | 0.976 | 0° | -1.5°, 0° | 36.9° against 34.8° |
| 2018-07-13 07:35:42 | 0.974 | 0.964 | 0.976 | 0° | -2.5°, -2.5° | 37.4° against 35.3° |
| 2018-08-10 05:07:42 | 0.968 | 0.963 | 0.976 | 0° | -1.5°, -3° | 42.5° against 40.4° |
| 2019-07-30 07:21:44 | 0.951 | 0.942 | 0.968 | 10° | -2.5°, -2.5° | 17.8° against 15.9° |
| 2019-07-30 09:37:15 | 0.926 | 0.931 | 0.975 | 20° | -8°, -8° | 17.8° against 15.8° |
| 2019-08-05 06:52:39 | 0.938 | 0.958 | 0.971 | 10° | -4°, -1.5° | 17.7° against 15.6° |
| 2019-08-05 07:30:28 | 0.942 | 0.941 | 0.967 | 0° | -3°, -3° | 17.7° against 15.8° |
| 2019-08-05 08:22:05 | 0.958 | 0.954 | 0.971 | -10° | -4.5°, -1° | 17.7° against 15.8° |
| 2019-08-06 08:57:18 | 0.951 | 0.949 | 0.971 | 0° | -4.5°, -1.5° | 17.7° against 15.7° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 65 native frames after the centre fit is 2.369 px at our phase; the lowest of a ±30° sweep is 2.330 px at -6°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 65 | 52 | 7.31° | 3.84° | 6.22° | its other 65 frames | 0 of 65 | — | 9 of 65, 6.25° | — | ×1.58 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.27](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1583.9 m and maximum 3227.6 m between source and display mesh. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features.

## Known problems

- Shape uses the neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- The SPHERE photograph is not albedo or colour. The frames see Europa from 38° south to 25° north, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
