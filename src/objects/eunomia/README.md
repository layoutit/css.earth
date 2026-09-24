# Eunomia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/15_Eunomia_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [80 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 11 nights from 2018-03-22 to 2019-08-07](https://observations.lam.fr/astero/Data/15Eunomia/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/15_Eunomia_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/15_Eunomia_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.13](https://doi.org/10.1051/0004-6361/202141781) |

Eunomia is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 270 km, ecliptic J2000 pole (355°, -70°), sidereal period 6.082753 h. The original article is pinned and restorable.

- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/15_Eunomia_mpcd.obj): 5826 vertices, 11648 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 133.776919 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 336.708 × 255.162 × 230.803 km; these are not best-fit ellipsoid axes.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.13](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-03-22 07:34:12 | 0.959 | 0.941 | 0.968 | 0° | -3°, 0.5° | 88.3° against 86.5° |
| 2018-04-23 06:59:58 | 0.963 | 0.961 | 0.972 | 0° | -2.5°, -2.5° | 90.7° against 88.9° |
| 2018-04-28 07:03:43 | 0.960 | 0.964 | 0.973 | 0° | -3.5°, 1° | 91.3° against 89.4° |
| 2018-05-05 01:03:24 | 0.965 | 0.964 | 0.971 | -10° | -5°, 3° | 92.0° against 90.4° |
| 2018-05-05 02:21:29 | 0.970 | 0.962 | 0.972 | 0° | 0°, 1° | 92.1° against 90.2° |
| 2018-05-16 03:44:58 | 0.971 | 0.965 | 0.972 | 0° | 0.5°, 0.5° | 93.3° against 91.6° |
| 2019-07-28 08:52:58 | 0.973 | 0.973 | 0.982 | 0° | -2.5°, 1.5° | 60.8° against 58.5° |
| 2019-07-29 04:43:47 | 0.976 | 0.971 | 0.983 | 0° | -1.5°, 1° | 60.8° against 58.4° |
| 2019-07-30 06:54:49 | 0.971 | 0.973 | 0.980 | 0° | -2°, 1° | 60.8° against 58.5° |
| 2019-08-04 04:31:05 | 0.975 | 0.971 | 0.980 | 0° | 0°, 6° | 60.8° against 58.5° |
| 2019-08-04 05:08:04 | 0.974 | 0.975 | 0.982 | 0° | -3°, 1° | 60.8° against 58.6° |
| 2019-08-04 07:39:29 | 0.976 | 0.969 | 0.982 | 0° | -1°, 0° | 60.8° against 58.4° |
| 2019-08-05 05:45:23 | 0.975 | 0.976 | 0.984 | 0° | -2°, 0.5° | 60.8° against 58.4° |
| 2019-08-07 08:16:10 | 0.978 | 0.975 | 0.979 | 0° | -1.5°, 0.5° | 60.8° against 58.4° |
| 2019-08-07 08:38:30 | 0.978 | 0.973 | 0.981 | 0° | -1°, -1° | 60.8° against 58.4° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 80 native frames after the centre fit is 1.338 px at our phase; the lowest of a ±30° sweep is 1.307 px at 4°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 80 | 45 | 9.12° | 4.95° | 7.66° | its other 80 frames | 1 of 80 | — | 24 of 80, 5.00° | — | ×1.17 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.13](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 2439.6 m error; the authored stopping threshold is 2500 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1403.5 m and maximum 2576.3 m.

Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 135 km reference sphere, with a -30 to 40 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, each apparition placed through the surface it shares with another, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Eunomia from 3° to 10° south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Alternative released mesh](https://observations.lam.fr/astero/3Dshape/15_Eunomia_adam.obj): radius 135.420305 km. The ADAM model is an alternative reconstruction of the same shape. Excluded as a second lens. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.

- [Released SPHERE images](https://observations.lam.fr/astero/Data/15Eunomia/): individual, illuminated, resolved telescope images. Excluded as a globe texture in this PR: they are not a registered global reflectance mosaic. They remain the observational constraints behind the selected reconstruction.

- [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf): complementary interpretation and model/image comparisons.

</details>

<a id="shape-elevation-and-lighting"></a>

<details>
<summary>Shape, elevation and lighting</summary>

The original connected surface is simplified with meshoptimizer 1.2.0, ErrorAbsolute and RegularizeLight, to 800 native PolyCSS u triangles. Each raster leaf is 128 × 128 px in a 2048 × 6400 atlas. Geometry and per-texel flood/directional lighting are prepared ahead of runtime.

No radial substitute, runtime triangulation, fabricated texture or additional renderer is used.

</details>

<a id="frame-and-ephemeris"></a>

<details>
<summary>Frame and ephemeris</summary>

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. The release’s unlabeled parameter file is preserved as evidence and is not read as an IAU W model.

Original JPL Horizons elements and independent vectors are pinned at JD 2461286.5 (2026-09-03). Heliocentric ICRF conics serve the existing fixed-date context, not long-term perturbation ephemerides. The independent vectors at ±30 days have measured regression guards in the astronomy package.

TDB is approximated as TT within 2 ms.

</details>

<a id="reproduction"></a>

<details>
<summary>Reproduction</summary>

Source pins live in [source/manifest.json](source/manifest.json); source/preparation/acquisition.json restores the ignored OBJ. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe.  Title provenance remains in its source directory.

</details>
