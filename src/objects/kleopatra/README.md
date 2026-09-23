# Kleopatra

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/216_Kleopatra_mpcd.obj), [Marchis et al. (2021)](https://doi.org/10.1051/0004-6361/202140874) |
| SPHERE photograph | [55 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 10 nights from 2017-07-14 to 2019-01-14](https://observations.lam.fr/astero/Data/216Kleopatra/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/216_Kleopatra_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/216_Kleopatra_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.37](https://doi.org/10.1051/0004-6361/202141781) |

The geometry is the original `216_Kleopatra_mpcd.obj` from the [LAM VLT/SPHERE asteroid survey release](https://observations.lam.fr/astero/3Dshape/). Cite Marchis, Jorda, Vernazza et al., [(216) Kleopatra, a low density critically rotating M-type asteroid](https://doi.org/10.1051/0004-6361/202140874), A&A 653 A57 (2021), and Vernazza et al., [VLT/SPHERE imaging survey: final results and synthesis](https://doi.org/10.1051/0004-6361/202141781), A&A 654 A56 (2021). Original inputs and authored preparation data are pinned in `source/manifest.json`.

**Shape** applies the shared neutral-gray material to the released geometry. It conveys the two lobes, their neck, and the model's broad relief. It is not a photograph, measured albedo, natural color or a map of metal abundance. The source was reconstructed with multiresolution photoclinometry by deformation (MPCD), starting with an ADAM model constrained by lightcurves, adaptive-optics images, occultations and radar. The MPCD solution gives greater weight to high-resolution VLT/SPHERE images. These ground-based observations do not measure small-scale terrain.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.37](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-07-14 05:00:59 | 0.891 | 0.925 | 0.936 | 0° | -3.5°, -0.5° | 131.2° against 127.4° |
| 2017-07-22 04:18:07 | 0.898 | 0.921 | 0.941 | 0° | -2.5°, 0° | 130.6° against 126.7° |
| 2017-07-22 05:05:06 | 0.909 | 0.907 | 0.948 | 0° | -1.5°, -1.5° | 130.6° against 128.4° |
| 2017-07-27 04:27:42 | 0.878 | 0.848 | 0.932 | -10° | -3°, -0.5° | 130.2° against 126.6° |
| 2017-08-10 05:21:58 | 0.873 | 0.905 | 0.937 | -10° | -3°, 0° | 129.3° against 125.1° |
| 2017-08-22 01:42:34 | 0.899 | 0.889 | 0.945 | 0° | -1.5°, -3.5° | 128.8° against 126.1° |
| 2018-12-10 06:53:28 | 0.920 | 0.878 | 0.953 | 0° | -2°, 4° | 50.7° against 49.0° |
| 2018-12-19 06:57:24 | 0.900 | 0.895 | 0.945 | 0° | -4°, 4.5° | 51.7° against 51.6° |
| 2018-12-22 05:58:43 | 0.921 | 0.885 | 0.956 | 0° | -1°, 2° | 52.1° against 52.0° |
| 2018-12-26 08:08:27 | 0.926 | 0.890 | 0.949 | 0° | -2.5°, 4.5° | 52.6° against 52.7° |
| 2019-01-14 05:10:04 | 0.914 | 0.854 | 0.954 | 0° | -2.5°, 5.5° | 55.0° against 56.6° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 55 native frames after the centre fit is 2.004 px at our phase; the lowest of a ±30° sweep is 1.810 px at -2°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 55 | 55 | 5.24° | 2.88° | 4.37° | its other 55 frames | 0 of 55 | — | 21 of 55, 0.00° | — | ×1.76 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.37](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

A separate nearest-surface diagnostic compares 8,192 deterministic area-stratified samples on each mesh against the other mesh's triangles using exact point-to-triangle distances with AABB pruning. Source-to-result mean/p95/p99/maximum sampled distances are **231.562/662.354/926.825/1272.402 m**; result-to-source values are **233.714/660.592/934.525/1307.387 m**. This accounts for concavity without projecting both surfaces onto one radial map. It is still sampled evidence, not an exhaustive Hausdorff bound.

Matched source/result preparation previews from six directions retain the two lobes and neck. They share the existing CPU context renderer and a neutral material. They demonstrate mesh shape correspondence, not native browser parity or observation-pixel parity. Fine features become more angular at the 800-face budget.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/kleopatra/source.test.mts).

## Known problems

Shadows defaults off. Existing preparation bakes diffuse directional lighting, available by switching Shadows on. There are no terrain-cast shadows. Pole orientation is source-supported, but absolute rotation phase is deliberately arbitrary, so the lit view is not a predicted observation at the displayed date.

**Elevation is deferred.** The full mesh includes nonradial concavity near the neck and lobes. A body-centered radius map gives only the nearest intersection and can assign the wrong radius to farther surfaces along the same ray. In the original 3,168-face source, 31 face centroids lie on a farther surface than the first radial intersection; the largest discrepancy is 27.5 km. Two of 8,192 equal-area test directions also have multiple source intersections. These diagnostics use the original mesh and demonstrate the radial representation's limitation, not simplification error. No radial replacement of geometry or misleading radial-height lens is published.

No unannotated, registered global optical, geological or compositional map was established in this bounded survey.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, each apparition placed through the surface it shares with another, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Kleopatra from 37° south to 32° north, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="kleopatra-source-record"></a>
<a id="presentation-and-limitations"></a>
<a id="bounded-source-survey-2026-09-07"></a>
<a id="physical-frame-and-scale"></a>
<a id="mesh-preparation-and-qualification"></a>

<details>
<summary>Methods and source notes</summary>

**Bounded source survey (2026-09-07)**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Physical frame and scale**

The original OBJ coordinates are kilometers. Their Z axis follows the north spin pole; the long axis lies approximately along X, and Y completes the right-handed frame. Source vertices and connectivity are preserved. The origin is the released model center; no translation, recentering or axis substitution is introduced. Longitudes are east-positive in that frame.

For the physical reference radius, use the MPCD volume-equivalent diameter 118.2 ±0.8 km from Marchis et al. Table 2: **59.1 km**. The source's maximum coordinate extents are approximately **271.91 ×107.03 ×72.00 km**. They differ from the paper's characteristic `a,b,c` values, which are not all maximum coordinate extents; source scale is established by the matching volume as well. The 800-face result has volume 855,483.71 km³, 1.12% below the original.

The observed MPCD ecliptic J2000 pole is λ=74.1°, β=+21.6° with a 5.385282 h period. The authored rotation record converts this pole to equatorial J2000 with obliquity 23.439291111°. Positive Z and the east-positive body axes are retained; the prime-meridian display phase is explicitly arbitrary. No IAU phase solution is claimed. The fixed-epoch heliocentric fit has semimajor axis **2.795397676845876 AU** at JD **2461286.5**, using the astronomy package's JPL Horizons pins. It is a local two-body approximation, not a long-term precision ephemeris. A nominal GM of **0.1982 km³/s²** follows the 2.97×10¹⁸ kg mass from the companion satellite-dynamics study, rounded for display context.

**Mesh preparation and qualification**

The shared Wavefront reader loads the source mesh. `source-meshoptimizer` simplifies its original connectivity before material baking. It does not sample replacement radial geometry. Source and result are each one closed consistently wound component with Euler characteristic 2 and positive volume. The source has 1,586 vertices, 4,752 edges and 3,168 faces; the result has 402 vertices, 1,200 edges and 800 faces. No opposite coincident face pairs were removed.

Meshoptimizer 1.2.0 uses ErrorAbsolute and RegularizeLight with an authored 1,500 m allowance; the library estimate is 1,299.988 m. In 8,192 equal-area Fibonacci radial directions, both meshes have zero missed first intersections. Mean/p95/p99/maximum differences are **353.482/1078.816/1790.177/5236.900 m**. These samples compare first intersections only, and the largest difference is near an oblique neck/lobe direction. They neither measure all concave surface points nor give an exhaustive bound. The library's regularized estimate is likewise not an exhaustive surface distance bound or source measurement accuracy.

Each display face is a native PolyCSS `u` raster triangle with a 128 px cell. Existing preparation owns source sampling, atlases, normal interpolation, lighting, retained leaves, shape targeting and context imagery. Runtime consumes prepared state. The context image uses this exact reduced mesh at 90°E, 35°N with full-phase ambient 0.45 and diffuse 0.55. Geometry's display radius of 110 CSS units frames the long body; its physical reference radius remains 59.1 km.

Restore with `node tools/objects/dist/operations.js acquire kleopatra`; verify with `acquire kleopatra --verify-only`; prepare with `node tools/objects/dist/prepare-authored.js kleopatra --write`. The public LAM site returns a JavaScript cookie interstitial; the download operation carries that ordinary cookie explicitly. The original OBJ, complete Marchis research paper and Inter font are direct pinned downloads; other documentation, title and generated context are checked-in source pins. The 22 MB paper stays intact and ignored by the body-owned .gitignore. Runtime installation is separate through `inventory.json`.

</details>
