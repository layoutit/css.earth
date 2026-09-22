# Elektra

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/130_Elektra_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 4 nights from 2019-07-30 to 2019-08-06](https://observations.lam.fr/astero/Data/130Elektra/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/130_Elektra_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/130_Elektra_param.txt), read longitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.33](https://doi.org/10.1051/0004-6361/202141781) |

Elektra is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 199 km, ecliptic J2000 pole (68°, -89°), sidereal period 5.224663 h. The original article is pinned and restorable.

- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/130_Elektra_mpcd.obj): 2642 vertices, 5280 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 99.295531 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 188.247 × 256.170 × 149.220 km; these are not best-fit ellipsoid axes.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.33](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2019-07-30 08:32:46 | 0.956 | 0.944 | 0.961 | 0° | -2.5°, 1.5° | 70.2° against 68.2° |
| 2019-07-30 09:15:30 | 0.960 | 0.951 | 0.967 | 0° | -1°, -0.5° | 70.2° against 68.2° |
| 2019-08-04 04:57:08 | 0.959 | 0.957 | 0.969 | -10° | -2.5°, -1.5° | 70.2° against 68.3° |
| 2019-08-04 06:14:35 | 0.934 | 0.922 | 0.962 | 0° | -6.5°, -6.5° | 70.2° against 68.2° |
| 2019-08-04 06:29:53 | 0.955 | 0.946 | 0.962 | 0° | -1°, -1° | 70.2° against 68.2° |
| 2019-08-05 09:17:43 | 0.958 | 0.950 | 0.967 | -10° | -3°, 0.5° | 70.2° against 68.3° |
| 2019-08-06 05:44:36 | 0.958 | 0.961 | 0.963 | 0° | -1.5°, -1.5° | 70.3° against 68.2° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.161 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 30 | 7.26° | 4.24° | 5.89° | its other 30 frames | 2 of 30 | — | 20 of 30, 6.00° | — | ×1.14 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.33](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1653.2 m error; the authored stopping threshold is 1700 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 983.6 m and maximum 1855.6 m.

Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 99.5 km reference sphere, with a -30 to 40 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Elektra from 1° to 2° south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Alternative released mesh](https://observations.lam.fr/astero/3Dshape/130_Elektra_adam.obj): radius 99.983975 km. The ADAM model is an alternative reconstruction of the same shape. Excluded as a second lens. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.

- [Released SPHERE images](https://observations.lam.fr/astero/Data/130Elektra/): individual, illuminated, resolved telescope images. Excluded as a globe texture in this PR: they are not a registered global reflectance mosaic. They remain the observational constraints behind the selected reconstruction.

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

Source pins live in [source/manifest.json](source/manifest.json); source/preparation/acquisition.json restores the ignored OBJ, original article and Inter font. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe.  Title provenance remains in its source directory.

</details>
