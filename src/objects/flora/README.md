# Flora

Flora is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown as its released shape model, an elevation map and a photograph built from SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/8_Flora_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [20 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 3 nights from 2017-12-30 to 2019-05-04](https://observations.lam.fr/astero/Data/8Flora/Deconv/) on the [ADAM reconstruction, as DAMIT model 5928 distributes it](https://damit.cuni.cz/projects/damit/generated_files/open/AsteroidModel/5928/shape.obj) |
| Photograph cameras | [Rotation state, as DAMIT model 5928 states it](https://damit.cuni.cz/projects/damit/generated_files/open/AsteroidModel/5928/spin.txt), read longitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.7](https://doi.org/10.1051/0004-6361/202141781) |

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 146 km, ecliptic J2000 pole (337°, -1°), sidereal period 12.86667 h.
- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/8_Flora_mpcd.obj): 4002 vertices, 8000 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 70.982687 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Processing

The original surface is simplified with meshoptimizer 1.2.0 to 800 PolyCSS triangles, with geometry and lighting prepared ahead of runtime. Elevation samples the original mesh radius minus a 73 km reference sphere, with a -20 to 10 km legend. The published ecliptic pole is converted to equatorial J2000; JPL Horizons elements place the orbit.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.7](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-12-30 03:26:45 | 0.973 | 0.969 | 0.976 | 0° | -4°, 5° | 1.3° against 149.9° |
| 2017-12-30 05:47:16 | 0.969 | 0.961 | 0.974 | -10° | -6.5°, 1° | 1.3° against 147.4° |
| 2017-12-31 03:14:29 | 0.966 | 0.962 | 0.978 | -10° | -5.5°, -3.5° | 1.3° against 148.1° |
| 2019-05-04 08:21:41 | 0.959 | 0.957 | 0.963 | -10° | -2.5°, -2.5° | 14.5° against 4.9° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 20 native frames after the centre fit is 1.189 px at our phase; the lowest of a ±30° sweep is 1.158 px at -6°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 20 | 0 | — | — | — | its other 20 frames | 0 of 20 | — | 0 of 20 | — | ×1.15 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.7](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 1235.5 m error; this is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 649.8 m and maximum 1310.7 m. Face-centroid checks and 8192 sphere directions found no repeated radial intersection, which supports the radial-height dataset. Reduction softens small features.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, each apparition placed through the surface it shares with another, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Flora from 11° to 39° north, so surface the survey did not see keeps the missing-imagery grid.
