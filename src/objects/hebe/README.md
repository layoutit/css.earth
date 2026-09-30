# Hebe

Hebe is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It shows the survey's published shape, an elevation view and a photograph built from the survey's deconvolved SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB), a display convention, not a measured colour.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/6_Hebe_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [32 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-11-28 to 2019-01-09](https://observations.lam.fr/astero/Data/6Hebe/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/6_Hebe_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/6_Hebe_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.5](https://doi.org/10.1051/0004-6361/202141781) |

The survey gives a volume-equivalent diameter of 195 km, an ecliptic J2000 pole of (342°, 50°) and a sidereal period of 7.274467 h. The MPCD mesh has 5570 vertices and 11136 triangles in kilometres, with a measured volume-equivalent radius of 97.026746 km; its coordinates are not rescaled to the survey's average of ADAM and MPCD. The ADAM mesh (radius 97.352127 km) is an alternative reconstruction and is not a second dataset. The [authors' paper](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) gives further model and image comparisons.

## Processing

The MPCD surface is simplified with meshoptimizer 1.2.0 to 800 PolyCSS triangles, each a 128 × 128 px leaf in a 2048 × 6400 atlas, with lighting prepared ahead of runtime. Elevation is the mesh radius minus a 97.5 km reference sphere, sampled at 721 × 361 directions, on a -30 to 30 km legend with cartographic hillshade.

The SPHERE photograph matches relative frame levels, averages where frames overlap and fades each frame toward its disc edge.

The mesh keeps +Z north and east-positive longitude. The ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. The release's unlabeled parameter file is not read as an IAU W model. Horizons elements are pinned at JD 2461286.5 (2026-09-03); TDB is approximated as TT within 2 ms.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.5](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-11-28 03:58:20 | 0.959 | 0.951 | 0.976 | 0° | -2.5°, 0° | 54.3° against 52.3° |
| 2018-12-14 07:09:41 | 0.954 | 0.953 | 0.980 | 0° | -1.5°, 0° | 52.7° against 51.0° |
| 2018-12-19 04:49:05 | 0.973 | 0.963 | 0.976 | 0° | -2°, 1° | 52.1° against 50.1° |
| 2018-12-19 04:53:46 | 0.968 | 0.968 | 0.977 | 0° | -1.5°, 0.5° | 52.1° against 50.1° |
| 2018-12-19 05:57:07 | 0.969 | 0.969 | 0.981 | 0° | -3°, 0° | 52.1° against 49.9° |
| 2018-12-19 06:30:23 | 0.980 | 0.973 | 0.983 | 0° | 0°, 0° | 52.1° against 49.8° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 32 native frames after the centre fit is 1.445 px at our phase; the lowest of a ±30° sweep is 1.422 px at 10°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 32 | 11 | 12.09° | 1.27° | 12.02° | its other 32 frames | 0 of 32 | — | 26 of 32, 2.00° | — | ×1.09 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.5](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1845.8 m error against a 1900 m threshold; this is not a Hausdorff bound. Nearest-triangle sampling (8192 samples each way) measured p95 946.4 m and maximum 3115.8 m. No repeated radial intersection was found, which supports the radial-height dataset.

## Known problems

- Shape is neutral gray, not photographed colour, reflectance or composition. Reduction softens small features.
- Elevation includes the global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; the 4096 × 2048 display map adds no observational resolution.
- The SPHERE photograph is photographed illumination, not albedo or colour. The frames see Hebe from 26° to 35° north, so unseen surface keeps the missing-imagery grid.
- The rotation's display meridian is arbitrary, not an absolute rotational phase.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
