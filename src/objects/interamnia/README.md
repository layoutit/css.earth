# Interamnia

Interamnia is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on the survey's released shape,
with a shape-only view, an elevation map and a SPHERE photograph dataset. Shape-only views use the shared neutral gray
(#808080 sRGB), a display convention, not a measured color; gaps keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/704_Interamnia_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [32 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 7 nights from 2018-12-19 to 2019-01-14](https://observations.lam.fr/astero/Data/704Interamnia/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/704_Interamnia_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/704_Interamnia_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.42](https://doi.org/10.1051/0004-6361/202141781) |

Vernazza et al. (2021) give a volume-equivalent diameter of 332 km, ecliptic J2000 pole (87°, 62°) and sidereal period
8.71234 h. The [individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) page adds model and
image comparisons.

## Processing

The MPCD mesh has 6514 vertices and 13024 triangles in unmodified kilometre coordinates, volume-equivalent radius
166.107985 km. It is not rescaled to the survey's averaged diameter. Maximum extents are 349.507 × 350.332 ×
310.142 km, not best-fit ellipsoid axes. Meshoptimizer 1.2.0 simplifies it to 800 native PolyCSS triangles, and
lighting is prepared ahead of runtime.

Elevation samples the original mesh radius minus a 166 km reference sphere, with a -20 to 20 km legend, from
721 × 361 source directions with a cartographic hillshade.

The SPHERE photograph uses the survey's deconvolved frames with matched relative frame levels, averaged where frames
overlap, each fading out toward its disc edge.

The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. Horizons elements are pinned
at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.42](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-12-19 06:20:16 | 0.971 | 0.972 | 0.977 | 0° | -1.5°, -1° | 86.7° against 84.8° |
| 2018-12-22 05:29:07 | 0.972 | 0.971 | 0.979 | 0° | -3.5°, -3.5° | 86.7° against 84.8° |
| 2018-12-29 04:48:19 | 0.976 | 0.976 | 0.978 | 0° | -3.5°, 0.5° | 86.8° against 84.8° |
| 2019-01-08 03:12:43 | 0.976 | 0.971 | 0.979 | 10° | -3.5°, 2° | 87.0° against 85.0° |
| 2019-01-09 06:40:27 | 0.977 | 0.974 | 0.978 | 0° | -2°, -2° | 87.0° against 85.1° |
| 2019-01-10 07:30:00 | 0.977 | 0.976 | 0.975 | 0° | -1°, 0.5° | 87.0° against 85.0° |
| 2019-01-14 06:48:40 | 0.975 | 0.972 | 0.978 | 0° | -1.5°, 2.5° | 87.1° against 85.0° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 32 native frames after the centre fit is 3.329 px at our phase; the lowest of a ±30° sweep is 3.324 px at -2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 32 | 0 | — | — | — | its other 32 frames | 0 of 32 | — | 16 of 32, -1.00° | — | ×1.28 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.42](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 2866.5 m error against a 2900 m stopping threshold. Independent nearest-triangle sampling
(8192 samples each way) measured p95 1623.3 m and maximum 3141.6 m. No repeated radial intersection was found, which
supports the radial-height dataset. Reduction softens small features.

## Known problems

- The Shape view is not photographed color, reflectance, regolith or composition. Elevation includes global shape and
  is not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map adds no observational resolution.
- Rotation has an arbitrary display meridian, not an absolute rotational phase.
- The SPHERE photograph shows photographed illumination, not albedo or color. The frames see Interamnia from 18° to
  19° south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
