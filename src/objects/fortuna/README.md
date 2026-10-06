# Fortuna

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/19_Fortuna_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 3 nights from 2018-01-07 to 2018-02-06](https://observations.lam.fr/astero/Data/19Fortuna/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/19_Fortuna_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/19_Fortuna_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.16](https://doi.org/10.1051/0004-6361/202141781) |

Fortuna is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape. [Vernazza et al. (2021)](https://doi.org/10.1051/0004-6361/202141781), Tables 1 and A.1, give the volume-equivalent diameter 211 km, ecliptic J2000 pole (103°, 60°) and sidereal period 7.443224 h.

The [original MPCD mesh](https://observations.lam.fr/astero/3Dshape/19_Fortuna_mpcd.obj) has 4642 vertices and 9280 triangles, in unmodified Cartesian kilometres. Its measured volume-equivalent radius is 105.264481 km. The survey's diameter averages ADAM and MPCD; the coordinates are not rescaled to that average. Maximum Cartesian extents are 250.615 × 206.345 × 200.065 km; these are not best-fit ellipsoid axes. The [alternative ADAM mesh](https://observations.lam.fr/astero/3Dshape/19_Fortuna_adam.obj) (radius 105.653623 km) is excluded as a second dataset: the MPCD refinement uses resolved SPHERE detail (survey section 3 and Appendix B).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.16](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-01-07 05:22:02 | 0.964 | 0.948 | 0.975 | 0° | -4°, -4° | 89.5° against 87.5° |
| 2018-01-07 05:34:33 | 0.954 | 0.950 | 0.977 | 0° | -5.5°, -2.5° | 89.5° against 87.6° |
| 2018-01-07 06:30:50 | 0.963 | 0.950 | 0.973 | 0° | 1°, 2° | 89.5° against 87.6° |
| 2018-01-07 06:47:30 | 0.970 | 0.963 | 0.974 | 0° | -2°, -2° | 89.5° against 87.6° |
| 2018-01-07 07:18:54 | 0.963 | 0.957 | 0.972 | 10° | -2°, -1.5° | 89.5° against 87.5° |
| 2018-01-29 04:49:51 | 0.971 | 0.971 | 0.974 | 0° | -2°, -1° | 90.3° against 88.3° |
| 2018-02-06 03:09:46 | 0.973 | 0.973 | 0.974 | 0° | -2°, 0.5° | 90.7° against 88.8° |
| 2018-02-06 03:18:08 | 0.976 | 0.972 | 0.973 | 0° | -1°, 1.5° | 90.7° against 88.8° |
| 2018-02-06 05:02:26 | 0.970 | 0.970 | 0.975 | 0° | -2°, -2° | 90.7° against 88.5° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.197 px at our phase; the lowest of a ±30° sweep is 1.160 px at 2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 10 | 4.20° | 1.48° | 3.93° | its other 30 frames | 1 of 30 | — | 15 of 30, 2.75° | — | ×1.16 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.16](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1793.5 m error; the authored stopping threshold is 1800 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1004.2 m and maximum 1907.5 m. No source face centroid or sphere direction has a repeated radial intersection, which supports the radial-height dataset. Reduction softens small features.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 105.5 km reference sphere, with a -20 to 30 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or color. The frames see Fortuna from 21° to 23° south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Methods and source notes

<a id="shape-elevation-and-lighting"></a>
<a id="frame-and-ephemeris"></a>
<a id="reproduction"></a>

<details>
<summary>Shape, frame and reproduction</summary>

The connected surface is simplified with meshoptimizer 1.2.0, ErrorAbsolute and RegularizeLight, to 764 native PolyCSS triangles, the fewest within its 1800 m error allowance. Each raster leaf is 128 × 128 px in a 2048 × 6400 atlas. Geometry and per-texel flood/directional lighting are prepared ahead of runtime. The scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade.

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. The release's unlabeled parameter file is preserved as evidence and is not read as an IAU W model. JPL Horizons elements and independent vectors are taken at JD 2461286.5 (2026-09-03). Heliocentric ICRF conics serve the fixed-date context, not long-term perturbation ephemerides. TDB is approximated as TT within 2 ms.

Source records live in [source/manifest.json](source/manifest.json); source/preparation/acquisition.json restores the ignored OBJ. LAM's ordinary public-site cookie is explicitly recorded. [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) gives complementary interpretation and model/image comparisons.

</details>
