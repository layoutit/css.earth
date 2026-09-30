# Parthenope

Parthenope is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown as its released shape model, an elevation map and a photograph built from SPHERE frames. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/11_Parthenope_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [24 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-02-06 to 2019-06-19](https://observations.lam.fr/astero/Data/11Parthenope/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/11_Parthenope_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/11_Parthenope_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.10](https://doi.org/10.1051/0004-6361/202141781) |

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 149 km, ecliptic J2000 pole (312°, 17°), sidereal period 13.72204 h.
- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/11_Parthenope_mpcd.obj): 2266 vertices, 4528 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 74.074078 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average.
- The [alternative ADAM mesh](https://observations.lam.fr/astero/3Dshape/11_Parthenope_adam.obj) is not a second dataset.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)

## Processing

The original surface is simplified with meshoptimizer 1.2.0 to 800 PolyCSS triangles, with geometry and lighting prepared ahead of runtime. Elevation samples the original mesh radius minus a 74.5 km reference sphere, with a -20 to 20 km legend. The published ecliptic pole is converted to equatorial J2000; JPL Horizons elements place the orbit.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.10](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-02-06 02:26:57 | 0.957 | 0.958 | 0.958 | 0° | -4.5°, 0.5° | 77.4° against 74.3° |
| 2019-04-19 04:01:56 | 0.957 | 0.960 | 0.961 | 0° | -4°, 0° | 177.6° against 175.6° |
| 2019-05-04 07:44:28 | 0.961 | 0.954 | 0.961 | 0° | 0.5°, 0.5° | 178.5° against 176.5° |
| 2019-06-05 05:38:50 | 0.958 | 0.943 | 0.964 | 0° | 1.5°, 1.5° | 0.1° against 178.1° |
| 2019-06-19 03:39:14 | 0.914 | 0.890 | 0.959 | 0° | -0.5°, 5.5° | 0.5° against 178.5° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 24 native frames after the centre fit is 1.173 px at our phase; the lowest of a ±30° sweep is 1.111 px at 6°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 24 | 0 | — | — | — | its other 24 frames | 4 of 24 | -33.00° | 4 of 24, -8.50° | — | ×1.04 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.10](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Meshoptimizer estimates 1238.3 m error; this is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 679.8 m and maximum 1455.4 m. Face-centroid checks and 8192 sphere directions found no repeated radial intersection, which supports the radial-height dataset. Reduction softens small features.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, each apparition placed through the surface it shares with another, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Parthenope from 17° south to 71° north, so surface the survey did not see keeps the missing-imagery grid. Left out by name: zimpol-20190605-052639. The level fit finds it 4.79× dimmer than its apparition's first frame, which anchors that apparition's level, and 2.88× dimmer than the apparition's median frame; the dataset's level budget is 4×, and the figure does not show it.
