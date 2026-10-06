# (187) Lamberta

Lamberta is shown on an ADAM nonconvex reconstruction constrained by VLT/SPHERE images, with Shape, Elevation and SPHERE photograph views.

Shape-only views use the shared neutral gray (#808080 sRGB), a display convention, not a measurement of surface color or albedo.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5914](https://damit.cuni.cz/projects/damit/asteroid_models/view/5914) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |
| SPHERE photograph | [25 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-03-15 to 2018-05-04](https://observations.lam.fr/astero/Data/187Lamberta/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/187_Lamberta_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/187_Lamberta_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.36](https://doi.org/10.1051/0004-6361/202141781) |

Credit: DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5914, version 2021-11-12. The volume-equivalent diameter is 141 ±2 km. The older convex [model 1086](https://damit.cuni.cz/projects/damit/asteroid_models/view/1086) is an alternative; the MPCD refinement's LAM release could not be retrieved. The [investigation ledger](investigations.json) records the source survey.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Processing

The unmodified source has 902 vertices and 1800 triangles. One uniform scale of 0.99933532370243183 km per source unit gives a volume-equivalent diameter of 141 km. The source pole is ecliptic J2000 (115°, -80°), with sidereal period 10.667 h, converted to equatorial J2000. Meshoptimizer reduces the mesh to 306 closed faces. Elevation is radius above a 70.5 km sphere, a shape-derived scalar, not gravitational height. The photograph uses matched relative frame levels, averaged where frames overlap and fading out toward each disc edge.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.36](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-03-15 09:05:28 | 0.965 | 0.948 | 0.967 | 0° | 0°, -0.5° | 119.8° against 117.8° |
| 2018-03-26 08:31:26 | 0.962 | 0.953 | 0.967 | 0° | -3°, 3° | 120.0° against 118.0° |
| 2018-04-20 08:28:21 | 0.970 | 0.964 | 0.972 | 0° | -2.5°, -1.5° | 121.3° against 119.3° |
| 2018-04-24 06:36:58 | 0.968 | 0.968 | 0.972 | 0° | -2°, -2.5° | 121.5° against 119.4° |
| 2018-05-04 05:30:49 | 0.969 | 0.953 | 0.973 | 0° | 0.5°, 4.5° | 122.0° against 120.1° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 25 native frames after the centre fit is 0.935 px at our phase; the lowest of a ±30° sweep is 0.926 px at -4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 25 | 17 | 12.52° | 2.15° | 12.33° | its other 25 frames | 0 of 25 | — | 20 of 25, 1.00° | — | ×1.08 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.36](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The maximum sampled source-to-display distance is **1027.70 m**. This is a sampled comparison, not an exhaustive error bound.

## Known problems

- The pinned mesh is an inverse model, not a directly sampled surface. Fine-scale craters, regolith and albedo are unresolved.
- Absolute rotational phase is arbitrary and the accelerated display spin is illustrative.
- The SPHERE photograph is photographed illumination, not albedo or color. The frames see Lamberta from 4° south to 3° north, so surface the survey did not see keeps the missing-imagery grid.
