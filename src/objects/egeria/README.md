# Egeria

Egeria is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape, and a SPHERE photograph is mapped onto the survey's model. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/13_Egeria_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [29 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-04-24 to 2018-05-15](https://observations.lam.fr/astero/Data/13Egeria/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/13_Egeria_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/13_Egeria_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.12](https://doi.org/10.1051/0004-6361/202141781) |

- Vernazza et al. (2021) give a volume-equivalent diameter of 202 km, ecliptic J2000 pole (38°, 31°) and sidereal period 7.046664 h.
- The MPCD mesh has 3906 vertices and 7808 triangles in kilometres, not rescaled. Its volume-equivalent radius is 101.555087 km; the ADAM mesh's is 101.240133 km. The survey's diameter averages the two.
- The [released SPHERE images](https://observations.lam.fr/astero/Data/13Egeria/) and the [survey paper](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) give the image comparisons behind the model. The LAM downloads need the public-site cookie recorded in the manifest.

## Processing

The MPCD surface is simplified with meshoptimizer 1.2.0 to 800 native PolyCSS u triangles, each a 128 × 128 px leaf in a 2048 × 6400 atlas, with an 1800 m stopping threshold. Geometry and lighting are prepared ahead of runtime.

Elevation samples the original mesh radius minus a 101 km reference sphere, with a -30 to 40 km legend, from 721 × 361 source directions with a cartographic hillshade.

The SPHERE photograph combines the survey's deconvolved frames with matched relative levels, averaged where frames overlap, each fading out toward its disc edge.

The published ecliptic pole is converted to equatorial J2000. Horizons elements are pinned at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.12](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-04-24 08:11:46 | 0.950 | 0.967 | 0.970 | -10° | -7°, 0.5° | 140.9° against 136.8° |
| 2018-04-28 07:31:51 | 0.918 | 0.966 | 0.973 | -10° | -8°, 0° | 140.9° against 136.6° |
| 2018-04-28 09:22:47 | 0.947 | 0.947 | 0.974 | 0° | -4.5°, -1.5° | 140.9° against 136.9° |
| 2018-05-04 09:28:48 | 0.927 | 0.963 | 0.970 | -10° | -6.5°, 1° | 140.7° against 136.7° |
| 2018-05-05 04:23:44 | 0.960 | 0.967 | 0.973 | 0° | -5.5°, -1° | 140.7° against 137.0° |
| 2018-05-15 07:30:27 | 0.929 | 0.961 | 0.971 | -10° | -7.5°, -1° | 140.1° against 136.3° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 29 native frames after the centre fit is 1.946 px at our phase; the lowest of a ±30° sweep is 1.898 px at -4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 29 | 19 | 2.98° | 1.89° | 2.31° | its other 29 frames | 0 of 29 | — | 2 of 29 | — | ×1.05 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.12](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1754.8 m error, which is not a Hausdorff bound. Independent nearest-triangle sampling (8192 samples each way) measured p95 1028.3 m and maximum 2184.9 m. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features.

## Known problems

- Shape uses the shared neutral-gray material, not photographed color or composition. Elevation includes global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.
- The SPHERE photograph shows photographed illumination, not albedo or color. The frames see Egeria from 54° to 59° north, so unseen surface keeps the missing-imagery grid.
- Frame zimpol-20180515-071822 is left out. The level fit finds it 4.36× dimmer than the first frame and 4.09× dimmer than the median frame, beyond the dataset's 4× level budget, and the figure does not show it.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
