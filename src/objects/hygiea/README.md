# Hygiea

Hygiea is a nearly spherical main-belt asteroid. VLT/SPHERE observations revealed its rounded shape and helped
establish its revised rotation period. It is shown on the survey's released shape, with a shape-only view, an elevation
map and a SPHERE photograph dataset. Shape-only views use the shared neutral gray (#808080 sRGB), a display convention,
not a measured color; gaps keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/10_Hygiea_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 4 nights from 2018-08-25 to 2018-09-11](https://observations.lam.fr/astero/Data/10Hygiea/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/10_Hygiea_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/10_Hygiea_param.txt), read longitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.9](https://doi.org/10.1051/0004-6361/202141781) |

Vernazza et al. (2021) give a volume-equivalent diameter of 433 km, ecliptic J2000 pole (306°, -29°) and sidereal
period 13.82559 h. The [individual research](https://observations.lam.fr/astero/Papers/Vernazza2019.pdf) page adds
model and image comparisons.

## Processing

The MPCD mesh has 8834 vertices and 17664 triangles in unmodified kilometre coordinates, volume-equivalent radius
215.372911 km. It is not rescaled to the survey's averaged diameter. Maximum extents are 424.926 × 450.190 ×
418.133 km, not best-fit ellipsoid axes. Meshoptimizer 1.2.0 simplifies it to 742 native PolyCSS triangles, the fewest within its 3700 m error allowance, and
lighting is prepared ahead of runtime.

Elevation samples the original mesh radius minus a 216.5 km reference sphere, with a -20 to 20 km legend, from
721 × 361 source directions with a cartographic hillshade.

The SPHERE photograph uses the survey's deconvolved frames with matched relative frame levels, averaged where frames
overlap, each fading out toward its disc edge.

The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. Horizons elements are pinned
at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.9](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-08-25 05:45:03 | 0.975 | 0.963 | 0.984 | -10° | 4°, 8° | 121.6° against 119.9° |
| 2018-08-26 05:41:28 | 0.979 | 0.969 | 0.983 | 0° | 1°, -6° | 121.6° against 119.8° |
| 2018-08-26 08:13:00 | 0.980 | 0.970 | 0.983 | 0° | 0°, 2° | 121.5° against 119.8° |
| 2018-09-08 04:38:41 | 0.982 | 0.965 | 0.981 | 0° | -1°, -7.5° | 120.7° against 118.9° |
| 2018-09-08 06:25:23 | 0.980 | 0.978 | 0.982 | 0° | -1°, 8° | 120.7° against 118.9° |
| 2018-09-11 05:08:03 | 0.982 | 0.974 | 0.982 | 0° | 0.5°, 7.5° | 120.5° against 118.7° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 0.970 px at our phase; the lowest of a ±30° sweep is 0.966 px at -2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 0 | — | — | — | its other 30 frames | 1 of 30 | — | 14 of 30, 3.00° | — | ×1.10 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.9](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 3692.9 m error against a 3700 m stopping threshold. Independent nearest-triangle sampling Re-prepared 2026-10-06: the error allowance now decides the face count, 742 faces at 3693 m estimated simplifier error; checks and sampled distances recorded here before that date describe the earlier 800-face mesh.
(8192 samples each way) measured p95 1963.7 m and maximum 3432.2 m. No repeated radial intersection was found, which
supports the radial-height dataset. Reduction softens small features.

## Known problems

- The Shape view is not photographed color, reflectance, regolith or composition. Elevation includes global shape and
  is not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map adds no observational resolution.
- Rotation has an arbitrary display meridian, not an absolute rotational phase.
- The SPHERE photograph shows photographed illumination, not albedo or color. The frames see Hygiea from 24° to 26°
  south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
