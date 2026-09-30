# Eugenia

Eugenia is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown as the survey's released shape, with an elevation view and a photograph built from the survey's SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/45_Eugenia_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [63 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 8 nights from 2018-05-04 to 2019-08-07](https://observations.lam.fr/astero/Data/45Eugenia/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/45_Eugenia_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/45_Eugenia_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.24](https://doi.org/10.1051/0004-6361/202141781) |

The survey gives a volume-equivalent diameter of 188 km, an ecliptic J2000 pole of (128°, -35°) and a sidereal period of 5.699151 h. The original MPCD mesh has 3634 vertices and 7264 triangles in kilometers; its volume-equivalent radius is 93.715521 km, and it is not rescaled to the survey's average diameter. [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) adds interpretation and model/image comparisons.

## Processing

Meshoptimizer 1.2.0 simplifies the mesh to 800 PolyCSS triangles, each a 128 × 128 px raster leaf. Elevation samples the original mesh radius minus a 94 km reference sphere, with a -40 to 40 km legend. The SPHERE photograph combines the deconvolved frames with matched relative levels, places each apparition through the surface it shares with another, averages overlapping frames and fades each toward its disc edge. The published ecliptic pole is converted to equatorial J2000; orbital context uses JPL Horizons elements pinned at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.24](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-05-04 01:41:20 | 0.955 | 0.947 | 0.966 | 0° | 0°, 3.5° | 154.8° against 152.8° |
| 2018-05-04 02:57:50 | 0.960 | 0.945 | 0.964 | 0° | 2°, 3° | 154.8° against 152.8° |
| 2018-05-04 03:31:33 | 0.961 | 0.951 | 0.964 | 0° | -0.5°, 3.5° | 154.8° against 152.8° |
| 2019-07-28 08:19:08 | 0.966 | 0.961 | 0.974 | 0° | -3°, 0° | 85.7° against 83.5° |
| 2019-07-30 07:34:02 | 0.962 | 0.963 | 0.969 | 0° | -3°, 1.5° | 86.5° against 84.5° |
| 2019-08-03 05:15:12 | 0.954 | 0.966 | 0.971 | 0° | -2.5°, -0.5° | 88.1° against 85.6° |
| 2019-08-05 05:07:16 | 0.949 | 0.969 | 0.971 | 0° | -3.5°, -0.5° | 88.9° against 87.2° |
| 2019-08-06 01:01:20 | 0.949 | 0.968 | 0.976 | 0° | -2.5°, 0° | 89.2° against 86.7° |
| 2019-08-06 06:12:03 | 0.969 | 0.970 | 0.973 | 0° | -4°, 0.5° | 89.2° against 87.7° |
| 2019-08-07 00:46:06 | 0.967 | 0.961 | 0.972 | 0° | -2.5°, -2° | 89.5° against 87.7° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 63 native frames after the centre fit is 3.352 px at our phase; the lowest of a ±30° sweep is 3.270 px at -4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 63 | 60 | 6.51° | 3.98° | 5.15° | its other 63 frames | 0 of 63 | — | 1 of 63 | — | ×1.26 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.24](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 1635.9 m error against an authored 1700 m threshold. Independent nearest-triangle sampling measured p95 825.8 m and maximum 2337.6 m. No sampled direction met the surface twice, which supports the radial-height elevation view.

## Known problems

- Shape is not photographed color, reflectance, regolith or inferred composition. Elevation includes global shape, not height above a gravitational equipotential. Reduction softens small features.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map does not add observational resolution.
- The display meridian is arbitrary, not an absolute rotational phase.
- The SPHERE photograph is photographed illumination, not albedo or colour. The frames see Eugenia from 33° south to 59° north, so unseen surface keeps the missing-imagery grid.
- zimpol-20190803-042450 and zimpol-20190803-042850 are left out: they are 5.14× and 5.54× dimmer than their apparition's first frame, beyond the 4× level budget.
- Registration reports a conflict for `zimpol`; the dataset ships on the paper's comparison figure.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
