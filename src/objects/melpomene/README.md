# Melpomene

Melpomene is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on its published reconstruction, which combines resolved telescope images with an ADAM starting shape, with a SPHERE photograph and an Elevation view.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/18_Melpomene_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-05-04 to 2019-08-06](https://observations.lam.fr/astero/Data/18Melpomene/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/18_Melpomene_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/18_Melpomene_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.15](https://doi.org/10.1051/0004-6361/202141781) |

Vernazza et al. (2021) give a volume-equivalent diameter of 141 km, ecliptic J2000 pole (12°, 19°) and sidereal period 11.570306 h. The [original MPCD mesh](https://observations.lam.fr/astero/3Dshape/18_Melpomene_mpcd.obj) has 2162 vertices and 4320 triangles in kilometers. Its measured volume-equivalent radius is 70.545316 km; the coordinates are not rescaled to the survey's averaged diameter.

## Processing

The mesh is simplified with meshoptimizer 1.2.0 to 772 native PolyCSS triangles, the fewest within its 1200 m error allowance. Geometry and lighting are prepared ahead of runtime. The original frame is kept with +Z north and east-positive longitude. Rotation has an arbitrary display meridian, not an absolute rotational phase.

Elevation samples the original mesh radius minus a 70.5 km reference sphere, with a -20 to 20 km legend. It includes global shape, not height above a gravitational equipotential.

The SPHERE photograph shows photographed illumination from the deconvolved frames, with matched relative frame levels. Each apparition is placed through the surface it shares with another; frames are averaged where they overlap, each fading out toward its disc edge.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.15](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-05-04 01:13:08 | 0.931 | 0.942 | 0.948 | -10° | -3.5°, 1° | 79.1° against 77.0° |
| 2018-05-04 02:27:39 | 0.933 | 0.928 | 0.950 | 0° | 3.5°, 6° | 79.1° against 77.2° |
| 2019-06-21 08:51:41 | 0.958 | 0.958 | 0.963 | 0° | -1.5°, 3° | 156.7° against 154.7° |
| 2019-07-18 07:06:41 | 0.963 | 0.928 | 0.965 | 0° | -1.5°, 3.5° | 157.8° against 155.9° |
| 2019-08-03 01:57:37 | 0.918 | 0.952 | 0.964 | -10° | -5°, -1° | 158.4° against 156.4° |
| 2019-08-06 04:59:38 | 0.943 | 0.932 | 0.965 | -10° | 0°, 5° | 158.5° against 156.5° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.211 px at our phase; the lowest of a ±30° sweep is 1.141 px at 4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 5 | 4.63° | 4.92° | 0.00° | its other 30 frames | 0 of 30 | — | 12 of 30, -2.00° | — | ×1.12 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.15](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 667.6 m and maximum 1193.7 m between source and display mesh. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features.

## Known problems

- Shape uses the neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- The SPHERE photograph is not albedo or color. The frames see Melpomene from 5° south to 56° north, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
