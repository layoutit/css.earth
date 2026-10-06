# Juno

Juno is an irregular main-belt asteroid with broad departures from an ellipsoid. It shows the survey's published shape, an elevation view and a photograph built from deconvolved VLT/SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB), a display convention, not a measured color.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/3_Juno_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 3 nights from 2018-11-08 to 2018-11-12](https://observations.lam.fr/astero/Data/3Juno/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/3_Juno_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/3_Juno_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.3](https://doi.org/10.1051/0004-6361/202141781) |

The survey gives a volume-equivalent diameter of 254 km, an ecliptic J2000 pole of (105°, 18°) and a sidereal period of 7.209531 h. The MPCD mesh has 13506 vertices and 27008 triangles in kilometres, with a measured volume-equivalent radius of 126.115500 km; its coordinates are not rescaled to the survey's average of ADAM and MPCD. The photograph rides the ADAM reconstruction (radius 127.337488 km) because the release's rotation record describes it. The [authors' paper](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) gives further model and image comparisons.

## Processing

The MPCD surface is simplified with meshoptimizer 1.2.0 to 800 PolyCSS triangles, each a 128 × 128 px leaf in a 2048 × 6400 atlas, with lighting prepared ahead of runtime. Elevation is the mesh radius minus a 127 km reference sphere, sampled at 721 × 361 directions, on a -40 to 40 km legend with cartographic hillshade.

The SPHERE photograph matches relative frame levels, averages where frames overlap and fades each frame toward its disc edge. The reduced `Red/` products are not used.

The mesh keeps +Z north and east-positive longitude. The ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. The release's unlabeled parameter file is not read as an IAU W model. Horizons elements are pinned at JD 2461286.5 (2026-09-03); TDB is approximated as TT within 2 ms.

## Evidence

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 2298.1 m error against a 2400 m threshold; this is not a Hausdorff bound. Nearest-triangle sampling (8192 samples each way) measured p95 1208.7 m and maximum 3217.3 m. No repeated radial intersection was found, which supports the radial-height dataset.

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.3](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-11-08 05:47:15 | 0.966 | 0.971 | 0.987 | 10° | -4°, -1° | 131.0° against 129.0° |
| 2018-11-08 07:58:55 | 0.969 | 0.972 | 0.988 | 0° | -4.5°, 0° | 131.0° against 129.1° |
| 2018-11-11 02:06:44 | 0.970 | 0.965 | 0.986 | 0° | -2°, -0.5° | 131.0° against 129.1° |
| 2018-11-11 04:01:27 | 0.962 | 0.961 | 0.986 | 10° | -4°, -1.5° | 131.0° against 129.0° |
| 2018-11-11 04:27:48 | 0.968 | 0.967 | 0.986 | 0° | -1°, -3.5° | 131.0° against 129.0° |
| 2018-11-12 04:51:38 | 0.967 | 0.965 | 0.987 | 0° | -3.5°, -1° | 131.1° against 129.1° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.339 px at our phase; the lowest of a ±30° sweep is 1.317 px at 2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 5 | 3.29° | 2.15° | 2.48° | its other 30 frames | 0 of 30 | — | 23 of 30, 2.50° | — | ×1.21 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.3](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Shape is neutral gray, not photographed color, reflectance or composition. Reduction softens small features.
- Elevation includes the global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map adds no observational resolution.
- The SPHERE photograph is photographed illumination, not albedo or color. The frames see Juno from 29° to 30° south, so unseen surface keeps the missing-imagery grid.
- The rotation's display meridian is arbitrary, not an absolute rotational phase.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
