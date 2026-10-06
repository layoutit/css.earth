# Amphitrite

Amphitrite is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown as the survey's released shape, with an elevation view and a photograph built from the survey's SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/29_Amphitrite_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [55 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 7 nights from 2017-05-20 to 2019-08-29](https://observations.lam.fr/astero/Data/29Amphitrite/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/29_Amphitrite_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/29_Amphitrite_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.20](https://doi.org/10.1051/0004-6361/202141781) |

The survey gives a volume-equivalent diameter of 204 km, an ecliptic J2000 pole of (323°, -29°) and a sidereal period of 5.390119 h. The original MPCD mesh has 682 vertices and 1360 triangles in kilometers; its volume-equivalent radius is 101.594196 km, and it is not rescaled to the survey's average diameter. [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) adds interpretation and model/image comparisons.

## Processing

Meshoptimizer 1.2.0 simplifies the mesh to 722 PolyCSS triangles, the fewest within its 1800 m error allowance. Elevation samples the original mesh radius minus a 102 km reference sphere, with a -20 to 20 km legend. The SPHERE photograph combines the deconvolved frames with matched relative levels, places each apparition through the surface it shares with another, averages overlapping frames and fades each toward its disc edge. The published ecliptic pole is converted to equatorial J2000; orbital context uses JPL Horizons elements pinned at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.20](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-05-20 01:37:59 | 0.850 | 0.878 | 0.963 | 120° | -8°, -5.5° | 86.0° against 84.9° |
| 2017-05-20 02:33:28 | 0.928 | 0.945 | 0.959 | 0° | -2.5°, 2.5° | 86.0° against 84.6° |
| 2018-06-08 09:22:40 | 0.971 | 0.968 | 0.970 | 0° | 0.5°, 0.5° | 30.3° against 28.3° |
| 2019-08-16 06:39:41 | 0.931 | 0.933 | 0.965 | 130° | -2.5°, -0.5° | 126.6° against 124.7° |
| 2019-08-16 08:00:28 | 0.939 | 0.934 | 0.967 | 0° | 3°, 2.5° | 126.6° against 124.5° |
| 2019-08-17 06:24:17 | 0.940 | 0.937 | 0.967 | 0° | 2.5°, 7° | 126.6° against 124.4° |
| 2019-08-17 07:40:29 | 0.935 | 0.942 | 0.968 | 0° | 2.5°, 2.5° | 126.6° against 124.7° |
| 2019-08-17 08:19:17 | 0.953 | 0.935 | 0.969 | 0° | 1°, 7° | 126.6° against 124.7° |
| 2019-08-22 07:00:43 | 0.948 | 0.934 | 0.967 | 0° | 2°, 4.5° | 126.6° against 124.8° |
| 2019-08-23 08:25:46 | 0.937 | 0.927 | 0.969 | 10° | 6°, 7° | 126.6° against 124.6° |
| 2019-08-29 05:49:03 | 0.958 | 0.958 | 0.968 | 0° | -2°, 2° | 126.5° against 124.6° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 55 native frames after the centre fit is 0.986 px at our phase; the lowest of a ±30° sweep is 0.926 px at -2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 55 | 18 | 7.40° | 4.42° | 5.94° | its other 55 frames | 0 of 55 | — | 44 of 55, -2.25° | — | ×1.15 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.20](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 1734.1 m error against an authored 1800 m threshold. Independent nearest-triangle sampling measured p95 612.5 m and maximum 1499.4 m. No sampled direction met the surface twice, which supports the radial-height elevation view.

## Known problems

- Shape is not photographed color, reflectance, regolith or inferred composition. Elevation includes global shape, not height above a gravitational equipotential. Reduction softens small features.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map does not add observational resolution.
- The display meridian is arbitrary, not an absolute rotational phase.
- The SPHERE photograph is photographed illumination, not albedo or color. The frames see Amphitrite from 34° south to 57° north, so unseen surface keeps the missing-imagery grid.
- Registration reports a conflict for `zimpol`; the dataset ships on the paper's comparison figure.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
