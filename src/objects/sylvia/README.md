# Sylvia

Sylvia is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. It is shown on the survey's reconstruction with Shape, Elevation and SPHERE photograph views.

Shape-only views use the shared neutral gray (#808080 sRGB), a display convention, not a measurement of surface color or albedo.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Shape | [LAM `87_Sylvia_mpcd.obj`](https://observations.lam.fr/astero/3Dshape/87_Sylvia_mpcd.obj), [Vernazza et al. 2021](https://doi.org/10.1051/0004-6361/202141781). SPHERE-constrained reconstruction; original kilometer coordinates retained. |
| Elevation | Radius minus 137 km, false color over −50 to +70 km; broad shape, not gravitational height. |
| Position | [Retained Sylvia vector](../romulus/source/orbit/sylvia-heliocentric.txt) at 3 September 2026 TT, shared with Romulus. |
| SPHERE photograph | [32 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 6 nights from 2018-10-15 to 2018-11-29](https://observations.lam.fr/astero/Data/87Sylvia/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/87_Sylvia_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/87_Sylvia_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.29](https://doi.org/10.1051/0004-6361/202141781) |

- Vernazza et al. (2021), Table 1 and Table A.1, give a volume-equivalent diameter of 274 km, ecliptic J2000 pole (75°, 64°) and sidereal period 5.18364 h.
- The MPCD mesh has 2898 vertices and 5792 triangles, with a volume-equivalent radius of 135.612406 km. The ADAM mesh (radius 136.946453 km) carries the photograph because the rotation record describes it; Shape and Elevation keep the MPCD refinement.
- [Released SPHERE images](https://observations.lam.fr/astero/Data/87Sylvia/) and [individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf) give the resolved images and complementary model comparisons.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

The original surface is simplified with meshoptimizer 1.2.0 to 800 triangles. Elevation samples 721 × 361 source directions with a cartographic hillshade. The published ecliptic pole is converted to equatorial J2000. The photograph uses computed cameras and matched relative frame levels, averaged where frames overlap and fading out toward each disc edge. The heliocentric vector's position, velocity and solar GM define the same conic in every prepared view; the [epoch record](../romulus/source/validation/epoch-state.json) binds it.

## Evidence

Source and output are each one closed component. Nearest-triangle sampling between them measured p95 1342.9 m and maximum 2452.8 m. No repeated radial intersection was found, which supports the radial-height dataset.

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.29](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-10-15 08:46:57 | 0.961 | 0.955 | 0.966 | 0° | -1°, -0.5° | 85.7° against 83.8° |
| 2018-10-15 09:00:40 | 0.953 | 0.959 | 0.962 | 0° | -2.5°, -0.5° | 85.7° against 83.8° |
| 2018-10-19 04:30:52 | 0.956 | 0.946 | 0.967 | 10° | -1°, 2° | 85.7° against 83.9° |
| 2018-11-12 06:11:12 | 0.963 | 0.958 | 0.965 | 10° | -1.5°, 0.5° | 86.0° against 84.1° |
| 2018-11-12 07:02:46 | 0.965 | 0.962 | 0.966 | 0° | -1.5°, 0° | 86.0° against 84.0° |
| 2018-11-25 04:40:40 | 0.967 | 0.961 | 0.968 | 0° | 0°, 0.5° | 86.2° against 84.2° |
| 2018-11-26 02:31:28 | 0.967 | 0.965 | 0.971 | 0° | -1°, 0° | 86.2° against 84.2° |
| 2018-11-29 04:41:40 | 0.963 | 0.957 | 0.969 | 0° | -2°, 0.5° | 86.2° against 84.3° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 32 native frames after the centre fit is 5.298 px at our phase; the lowest of a ±30° sweep is 5.212 px at 14°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 32 | 32 | 4.41° | 3.35° | 2.86° | its other 32 frames | 1 of 32 | — | 5 of 32, 7.00° | — | ×7.94 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.29](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Shape uses the shared neutral-gray material, not photographed color or inferred composition. Elevation includes global shape, not height above a gravitational equipotential. Reduction softens small features, and a 4096 × 2048 display map does not add observational resolution.
- Rotation has an explicitly arbitrary display meridian for the Shape and Elevation views.
- The SPHERE photograph is photographed illumination, not albedo or colour. The frames see Sylvia from 18° south, so surface the survey did not see keeps the missing-imagery grid.
- Frame zimpol-20181112-061547 is left out: its limb fit does not settle, and the centre still moves 0.55 px.
- The heliocentric conic serves the fixed-date context, not long-term perturbation ephemerides.
