# Pallas

Pallas is a large, heavily cratered main-belt asteroid. Its reconstructed shape preserves broad impact features seen by VLT/SPHERE, and a SPHERE photograph is mapped onto the survey's shape model. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/2_Pallas_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 4 nights from 2017-10-08 to 2017-11-03](https://observations.lam.fr/astero/Data/2Pallas/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/2_Pallas_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/2_Pallas_param.txt), read longitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.2](https://doi.org/10.1051/0004-6361/202141781) |

- Vernazza et al. (2021), the final VLT/SPHERE survey, gives a volume-equivalent diameter of 511 km, ecliptic J2000 pole (42°, -15°) and sidereal period 7.81321 h.
- The original MPCD mesh has 22530 vertices and 45056 triangles in kilometres, not rescaled. Its volume-equivalent radius is 254.078241 km; the survey's diameter averages ADAM and MPCD. The ADAM reconstruction has radius 256.359287 km.
- The [released SPHERE images](https://observations.lam.fr/astero/Data/2Pallas/) are individual, illuminated, resolved telescope images. [Marsset et al.](https://observations.lam.fr/astero/Papers/Marsset2020.pdf) give a complementary interpretation. The LAM downloads need the public-site cookie recorded in the manifest.

## Processing

The MPCD surface is simplified with meshoptimizer 1.2.0 to 766 native PolyCSS u triangles, the fewest within its 4500 m error allowance in a 3515 × 3728 atlas, with a 4500 m stopping threshold. Geometry and flood/directional lighting are prepared ahead of runtime.

Elevation samples the original mesh radius minus a 255.5 km reference sphere, with a -60 to 40 km legend, from 721 × 361 source directions with a cartographic hillshade.

The original frame is kept with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000. Horizons elements are pinned at JD 2461286.5 (2026-09-03).

The SPHERE photograph combines the survey's deconvolved frames with matched relative levels, averaged where frames overlap, each fading out toward its disc edge.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.2](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-10-08 04:56:05 | 0.972 | 0.972 | 0.991 | 0° | -1°, 1° | 72.7° against 71.3° |
| 2017-10-11 05:08:49 | 0.976 | 0.971 | 0.995 | 0° | -1°, 2° | 74.2° against 72.1° |
| 2017-10-11 06:05:07 | 0.974 | 0.976 | 0.982 | 10° | -6°, -4° | 74.2° against 71.8° |
| 2017-10-11 06:55:36 | 0.969 | 0.972 | 0.990 | 0° | -2°, -1° | 74.3° against 71.6° |
| 2017-10-28 08:32:24 | 0.963 | 0.961 | 0.986 | 0° | -2.5°, 2° | 82.9° against 81.4° |
| 2017-11-03 03:22:08 | 0.980 | 0.974 | 0.991 | 0° | 0°, 0.5° | 85.7° against 83.6° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.826 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 0 | — | — | — | its other 30 frames | 0 of 30 | — | 27 of 30, 2.00° | — | ×1.03 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.2](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 4387.3 m error, which is not a Hausdorff bound. Independent nearest-triangle sampling (8192 samples each way) measured p95 2436.2 m and maximum 4617.6 m. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features. Re-prepared 2026-10-06: the error allowance now decides the face count, 766 faces at 4387 m estimated simplifier error; checks and sampled distances recorded here before that date describe the earlier 800-face mesh.

## Known problems

- Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation includes global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.
- The SPHERE photograph shows photographed illumination, not albedo or color. The frames see Pallas from 63° to 70° south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
