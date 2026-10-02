# Kalliope

Kalliope is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on the survey's released shape,
with a shape-only view, an elevation map and a SPHERE photograph dataset. Shape-only views use the shared neutral gray
(#808080 sRGB), a display convention, not a measured color; gaps keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/22_Kalliope_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [35 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 7 nights from 2018-03-15 to 2019-07-08](https://observations.lam.fr/astero/Data/22Kalliope/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/22_Kalliope_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/22_Kalliope_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.18](https://doi.org/10.1051/0004-6361/202141781) |

Vernazza et al. (2021) give a volume-equivalent diameter of 150 km, ecliptic J2000 pole (195°, 4°) and sidereal period
4.1482 h. The [individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) page adds model and
image comparisons.

## Processing

The MPCD mesh has 1286 vertices and 2568 triangles in unmodified kilometre coordinates, volume-equivalent radius
76.369742 km. It is not rescaled to the survey's averaged diameter. Maximum extents are 149.069 × 214.254 × 119.080 km,
not best-fit ellipsoid axes. Meshoptimizer 1.2.0 simplifies it to 800 native PolyCSS triangles, and lighting is
prepared ahead of runtime.

Elevation samples the original mesh radius minus a 75 km reference sphere, with a -30 to 60 km legend, from 721 × 361
source directions with a cartographic hillshade.

The SPHERE photograph uses the survey's deconvolved frames with matched relative frame levels. Each apparition is placed
through the surface it shares with another, frames are averaged where they overlap, and each fades out toward its disc
edge.

The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. Horizons elements are pinned
at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.18](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-03-15 08:03:46 | 0.947 | 0.933 | 0.946 | 0° | 0.5°, -2.5° | 112.6° against 129.5° |
| 2018-04-20 05:11:36 | 0.953 | 0.946 | 0.959 | 0° | 0°, 2° | 81.5° against 93.9° |
| 2018-04-20 05:36:16 | 0.951 | 0.938 | 0.953 | 0° | 1°, 2° | 81.4° against 90.0° |
| 2018-05-05 02:34:13 | 0.945 | 0.940 | 0.953 | 0° | 2.5°, 2.5° | 71.5° against 77.4° |
| 2018-05-05 02:40:24 | 0.940 | 0.934 | 0.949 | 0° | 2.5°, 2.5° | 71.5° against 64.6° |
| 2019-06-09 08:55:04 | 0.939 | 0.937 | 0.941 | 0° | -0.5°, -0.5° | 8.1° against 10.1° |
| 2019-06-27 03:38:22 | 0.923 | 0.935 | 0.937 | -10° | -1.5°, -1.5° | 10.7° against 12.9° |
| 2019-06-27 03:55:48 | 0.925 | 0.930 | 0.943 | 0° | -4°, -3° | 10.7° against 12.8° |
| 2019-07-08 00:48:15 | 0.908 | 0.938 | 0.943 | -10° | 2°, 2.5° | 12.2° against 14.3° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 35 native frames after the centre fit is 6.202 px at our phase; the lowest of a ±30° sweep is 6.125 px at 2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 35 | 32 | 8.10° | 5.21° | 6.21° | its other 35 frames | 3 of 35 | 9.50° | 10 of 35, 0.50° | — | ×4.18 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.18](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 1353.0 m error against a 1400 m stopping threshold. Independent nearest-triangle sampling
(8192 samples each way) measured p95 607.7 m and maximum 1572.3 m. No repeated radial intersection was found, which
supports the radial-height dataset. Reduction softens small features.

## Known problems

- The Shape view is not photographed color, reflectance, regolith or composition. Elevation includes global shape and
  is not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map adds no observational resolution.
- Rotation has an arbitrary display meridian, not an absolute rotational phase.
- The SPHERE photograph shows photographed illumination, not albedo or color. The frames see Kalliope from 20° to 77°
  south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
