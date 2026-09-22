# (63) Ausonia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5924](https://damit.cuni.cz/projects/damit/asteroid_models/view/5924) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |
| SPHERE photograph | [25 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 2018-09-28 and 2018-09-29](https://observations.lam.fr/astero/Data/63Ausonia/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/63_Ausonia_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/63_Ausonia_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.28](https://doi.org/10.1051/0004-6361/202141781) |

Checked 2026-09-09. Selected DAMIT model **5924**, version **2021-11-12**. DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5924, version 2021-11-12.

Nonconvex model constrained by resolved imaging, 93 ± 3 km volume-equivalent diameter in the selected archive record. Grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.28](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-09-28 05:33:52 | 0.930 | 0.919 | 0.938 | -10° | -1.5°, 0.5° | 3.5° against 1.6° |
| 2018-09-28 07:02:13 | 0.935 | 0.935 | 0.940 | 0° | -2°, 0° | 3.5° against 1.6° |
| 2018-09-28 07:17:29 | 0.922 | 0.930 | 0.936 | 0° | -6°, 0° | 3.5° against 1.5° |
| 2018-09-28 07:37:31 | 0.925 | 0.930 | 0.931 | 0° | -2°, 0.5° | 3.5° against 1.5° |
| 2018-09-29 06:43:19 | 0.924 | 0.917 | 0.934 | 0° | -4.5°, -2° | 3.5° against 1.5° |
| 2018-09-29 07:25:25 | 0.925 | 0.919 | 0.928 | 0° | -3°, -1° | 3.5° against 1.4° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 25 native frames after the centre fit is 0.927 px at our phase; the lowest of a ±30° sweep is 0.910 px at -2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 25 | 14 | 10.18° | 4.58° | 9.09° | its other 25 frames | 0 of 25 | — | 5 of 25, -8.00° | — | ×1.20 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.28](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [ausonia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **569.97 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 140, pole ['120', '-15'], [Model 140](https://damit.cuni.cz/projects/damit/asteroid_models/view/140)

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Ausonia from 15° to 16° north, so surface the survey did not see keeps the missing-imagery grid.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 578 vertices and 1152 triangles. Its signed tetrahedral volume is 423136.43878432951 source units³; an independent triangle-centroid divergence sum gives 423136.43878432951. The existing recipe applies one uniform scale of 0.9984408632995786 km per source unit so its volume-equivalent diameter is 93 km.

No unit-volume assumption is made. Radius above a 46.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (121°, -27°), with sidereal period 9.29759 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. This model disables the existing optional RegularizeLight flag: regularization exceeded the source-transfer allowance in one sampled patch, whereas the position-error reduction preserves 800 faces within the sampled allowance.

The error allowance is 930 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
