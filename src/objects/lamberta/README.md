# (187) Lamberta

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5914](https://damit.cuni.cz/projects/damit/asteroid_models/view/5914) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |
| SPHERE photograph | [25 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-03-15 to 2018-05-04](https://observations.lam.fr/astero/Data/187Lamberta/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/187_Lamberta_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/187_Lamberta_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.36](https://doi.org/10.1051/0004-6361/202141781) |

Checked 2026-09-09. Selected DAMIT model **5914**, version **2021-11-12**. DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5914, version 2021-11-12.

ADAM nonconvex reconstruction constrained by VLT/SPHERE images. Selected archive volume-equivalent diameter: 141 ±2 km. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.36](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-03-15 09:05:28 | 0.965 | 0.948 | 0.967 | 0° | 0°, -0.5° | 119.8° against 117.8° |
| 2018-03-26 08:31:26 | 0.962 | 0.953 | 0.967 | 0° | -3°, 3° | 120.0° against 118.0° |
| 2018-04-20 08:28:21 | 0.970 | 0.964 | 0.972 | 0° | -2.5°, -1.5° | 121.3° against 119.3° |
| 2018-04-24 06:36:58 | 0.968 | 0.968 | 0.972 | 0° | -2°, -2.5° | 121.5° against 119.4° |
| 2018-05-04 05:30:49 | 0.969 | 0.953 | 0.973 | 0° | 0.5°, 4.5° | 122.0° against 120.1° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 25 native frames after the centre fit is 0.935 px at our phase; the lowest of a ±30° sweep is 0.926 px at -4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 25 | 17 | 12.52° | 2.15° | 12.33° | its other 25 frames | 0 of 25 | — | 20 of 25, 1.00° | — | ×1.08 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.36](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [lamberta results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **1027.70 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral gray must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative.

Select Vernazza et al. (2021) ADAM model 5914 over older convex 1086. The VLT/SPHERE imaging study reports volume-equivalent 141 ±2 km, agreeing with the selected archive diameter and raw volume 141.094. MPCD is a promising refinement documented in the paper; its linked LAM release could not be retrieved during this survey.

The mounted source is the pinned ADAM mesh, not an unverified MPCD or reflectance product.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 1086, pole ['153', '-56'], [Model 1086](https://damit.cuni.cz/projects/damit/asteroid_models/view/1086)

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Lamberta from 4° south to 3° north, so surface the survey did not see keeps the missing-imagery grid.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 902 vertices and 1800 triangles. Its signed tetrahedral volume is 1470693.7403402955 source units³; an independent triangle-centroid divergence sum gives 1470693.7403402955. The existing recipe applies one uniform scale of 0.99933532370243183 km per source unit so its volume-equivalent diameter is 141 km.

No unit-volume assumption is made. Radius above a 70.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (115°, -80°), with sidereal period 10.667 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1410 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

The 800-face preparation uses Meshoptimizer absolute-error simplification without triangle regularization. The regularized candidate exceeded the unchanged 1,410 m sampled geometry limit; the selected option retained 800 closed faces and reduced the trial maximum sampled discrepancy to 1,028 m.

This is a sampled comparison against the published mesh, not an exhaustive geometric bound or an observation-accuracy claim.

</details>
