# (173) Ino

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5913](https://damit.cuni.cz/projects/damit/asteroid_models/view/5913) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |
| SPHERE photograph | [25 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 3 nights from 2018-09-15 to 2018-09-28](https://observations.lam.fr/astero/Data/173Ino/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/173_Ino_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/173_Ino_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.35](https://doi.org/10.1051/0004-6361/202141781) |

Checked 2026-09-09. Selected DAMIT model **5913**, version **2021-11-12**. DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5913, version 2021-11-12.

ADAM nonconvex reconstruction constrained by VLT/SPHERE images. Selected archive volume-equivalent diameter: 144 ±3 km. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.35](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-09-15 08:41:57 | 0.940 | 0.969 | 0.968 | 10° | -6°, -1° | 169.4° against 1.9° |
| 2018-09-27 03:01:16 | 0.958 | 0.956 | 0.968 | 0° | -2°, 0° | 166.8° against 170.3° |
| 2018-09-27 07:11:12 | 0.929 | 0.960 | 0.965 | 10° | -8°, 1° | 166.8° against 172.5° |
| 2018-09-27 07:46:18 | 0.937 | 0.962 | 0.973 | 10° | -8°, 0.5° | 166.8° against 172.2° |
| 2018-09-28 02:59:21 | 0.955 | 0.952 | 0.974 | 0° | 0.5°, 1° | 166.7° against 171.2° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 25 native frames after the centre fit is 1.384 px at our phase; the lowest of a ±30° sweep is 1.334 px at 4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 25 | 0 | — | — | — | its other 25 frames | 0 of 25 | — | 8 of 25, 3.00° | — | ×1.02 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.35](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [ino results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **951.06 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral gray must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative.

Select Vernazza et al. (2021) ADAM model 5913 constrained by VLT/SPHERE images. DAMIT D144 ±3 km differs from the publication summary 145 ±3 km because the summary can average ADAM/MPCD outputs when coverage exceeds 80%; the exact selected mesh has raw volume diameter 144.329.

Keep the archive ADAM model separate from MPCD refinement. No albedo map is inferred from deconvolved disk images.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. The survey found no alternative archive solution for this target.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Ino from 56° to 58° south, so surface the survey did not see keeps the missing-imagery grid.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1766 vertices and 3528 triangles. Its signed tetrahedral volume is 1574200.8917261746 source units³; an independent triangle-centroid divergence sum gives 1574200.8917261746. The existing recipe applies one uniform scale of 0.99771993137968151 km per source unit so its volume-equivalent diameter is 144 km.

No unit-volume assumption is made. Radius above a 72 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (28°, -17°), with sidereal period 6.11094 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1440 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

The 800-face Meshoptimizer preparation disables triangle regularization. Dense transfer probes found three points beyond the unchanged 1,440 m correspondence limit in the regularized candidate. The source-preserving option reduced the trial maximum over 51,200 interior probes to 989 m, with no withheld probes; this sampled check is not an exhaustive bound or an observation-accuracy claim.

</details>
