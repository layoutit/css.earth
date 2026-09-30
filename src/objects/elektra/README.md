# Elektra

Elektra is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on the survey's reconstruction with Shape, Elevation and SPHERE photograph views.

Shape-only views use the shared neutral gray (#808080 sRGB), a display convention, not a measurement of surface color or albedo.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/130_Elektra_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 4 nights from 2019-07-30 to 2019-08-06](https://observations.lam.fr/astero/Data/130Elektra/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/130_Elektra_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/130_Elektra_param.txt), read longitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.33](https://doi.org/10.1051/0004-6361/202141781) |

- Vernazza et al. (2021) give a volume-equivalent diameter of 199 km, ecliptic J2000 pole (68°, -89°) and sidereal period 5.224663 h.
- The MPCD mesh has 2642 vertices and 5280 triangles in kilometers, with a volume-equivalent radius of 99.295531 km. The coordinates are not rescaled to the survey's average diameter.
- [Released SPHERE images](https://observations.lam.fr/astero/Data/130Elektra/) and [individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) give the resolved images and complementary model comparisons.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Processing

The original surface is simplified with meshoptimizer 1.2.0 to 800 triangles. Elevation samples the original mesh radius minus a 99.5 km reference sphere, with a -30 to 40 km legend and a cartographic hillshade. The published ecliptic pole is converted to equatorial J2000. The photograph uses matched relative frame levels, averaged where frames overlap and fading out toward each disc edge.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.33](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2019-07-30 08:32:46 | 0.956 | 0.944 | 0.961 | 0° | -2.5°, 1.5° | 70.2° against 68.2° |
| 2019-07-30 09:15:30 | 0.960 | 0.951 | 0.967 | 0° | -1°, -0.5° | 70.2° against 68.2° |
| 2019-08-04 04:57:08 | 0.959 | 0.957 | 0.969 | -10° | -2.5°, -1.5° | 70.2° against 68.3° |
| 2019-08-04 06:14:35 | 0.934 | 0.922 | 0.962 | 0° | -6.5°, -6.5° | 70.2° against 68.2° |
| 2019-08-04 06:29:53 | 0.955 | 0.946 | 0.962 | 0° | -1°, -1° | 70.2° against 68.2° |
| 2019-08-05 09:17:43 | 0.958 | 0.950 | 0.967 | -10° | -3°, 0.5° | 70.2° against 68.3° |
| 2019-08-06 05:44:36 | 0.958 | 0.961 | 0.963 | 0° | -1.5°, -1.5° | 70.3° against 68.2° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.161 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 30 | 7.26° | 4.24° | 5.89° | its other 30 frames | 2 of 30 | — | 20 of 30, 6.00° | — | ×1.14 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.33](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Source and output are each one closed component. Nearest-triangle sampling between them measured p95 983.6 m and maximum 1855.6 m. No repeated radial intersection was found, which supports the radial-height dataset.

## Known problems

- Shape uses the shared neutral-gray material, not photographed color or inferred composition. Elevation includes global shape, not height above a gravitational equipotential. Reduction softens small features, and a 4096 × 2048 display map does not add observational resolution.
- Rotation has an explicitly arbitrary display meridian for the Shape and Elevation views.
- The SPHERE photograph is photographed illumination, not albedo or colour. The frames see Elektra from 1° to 2° south, so surface the survey did not see keeps the missing-imagery grid.
- The heliocentric conic serves the fixed-date context, not long-term perturbation ephemerides.
