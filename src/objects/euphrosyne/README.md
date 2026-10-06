# Euphrosyne

Euphrosyne is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape, and a SPHERE photograph is mapped onto the survey's model. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/31_Euphrosyne_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [32 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 6 nights from 2019-03-15 to 2019-04-10](https://observations.lam.fr/astero/Data/31Euphrosyne/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/31_Euphrosyne_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/31_Euphrosyne_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.22](https://doi.org/10.1051/0004-6361/202141781) |

- Vernazza et al. (2021) give a volume-equivalent diameter of 268 km, ecliptic J2000 pole (94°, 67°) and sidereal period 5.529595 h.
- The MPCD mesh has 3202 vertices and 6400 triangles in kilometres, not rescaled. Its volume-equivalent radius is 134.102975 km; the ADAM mesh's is 134.202139 km. The survey's diameter averages the two.
- The [released SPHERE images](https://observations.lam.fr/astero/Data/31Euphrosyne/) and the [survey paper](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) give the image comparisons behind the model. The LAM downloads need the public-site cookie recorded in the manifest.

## Processing

The MPCD surface is simplified with meshoptimizer 1.2.0 to 686 native PolyCSS u triangles, the fewest within its 2400 m error allowance in a 3501 × 3743 atlas, with a 2400 m stopping threshold. Geometry and lighting are prepared ahead of runtime.

Elevation samples the original mesh radius minus a 134 km reference sphere, with a -20 to 20 km legend, from 721 × 361 source directions with a cartographic hillshade.

The SPHERE photograph combines the survey's deconvolved frames with matched relative levels, averaged where frames overlap, each fading out toward its disc edge.

The published ecliptic pole is converted to equatorial J2000. Horizons elements are pinned at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.22](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2019-03-15 07:07:59 | 0.956 | 0.956 | 0.969 | 10° | -7°, -2.5° | 91.1° against 89.1° |
| 2019-03-20 04:16:29 | 0.966 | 0.961 | 0.966 | 0° | -3°, -6° | 91.1° against 89.1° |
| 2019-03-25 02:53:48 | 0.963 | 0.960 | 0.966 | 10° | -1°, 3.5° | 91.2° against 89.2° |
| 2019-03-27 08:16:28 | 0.969 | 0.965 | 0.969 | -10° | -2°, 2.5° | 91.2° against 89.1° |
| 2019-04-08 04:07:52 | 0.966 | 0.965 | 0.966 | 0° | -3.5°, -2° | 91.3° against 89.2° |
| 2019-04-10 02:30:41 | 0.970 | 0.969 | 0.971 | 0° | 0°, 2° | 91.3° against 89.3° |
| 2019-04-10 07:20:44 | 0.968 | 0.966 | 0.972 | -10° | -1°, 3° | 91.3° against 89.2° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 32 native frames after the centre fit is 2.341 px at our phase; the lowest of a ±30° sweep is 2.264 px at 16°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 32 | 0 | — | — | — | its other 32 frames | 1 of 32 | — | 12 of 32, 0.50° | — | ×1.17 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.22](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 2389.8 m error, which is not a Hausdorff bound. Independent nearest-triangle sampling (8192 samples each way) measured p95 1301.4 m and maximum 2180.4 m. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features. Re-prepared 2026-10-06: the error allowance now decides the face count, 686 faces at 2390 m estimated simplifier error; checks and sampled distances recorded here before that date describe the earlier 800-face mesh.

## Known problems

- Shape uses the shared neutral-gray material, not photographed color or composition. Elevation includes global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.
- The SPHERE photograph shows photographed illumination, not albedo or color. The frames see Euphrosyne from 2° north, so unseen surface keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
