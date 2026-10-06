# 9 Metis

9 Metis is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape, and a SPHERE photograph is mapped onto the survey's model. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/9_Metis_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 4 nights from 2018-06-08 to 2018-07-10](https://observations.lam.fr/astero/Data/9Metis/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/9_Metis_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/9_Metis_param), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.8](https://doi.org/10.1051/0004-6361/202141781) |

- Vernazza et al. (2021) give a volume-equivalent diameter of 173 km, ecliptic J2000 pole (181°, 22°) and sidereal period 5.079176 h.
- The MPCD mesh has 2962 vertices and 5920 triangles in kilometres, not rescaled. Its volume-equivalent radius is 85.910665 km; the ADAM mesh's is 86.604374 km. The survey's diameter averages the two.
- The ZIMPOL frames are 256 × 256 px at 3.63 mas/px in the N_R filter, 234.8 s each. The disc spans 42 to 44 px. They are the survey's own deconvolutions, without radiometric calibration.
- The parameter record gives pole latitude 22.7124°, pole longitude 181.3819°, period 5.07917676 h, phase epoch JD 2434419.0 and phase 0°. It is read latitude-first because 181.3819° cannot be a latitude.
- The [released SPHERE images](https://observations.lam.fr/astero/Data/9Metis/) and the [survey paper](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) give the image comparisons behind the model. The LAM downloads need the public-site cookie recorded in the manifest.

## Processing

The MPCD surface is simplified with meshoptimizer 1.2.0 to 670 native PolyCSS u triangles, the fewest within its 1700 m error allowance, with a 1700 m stopping threshold. Elevation samples the original mesh radius minus an 86.5 km reference sphere, with a -30 to 30 km legend.

The SPHERE photograph rides the ADAM mesh, because the rotation record describes that reconstruction; Shape and Elevation keep the MPCD refinement. The frames are combined with matched relative levels, averaged where they overlap, each fading toward its disc edge. The photograph takes its absolute phase from the parameter record, while the other views use an arbitrary display meridian.

The published ecliptic pole is converted to equatorial J2000. Horizons elements are pinned at JD 2461286.5 (2026-09-03).

## Evidence

Source and output are each one closed component with Euler characteristic 2. Independent nearest-triangle sampling (8192 samples each way) measured p95 880.4 m and maximum 1824.4 m. No repeated radial intersection was found, which supports the radial-height dataset.

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.8](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-06-08 06:44:46 | 0.959 | 0.952 | 0.966 | 0° | -2°, -0.5° | 24.0° against 22.0° |
| 2018-06-08 07:43:56 | 0.956 | 0.959 | 0.966 | 0° | -3°, -1° | 24.0° against 22.1° |
| 2018-06-12 04:13:13 | 0.959 | 0.961 | 0.967 | 0° | -1.5°, 0° | 24.5° against 22.5° |
| 2018-07-10 03:55:59 | 0.958 | 0.957 | 0.962 | -10° | -0.5°, -0.5° | 28.0° against 26.0° |
| 2018-06-17 03:05:19 | 0.963 | 0.955 | 0.964 | 0° | -2°, 2° | 25.1° against 23.2° |
| 2018-07-10 05:00:22 | 0.932 | 0.925 | 0.963 | 0° | -7.5°, -7.5° | 28.0° against 26.0° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.391 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 30 | 4.48° | 3.59° | 2.68° | its other 30 frames | 0 of 30 | — | 24 of 30, -2.75° | — | ×1.12 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.8](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Shape uses the shared neutral-gray material, not photographed color or composition. Elevation includes global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. Reduction softens small features.
- Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase, except for the photograph.
- The SPHERE photograph shows photographed illumination, not albedo or color. The frames see Metis from 3° to 9° south, so unseen surface keeps the missing-imagery grid. Nothing registers the frames against surface markings, because the two tests that would do so find nothing to lock onto. The dataset ships on the survey's own comparison figure, and the mesh, the rotation record and that figure all come from the same survey's images.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
