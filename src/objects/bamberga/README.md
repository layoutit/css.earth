# Bamberga

Bamberga is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It shows the survey's published shape, an elevation view and a photograph built from the survey's deconvolved SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB), a display convention, not a measured color.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/324_Bamberga_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [85 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 15 nights from 2017-06-23 to 2019-01-27](https://observations.lam.fr/astero/Data/324Bamberga/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/324_Bamberga_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/324_Bamberga_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.39](https://doi.org/10.1051/0004-6361/202141781) |

The survey gives a volume-equivalent diameter of 227 km, an ecliptic J2000 pole of (17°, -57°) and a sidereal period of 29.4403 h. The MPCD mesh has 4498 vertices and 8992 triangles in kilometres, with a measured volume-equivalent radius of 113.552785 km; its coordinates are not rescaled to the survey's average of ADAM and MPCD. The ADAM mesh (radius 113.297333 km) is an alternative reconstruction and is not a second dataset. The [authors' paper](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) gives further model and image comparisons.

## Processing

The MPCD surface is simplified with meshoptimizer 1.2.0 to 728 PolyCSS triangles, the fewest within its 2000 m error allowance in a 3525 × 3718 atlas, with lighting prepared ahead of runtime. Elevation is the mesh radius minus a 113.5 km reference sphere, sampled at 721 × 361 directions, on a -20 to 20 km legend with cartographic hillshade.

The SPHERE photograph matches relative frame levels, places each apparition through the surface it shares with another, averages where frames overlap and fades each frame toward its disc edge.

The mesh keeps +Z north and east-positive longitude. The ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. The release's unlabeled parameter file is not read as an IAU W model. Horizons elements are pinned at JD 2461286.5 (2026-09-03); TDB is approximated as TT within 2 ms.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.39](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-06-23 05:45:06 | 0.978 | 0.962 | 0.978 | 0° | -2°, 5° | 57.6° against 46.3° |
| 2017-07-14 04:34:31 | 0.969 | 0.964 | 0.978 | -10° | -3.5°, -2.5° | 61.3° against 46.8° |
| 2017-07-20 03:37:55 | 0.965 | 0.959 | 0.977 | 10° | -1°, -0.5° | 62.1° against 46.8° |
| 2017-07-25 04:51:49 | 0.971 | 0.959 | 0.978 | -10° | -5°, 0.5° | 62.7° against 46.9° |
| 2017-07-29 02:09:03 | 0.959 | 0.937 | 0.976 | 10° | -2°, 6° | 63.1° against 47.0° |
| 2017-08-19 01:50:03 | 0.940 | 0.926 | 0.973 | 0° | -8°, 3° | 63.5° against 47.1° |
| 2017-08-22 02:26:44 | 0.929 | 0.930 | 0.978 | -20° | 3.5°, 7° | 63.4° against 47.1° |
| 2018-12-22 06:15:22 | 0.955 | 0.942 | 0.975 | -10° | 3°, 5° | 137.7° against 127.4° |
| 2018-12-23 06:33:58 | 0.962 | 0.948 | 0.975 | 30° | -3°, -2° | 137.7° against 127.4° |
| 2019-01-09 05:54:15 | 0.974 | 0.971 | 0.976 | 0° | -3.5°, 0° | 136.6° against 128.5° |
| 2019-01-10 05:19:33 | 0.977 | 0.964 | 0.976 | 0° | -2°, -2.5° | 136.6° against 128.5° |
| 2019-01-13 06:49:59 | 0.971 | 0.966 | 0.975 | 0° | -2°, 2.5° | 136.3° against 129.0° |
| 2019-01-16 03:40:20 | 0.977 | 0.970 | 0.973 | 0° | -2°, 0.5° | 136.0° against 129.1° |
| 2019-01-17 04:22:01 | 0.976 | 0.966 | 0.977 | 0° | -3.5°, 0.5° | 135.9° against 129.2° |
| 2019-01-27 02:58:49 | 0.975 | 0.960 | 0.977 | 0° | -2.5°, 0° | 135.0° against 129.9° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 85 native frames after the centre fit is 2.606 px at our phase; the lowest of a ±30° sweep is 2.370 px at -20°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 85 | 0 | — | — | — | its other 85 frames | 2 of 85 | — | 24 of 85, -6.75° | — | ×1.29 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.39](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1957.7 m error against a 2000 m threshold; this is not a Hausdorff bound. Nearest-triangle sampling (8192 samples each way) measured p95 1146.0 m and maximum 2058.9 m. No repeated radial intersection was found, which supports the radial-height dataset. Re-prepared 2026-10-06: the error allowance now decides the face count, 728 faces at 1958 m estimated simplifier error; checks and sampled distances recorded here before that date describe the earlier 800-face mesh.

## Known problems

- Shape is neutral gray, not photographed color, reflectance or composition. Reduction softens small features.
- Elevation includes the global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map adds no observational resolution.
- The SPHERE photograph is photographed illumination, not albedo or color. The frames see Bamberga from 5° south to 19° north, so unseen surface keeps the missing-imagery grid.
- The rotation's display meridian is arbitrary, not an absolute rotational phase.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
