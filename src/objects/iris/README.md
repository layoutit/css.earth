# Iris

Iris is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on its published reconstruction, which combines resolved telescope images with an ADAM starting shape, with a SPHERE photograph and an Elevation view.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/7_Iris_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [23 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 2017 October 10 and 11](https://observations.lam.fr/astero/Data/7Iris/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/7_Iris_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/7_Iris_param.txt), read longitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.6](https://doi.org/10.1051/0004-6361/202141781); earlier [Hanuš et al. (2019), Figure 2](https://doi.org/10.1051/0004-6361/201834541) |

Vernazza et al. (2021) give a volume-equivalent diameter of 199 km, ecliptic J2000 pole (20°, 23°) and sidereal period 7.138843 h. The [original MPCD mesh](https://observations.lam.fr/astero/3Dshape/7_Iris_mpcd.obj) has 13970 vertices and 27936 triangles in kilometers. Its measured volume-equivalent radius is 101.958245 km; the coordinates are not rescaled to the survey's averaged diameter.

## Processing

The mesh is simplified with meshoptimizer 1.2.0 to 722 native PolyCSS triangles, the fewest within its 2200 m error allowance. Geometry and lighting are prepared ahead of runtime. The original frame is kept with +Z north and east-positive longitude. Rotation has an arbitrary display meridian, not an absolute rotational phase.

Elevation samples the original mesh radius minus a 99.5 km reference sphere, with a -40 to 40 km legend. It includes global shape, not height above a gravitational equipotential.

The SPHERE photograph shows photographed illumination from the deconvolved frames. Relative frame levels are matched between 0.86 and 1.51, averaged where frames overlap, each fading out toward its disc edge. The survey's rotation record lists pole longitude first; read that way, it matches Hanuš et al. (2019) Table 1 to 0.1°.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.6](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-10-10 04:00:55 | 0.981 | 0.983 | 0.988 | 0° | -1.5°, -1.5° | 23.3° against 19.6° |
| 2017-10-11 04:44:16 | 0.958 | 0.964 | 0.987 | 10° | -4.5°, -1.5° | 23.4° against 20.7° |
| 2017-10-11 05:38:15 | 0.976 | 0.980 | 0.985 | 0° | -3°, 1° | 23.4° against 19.8° |
| 2017-10-11 06:28:33 | 0.978 | 0.980 | 0.986 | 0° | -3°, -0.5° | 23.5° against 19.2° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 23 native frames after the centre fit is 0.843 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

Our outline meets the paper's photographs with at most a 1.5° turn, but needs 1.5° to 4.5° to meet its model panels, about the spin-axis difference. So the paper's own model and photograph panels differ by roughly that angle; why is not verified here. Against Hanuš et al. (2019) Figure 2, the same cameras gave outline overlaps of 0.972 and 0.980 and put the authors' own crater identifications on one surface point to 6.1 km; the ledger entry `zimpol-published-comparison` keeps both results.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 23 | 9 | 6.83° | 1.98° | 6.54° | its other 23 frames | 0 of 23 | — | 23 of 23, 0.75° | — | ×1.02 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.6](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

The dataset ships on its published comparison, under the rule in the [surface-observations guide](../../../packages/bake/src/objects/layers/terrestrial/surface-observations/README.md#registration-stage). The outline test scores 9 of 23 frames, whose outlines are barely elongated enough to define an angle, and finds 6.5°. The same measure between the paper's own model and its images gives −9.3° to +13.4°, so it would reject the published fit too. The relief sweep places all 23 frames at 0.75°.

### Shape

Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1167.0 m and maximum 2456.1 m between source and display mesh. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features. Re-prepared 2026-10-06: the error allowance now decides the face count, 722 faces at 2198 m estimated simplifier error; checks and sampled distances recorded here before that date describe the earlier 800-face mesh.

## Known problems

- Shape uses the neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- The SPHERE photograph is not albedo or color. The frames see Iris from about 64° south, so the northern surface is unphotographed and keeps the grid. The native outlines fix the rotational phase to about a degree; the paper states no phase uncertainty.
- The crater coordinates in Hanuš et al. (2019) Table 2 are not used. Projected as printed, they land a median 139 km from the authors' own contours in their Figure 4, and no rotation or mirror of the table fits all six named craters. Their longitude system is not stated.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
