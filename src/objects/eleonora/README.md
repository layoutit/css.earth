# Eleonora

Eleonora is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown as the survey's released shape, with an elevation view and a photograph built from the survey's SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/354_Eleonora_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [32 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-11-23 to 2018-12-21](https://observations.lam.fr/astero/Data/354Eleonora/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/354_Eleonora_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/354_Eleonora_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.40](https://doi.org/10.1051/0004-6361/202141781) |

The survey gives a volume-equivalent diameter of 165 km, an ecliptic J2000 pole of (154°, 24°) and a sidereal period of 4.277185 h. The original MPCD mesh has 2002 vertices and 4000 triangles in kilometers; its volume-equivalent radius is 81.872060 km, and it is not rescaled to the survey's average diameter. [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) adds interpretation and model/image comparisons.

## Processing

Meshoptimizer 1.2.0 simplifies the mesh to 676 PolyCSS triangles, the fewest within its 1500 m error allowance. Elevation samples the original mesh radius minus a 82.5 km reference sphere, with a -20 to 20 km legend. The SPHERE photograph combines the deconvolved frames with matched relative levels, averages overlapping frames and fades each toward its disc edge. The published ecliptic pole is converted to equatorial J2000; orbital context uses JPL Horizons elements pinned at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.40](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-11-23 06:21:32 | 0.944 | 0.932 | 0.955 | 0° | -3°, -0.5° | 124.4° against 122.5° |
| 2018-11-27 06:03:03 | 0.957 | 0.944 | 0.964 | 0° | -0.5°, -0.5° | 124.4° against 122.4° |
| 2018-11-27 07:25:52 | 0.957 | 0.952 | 0.958 | 0° | -0.5°, 2.5° | 124.4° against 122.3° |
| 2018-11-28 08:06:06 | 0.937 | 0.916 | 0.961 | 20° | -4.5°, -5.5° | 124.4° against 122.4° |
| 2018-12-18 01:27:13 | 0.944 | 0.952 | 0.962 | 0° | -4°, -1.5° | 124.0° against 122.0° |
| 2018-12-21 04:27:55 | 0.957 | 0.953 | 0.958 | 0° | 0.5°, 0.5° | 123.9° against 121.9° |
| 2018-12-18 01:39:13 | 0.954 | 0.947 | 0.962 | 0° | -2.5°, -4.5° | 124.0° against 121.9° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 32 native frames after the centre fit is 0.908 px at our phase; the lowest of a ±30° sweep is 0.850 px at 2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 32 | 21 | 6.90° | 3.88° | 5.71° | its other 32 frames | 8 of 32 | -3.00° | 10 of 32, -1.00° | — | ×1.13 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.40](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 1422.4 m error against an authored 1500 m threshold. Independent nearest-triangle sampling measured p95 757.9 m and maximum 1501.8 m. No sampled direction met the surface twice, which supports the radial-height elevation view.

## Known problems

- Shape is not photographed color, reflectance, regolith or inferred composition. Elevation includes global shape, not height above a gravitational equipotential. Reduction softens small features.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map does not add observational resolution.
- The display meridian is arbitrary, not an absolute rotational phase.
- The SPHERE photograph is photographed illumination, not albedo or color. The frames see Eleonora from 6° to 9° north, so unseen surface keeps the missing-imagery grid.
- Registration reports a conflict for `zimpol`; the dataset ships on the paper's comparison figure.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
