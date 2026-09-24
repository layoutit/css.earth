# Bamberga

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/324_Bamberga_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [85 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 15 nights from 2017-06-23 to 2019-01-27](https://observations.lam.fr/astero/Data/324Bamberga/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/324_Bamberga_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/324_Bamberga_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.39](https://doi.org/10.1051/0004-6361/202141781) |

Bamberga is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 227 km, ecliptic J2000 pole (17°, -57°), sidereal period 29.4403 h. The original article is pinned and restorable.

- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/324_Bamberga_mpcd.obj): 4498 vertices, 8992 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 113.552785 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 228.032 × 236.626 × 229.238 km; these are not best-fit ellipsoid axes.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.39](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-06-23 05:45:06 | 0.978 | 0.962 | 0.978 | 0° | -2°, 5° | 57.6° against 46.3° |
| 2017-07-14 04:34:31 | 0.969 | 0.964 | 0.978 | -10° | -3.5°, -2.5° | 61.3° against 46.8° |
| 2017-07-20 03:37:55 | 0.965 | 0.959 | 0.977 | 10° | -1°, -0.5° | 62.1° against 46.8° |
| 2017-07-25 04:51:49 | 0.971 | 0.959 | 0.978 | -10° | -5°, 0.5° | 62.7° against 46.9° |
| 2017-07-29 02:09:03 | 0.959 | 0.937 | 0.976 | 10° | -2°, 6° | 63.1° against 47.0° |
| 2017-08-19 01:50:03 | 0.940 | 0.926 | 0.973 | 0° | -8°, 3° | 63.5° against 47.1° |
| 2017-08-22 02:26:44 | 0.929 | 0.930 | 0.978 | -20° | 3.5°, 7° | 63.4° against 47.1° |
| 2018-12-22 06:15:22 | 0.955 | 0.942 | 0.975 | -10° | 3°, 5° | 137.7° against 127.4° |
| 2018-12-23 06:33:58 | 0.962 | 0.948 | 0.975 | 30° | -3°, -2° | 137.7° against 127.4° |
| 2019-01-09 05:54:15 | 0.974 | 0.971 | 0.976 | 0° | -3.5°, 0° | 136.6° against 128.5° |
| 2019-01-10 05:19:33 | 0.977 | 0.964 | 0.976 | 0° | -2°, -2.5° | 136.6° against 128.5° |
| 2019-01-13 06:49:59 | 0.971 | 0.966 | 0.975 | 0° | -2°, 2.5° | 136.3° against 129.0° |
| 2019-01-16 03:40:20 | 0.977 | 0.970 | 0.973 | 0° | -2°, 0.5° | 136.0° against 129.1° |
| 2019-01-17 04:22:01 | 0.976 | 0.966 | 0.977 | 0° | -3.5°, 0.5° | 135.9° against 129.2° |
| 2019-01-27 02:58:49 | 0.975 | 0.960 | 0.977 | 0° | -2.5°, 0° | 135.0° against 129.9° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 85 native frames after the centre fit is 2.606 px at our phase; the lowest of a ±30° sweep is 2.370 px at -20°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 85 | 0 | — | — | — | its other 85 frames | 2 of 85 | — | 24 of 85, -6.75° | — | ×1.29 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.39](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1903.1 m error; the authored stopping threshold is 2000 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1146.0 m and maximum 2058.9 m.

Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 113.5 km reference sphere, with a -20 to 20 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, each apparition placed through the surface it shares with another, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Bamberga from 5° south to 19° north, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Alternative released mesh](https://observations.lam.fr/astero/3Dshape/324_Bamberga_adam.obj): radius 113.297333 km. The ADAM model is an alternative reconstruction of the same shape. Excluded as a second lens. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.

- [Released SPHERE images](https://observations.lam.fr/astero/Data/324Bamberga/): individual, illuminated, resolved telescope images. Excluded as a globe texture in this PR: they are not a registered global reflectance mosaic. They remain the observational constraints behind the selected reconstruction.

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
