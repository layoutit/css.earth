# Urania

Urania is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape, and a SPHERE photograph is mapped onto the survey's model. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/30_Urania_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [20 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 3 nights from 2018-09-16 to 2018-09-28](https://observations.lam.fr/astero/Data/30Urania/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/30_Urania_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/30_Urania_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.21](https://doi.org/10.1051/0004-6361/202141781) |

- Vernazza et al. (2021) give a volume-equivalent diameter of 88 km, ecliptic J2000 pole (106°, 19°) and sidereal period 13.68717 h.
- The MPCD mesh has 1382 vertices and 2760 triangles in kilometres, not rescaled. Its volume-equivalent radius is 44.313292 km; the ADAM mesh's is 44.318957 km. The survey's diameter averages the two.
- The [released SPHERE images](https://observations.lam.fr/astero/Data/30Urania/) and the [survey paper](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) give the image comparisons behind the model. The LAM downloads need the public-site cookie recorded in the manifest.

## Processing

The MPCD surface is simplified with meshoptimizer 1.2.0 to 800 native PolyCSS u triangles, each a 128 × 128 px leaf in a 2048 × 6400 atlas, with a 900 m stopping threshold. Geometry and lighting are prepared ahead of runtime.

Elevation samples the original mesh radius minus a 44 km reference sphere, with a -20 to 30 km legend, from 721 × 361 source directions with a cartographic hillshade.

The SPHERE photograph combines the survey's deconvolved frames with matched relative levels, averaged where frames overlap, each fading out toward its disc edge.

The published ecliptic pole is converted to equatorial J2000. Horizons elements are pinned at JD 2461286.5 (2026-09-03).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.21](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-09-16 05:00:02 | 0.937 | 0.934 | 0.941 | 0° | -1.5°, 1.5° | 133.5° against 131.6° |
| 2018-09-27 02:17:58 | 0.935 | 0.933 | 0.942 | 0° | -1°, -1° | 133.1° against 131.1° |
| 2018-09-27 06:29:55 | 0.942 | 0.928 | 0.955 | 0° | -5°, -4° | 133.1° against 131.0° |
| 2018-09-28 03:11:08 | 0.942 | 0.943 | 0.945 | 0° | -2.5°, 1.5° | 133.1° against 131.1° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 20 native frames after the centre fit is 1.073 px at our phase; the lowest of a ±30° sweep is 1.015 px at -4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 20 | 9 | 29.21° | 16.43° | 24.15° | its other 20 frames | 2 of 20 | — | 9 of 20, -1.75° | — | ×1.06 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.21](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 814.1 m error, which is not a Hausdorff bound. Independent nearest-triangle sampling (8192 samples each way) measured p95 424.9 m and maximum 828.9 m. No repeated radial intersection was found, which supports the radial-height dataset. Reduction softens small features.

## Known problems

- Shape uses the shared neutral-gray material, not photographed color or composition. Elevation includes global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution.
- Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.
- The SPHERE photograph shows photographed illumination, not albedo or colour. The frames see Urania from 17° to 20° north, so unseen surface keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
