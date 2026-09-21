# (230) Athamantis

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 185](https://damit.cuni.cz/projects/damit/asteroid_models/view/185) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |
| SPHERE photograph | [14 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 2018-09-26 and 2018-09-28](https://observations.lam.fr/astero/Data/230Athamantis/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/230_Athamantis_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/230_Athamantis_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.38](https://doi.org/10.1051/0004-6361/202141781) |

Checked 2026-09-09. Selected DAMIT model **185**, version **2007-02-27**. DAMIT, Astronomical Institute of Charles University; Torppa et al. (2003), Hanuš et al. (2013); model 185, version 2007-02-27.

Convex light-curve reconstruction; 115 km volume-equivalent diameter (±12 km). Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.38](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-09-26 01:08:34 | 0.933 | 0.936 | 0.951 | 0° | 1°, -5.5° | 84.6° against 112.4° |
| 2018-09-26 23:35:19 | 0.925 | 0.906 | 0.954 | -10° | -1.5°, -3° | 84.6° against 112.2° |
| 2018-09-28 05:17:01 | 0.954 | 0.936 | 0.955 | 0° | 0°, 0° | 84.6° against 112.1° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 14 native frames after the centre fit is 0.915 px at our phase; the lowest of a ±30° sweep is 0.904 px at -4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 14 | 10 | 21.13° | 3.26° | 20.88° | its other 14 frames | 0 of 14 | — | 14 of 14, -3.00° | — | ×1.19 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.38](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [athamantis results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **438.92 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Hanuš 2013 Keck study Table 3 independently confirms 115±12 km for the first pole and 116±12 km for the mirror, based on one adaptive-optics image. DAMIT comment slightly prefers pole(74,+27), selected here. The geometry remains a convex lightcurve model; AO constrains scale and silhouette, not a global photographic surface.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 186, pole ['237', '29'], [Model 186](https://damit.cuni.cz/projects/damit/asteroid_models/view/186)

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Athamantis from 5° north, so surface the survey did not see keeps the missing-imagery grid.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 796328.21249552199 source units³; an independent triangle-centroid divergence sum gives 796328.21249552199. The existing recipe applies one uniform scale of 1.0000000315374733 km per source unit so its volume-equivalent diameter is 115 km.

No unit-volume assumption is made. Radius above a 57.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (74°, 27°), with sidereal period 23.9845 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1150 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
