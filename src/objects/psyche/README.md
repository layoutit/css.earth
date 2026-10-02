# Psyche

Psyche is a main-belt asteroid whose observations suggest a mixture of metal
and rock. Its flattened, irregular shape is reconstructed from ground-based
observations. It is shown with shape and elevation views, a SPHERE photograph
dataset, and ALMA thermal-inertia and dielectric-constant maps. Shape-only views
use the shared neutral gray (#808080 sRGB), a display convention, not a
measurement of surface color or albedo.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/16_Psyche_mpcd.obj): 3234 vertices, 6464 triangles, unmodified Cartesian coordinates in kilometers |
| Size and pole | [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Tables 1 and A.1: volume-equivalent diameter 223 km, ecliptic J2000 pole (35°, -9°), sidereal period 4.195948 h |
| Thermal inertia and dielectric constant | [Cambioni, de Kleer & Shepard (2022)](https://doi.org/10.1029/2021JE007091) maps, [Zenodo release](https://doi.org/10.5281/zenodo.6321315) (CC BY 4.0), kept unchanged in [source/thermal](source/thermal) |
| SPHERE photograph | [60 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 11 nights from 2018-04-24 to 2019-08-06](https://observations.lam.fr/astero/Data/16Psyche/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/16_Psyche_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/16_Psyche_param.txt), read longitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.14](https://doi.org/10.1051/0004-6361/202141781) |

The ALMA maps were fitted to ALMA 1.3 mm images of Psyche's thermal emission,
taken on 2019 June 19 at about 30 km resolution
([de Kleer et al. 2021](https://doi.org/10.3847/PSJ/ac01ec)). Thermal inertia
says how slowly the top centimetres heat and cool; the dielectric constant says
how strongly the material responds to an electric field, which the authors read
as the balance of metal and silicate. They are model fits, not photographs.

Considered but not shown: [DAMIT relative albedo](https://damit.cuni.cz/projects/damit/stored_files/open/105/albedo)
and its [paired older ADAM shape](https://damit.cuni.cz/projects/damit/stored_files/open/108/shape.txt),
whose correspondence with the MPCD release has not been established.

## Processing

The MPCD mesh is simplified with meshoptimizer 1.2.0 to 800 native PolyCSS
triangles. Its original coordinates are not rescaled to the survey's diameter.
Elevation samples the original mesh radius minus a 111.5 km reference sphere,
with a -40 to 40 km legend.

The SPHERE photograph and the ALMA maps ride the ADAM mesh, because the
release's rotation record describes that reconstruction. Frames are levelled
against each other, averaged where they overlap, and each fades out toward its
disc edge.

The ALMA release has one value per 5-degree node, 73 × 37, with NaN where the
authors dropped a node. 1,895 of 2,701 nodes are mapped, about 80% of the
surface by area. Each dataset draws one color per node with no smoothing. Each
mesh direction is carried into the map frame through the two published spin
states at the ALMA midpoint ([alma-body-frame.json](source/thermal/alma-body-frame.json)).
At that epoch the mesh prime meridian lies at map longitude −4.11° and the two
poles differ by 1.63°.

| Quantity | Mapped range | Median uncertainty (10th to 90th percentile) |
| --- | --- | --- |
| Thermal inertia | 25 to 594 J m⁻² K⁻¹ s⁻½, 23 distinct values | 134 (46 to 175) |
| Dielectric constant | 7.5 to 55 | 1.9 (0.5 to 4.1) |

## Evidence

- **ALMA spin state:** evaluated in TDB with JPL Horizons geometry ([vectors](source/reference/horizons-alma-2019-06-19.txt)), it reproduces all 22 sub-observer longitudes in de Kleer et al. (2021) Table 1 ([transcription](source/reference/de-kleer-2021-table1.json)) with a mean difference of 0.04°.
- **ALMA placement by shape:** the release's altitude map, compared with the same quantity from the ADAM mesh, matches best 1° from where the spin states put it (correlation 0.821). Mirrored or flipped maps peak at 0.455 to 0.618.
- **Display mesh:** independent nearest-triangle sampling measured p95 1043.4 m and maximum 2069.4 m against the source.

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `packages/bake/cli/published-comparison.mts` against [Figure B.14](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-04-24 08:42:52 | 0.964 | 0.961 | 0.965 | 0° | -1°, -2.5° | 33.1° against 35.8° |
| 2018-04-28 07:51:11 | 0.965 | 0.968 | 0.968 | 0° | -2°, 0.5° | 33.9° against 37.5° |
| 2018-05-04 05:53:17 | 0.966 | 0.967 | 0.969 | 0° | -1.5°, 0.5° | 35.4° against 38.4° |
| 2018-05-05 01:51:26 | 0.964 | 0.966 | 0.972 | 0° | -3°, -1° | 35.6° against 37.2° |
| 2018-06-03 23:58:13 | 0.961 | 0.956 | 0.969 | 0° | -2°, 2° | 48.1° against 46.6° |
| 2019-07-28 09:04:11 | 0.968 | 0.960 | 0.973 | 0° | -2.5°, -1° | 172.8° against 174.9° |
| 2019-07-30 06:27:16 | 0.966 | 0.948 | 0.970 | 0° | -1.5°, 1° | 172.9° against 175.1° |
| 2019-07-30 08:03:04 | 0.966 | 0.957 | 0.972 | 0° | -2°, -2° | 172.9° against 175.0° |
| 2019-08-03 04:56:19 | 0.969 | 0.963 | 0.968 | 0° | 0°, -1° | 173.0° against 175.2° |
| 2019-08-05 07:51:38 | 0.969 | 0.969 | 0.972 | 0° | -1°, -0.5° | 173.1° against 175.2° |
| 2019-08-06 02:42:42 | 0.968 | 0.965 | 0.973 | 0° | -1°, 0° | 173.2° against 175.5° |
| 2019-08-06 04:27:36 | 0.966 | 0.963 | 0.970 | 0° | -1°, -1° | 173.2° against 175.3° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 60 native frames after the centre fit is 1.224 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->


### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 60 | 49 | 4.64° | 3.29° | 3.28° | its other 60 frames | 1 of 60 | — | 10 of 60, -2.00° | — | ×1.59 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.14](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The ALMA maps are coarse and uncertain: a median thermal-inertia uncertainty of 134, 75% of the median value. Neighbouring colors often differ by less than their uncertainty.
- Cambioni et al. (2022) hatch 60° to 120° west in their frame as possibly affected by model artifacts. Those nodes are drawn like the rest; the dataset notes say so.
- The maps were fitted on the Shepard et al. (2021) shape, not the ADAM mesh. Their overall sizes agree to about 2%, but where the two shapes differ locally a value lands on slightly different ground.
- The LAM parameter file does not state its time scale. It is read in UTC; read in TDB it would move the mesh prime meridian 1.65° in map longitude.
- The SPHERE photograph is photographed illumination from deconvolved frames, not albedo or color. The frames see Psyche from 10° south to 80° north, so unseen surface keeps the missing-imagery grid.
- Shape is not photographed color, reflectance or composition. Elevation includes global shape, not height above a gravitational equipotential.
- Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. Reduction softens small features.
- Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Credits](NOTICE.md)
