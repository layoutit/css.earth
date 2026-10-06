# Eunomia

Eunomia is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown as its released shape model, an elevation map and a photograph built from SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/15_Eunomia_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [80 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 11 nights from 2018-03-22 to 2019-08-07](https://observations.lam.fr/astero/Data/15Eunomia/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/15_Eunomia_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/15_Eunomia_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.13](https://doi.org/10.1051/0004-6361/202141781) |

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 270 km, ecliptic J2000 pole (355°, -70°), sidereal period 6.082753 h.
- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/15_Eunomia_mpcd.obj): 5826 vertices, 11648 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 133.776919 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average.
- The [alternative ADAM mesh](https://observations.lam.fr/astero/3Dshape/15_Eunomia_adam.obj) is not a second dataset.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Processing

The original surface is simplified with meshoptimizer 1.2.0 to 692 PolyCSS triangles, the fewest within its 2500 m error allowance, with geometry and lighting prepared ahead of runtime. Elevation samples the original mesh radius minus a 135 km reference sphere, with a -30 to 40 km legend. The published ecliptic pole is converted to equatorial J2000; JPL Horizons elements place the orbit.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.13](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-03-22 07:34:12 | 0.959 | 0.941 | 0.968 | 0° | -3°, 0.5° | 88.3° against 86.5° |
| 2018-04-23 06:59:58 | 0.963 | 0.961 | 0.972 | 0° | -2.5°, -2.5° | 90.7° against 88.9° |
| 2018-04-28 07:03:43 | 0.960 | 0.964 | 0.973 | 0° | -3.5°, 1° | 91.3° against 89.4° |
| 2018-05-05 01:03:24 | 0.965 | 0.964 | 0.971 | -10° | -5°, 3° | 92.0° against 90.4° |
| 2018-05-05 02:21:29 | 0.970 | 0.962 | 0.972 | 0° | 0°, 1° | 92.1° against 90.2° |
| 2018-05-16 03:44:58 | 0.971 | 0.965 | 0.972 | 0° | 0.5°, 0.5° | 93.3° against 91.6° |
| 2019-07-28 08:52:58 | 0.973 | 0.973 | 0.982 | 0° | -2.5°, 1.5° | 60.8° against 58.5° |
| 2019-07-29 04:43:47 | 0.976 | 0.971 | 0.983 | 0° | -1.5°, 1° | 60.8° against 58.4° |
| 2019-07-30 06:54:49 | 0.971 | 0.973 | 0.980 | 0° | -2°, 1° | 60.8° against 58.5° |
| 2019-08-04 04:31:05 | 0.975 | 0.971 | 0.980 | 0° | 0°, 6° | 60.8° against 58.5° |
| 2019-08-04 05:08:04 | 0.974 | 0.975 | 0.982 | 0° | -3°, 1° | 60.8° against 58.6° |
| 2019-08-04 07:39:29 | 0.976 | 0.969 | 0.982 | 0° | -1°, 0° | 60.8° against 58.4° |
| 2019-08-05 05:45:23 | 0.975 | 0.976 | 0.984 | 0° | -2°, 0.5° | 60.8° against 58.4° |
| 2019-08-07 08:16:10 | 0.978 | 0.975 | 0.979 | 0° | -1.5°, 0.5° | 60.8° against 58.4° |
| 2019-08-07 08:38:30 | 0.978 | 0.973 | 0.981 | 0° | -1°, -1° | 60.8° against 58.4° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 80 native frames after the centre fit is 1.338 px at our phase; the lowest of a ±30° sweep is 1.307 px at 4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 80 | 45 | 9.12° | 4.95° | 7.66° | its other 80 frames | 1 of 80 | — | 24 of 80, 5.00° | — | ×1.17 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.13](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 2439.6 m error; this is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1403.5 m and maximum 2576.3 m. Face-centroid checks and 8192 sphere directions found no repeated radial intersection, which supports the radial-height dataset. Reduction softens small features.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, each apparition placed through the surface it shares with another, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or color. The frames see Eunomia from 3° to 10° south, so surface the survey did not see keeps the missing-imagery grid.
