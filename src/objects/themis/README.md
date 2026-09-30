# Themis

Themis is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on the survey's released reconstruction with a Shape view, an Elevation view and a SPHERE photograph cast onto the mesh.

Shape-only views use the shared neutral gray (#808080 sRGB), a display convention, not a measurement of surface color or albedo.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/24_Themis_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-12-27 to 2019-01-17](https://observations.lam.fr/astero/Data/24Themis/Deconv/) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/24_Themis_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.19](https://doi.org/10.1051/0004-6361/202141781) |

- Vernazza et al. (2021) give a volume-equivalent diameter of 208 km, ecliptic J2000 pole (146°, 73°) and sidereal period 8.374187 h.
- The original MPCD mesh has 2978 vertices and 5952 triangles in kilometers, with a volume-equivalent radius of 103.803127 km. The coordinates are not rescaled to the survey's average diameter.
- Each ZIMPOL frame is 256 × 256 px at 3.63 mas/px in the N_R filter, with the disc 41 to 42 px across. They are the survey's own deconvolutions; no radiometric calibration accompanies them.
- The rotation record is read latitude-first because 145.9511° cannot be a latitude and both columns match the pole of [DAMIT model 5916](https://damit.cuni.cz/projects/damit/asteroid_models/view/5916).
- An [alternative released mesh](https://observations.lam.fr/astero/3Dshape/24_Themis.obj) is excluded. [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) gives complementary model and image comparisons.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Processing

The original surface is simplified with meshoptimizer 1.2.0 to 800 triangles. Elevation samples the original mesh radius minus a 104 km reference sphere, with a -30 to 20 km legend and a cartographic hillshade.

Each photograph camera is computed, never authored: the rotation record gives the pole and absolute rotational phase, JPL Horizons gives the Paranal sighting and Sun direction, each frame's header gives its plate scale and exposure, and the disc centre is fitted to the mesh limb. `node packages/bake/cli/observer-cameras.mts themis` reproduces every camera field. Level matching joins all 30 frames as a single group; overlapping frames are averaged, each fading out toward its disc edge.

## Evidence

Source and output are each one closed component. Nearest-triangle sampling between them measured p95 931.4 m and maximum 2449.6 m. No repeated radial intersection was found, which supports the radial-height dataset.

The frames cover 84.9% of the retained surface area, leaving at most a factor of 1.15 between overlapping frames.

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.19](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-12-27 06:43:58 | 0.960 | 0.958 | 0.966 | 0° | -3.5°, -0.5° | 109.5° against 107.6° |
| 2018-12-29 04:24:23 | 0.961 | 0.965 | 0.965 | 0° | -2°, 1.5° | 109.5° against 107.5° |
| 2019-01-09 05:14:59 | 0.961 | 0.964 | 0.966 | 10° | -2°, -2° | 109.2° against 107.2° |
| 2019-01-09 06:14:37 | 0.960 | 0.966 | 0.969 | 0° | -1.5°, 0° | 109.2° against 107.2° |
| 2019-01-13 06:07:03 | 0.957 | 0.961 | 0.965 | -10° | -4.5°, -2° | 109.1° against 107.1° |
| 2019-01-17 03:05:32 | 0.961 | 0.965 | 0.968 | -10° | -2°, -2.5° | 109.0° against 107.0° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.798 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 30 | 3.94° | 3.58° | 1.65° | its other 30 frames | 2 of 30 | — | 11 of 30, -8.25° | — | ×1.15 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.19](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

The outline is the measurement that reaches a verdict: all 30 frames match the photographed contour with 1.65° left after removing the 3.58° floor. The two sweeps that depend on surface markings do not place it: that is what a nearly featureless C-type on a light-curve shape looks like to those tests.

## Known problems

- Shape uses the shared neutral-gray material, not photographed color, reflectance or inferred composition. Elevation includes global shape, not height above a gravitational equipotential. Reduction softens small features.
- The photograph is relative deconvolved intensity with the photographed illumination left in, not measured albedo or colour. The grid marks surface that was unphotographed, too grazing or rejected.
- The survey released no ADAM reconstruction for this body, so the photograph rides the MPCD mesh rather than the reconstruction its rotation record was fitted alongside. Nothing registers the frames against surface markings.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- The Shape and Elevation views use an explicitly arbitrary display meridian. The photograph takes its absolute phase from the rotation record instead.
