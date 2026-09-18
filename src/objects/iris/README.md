# Iris

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/7_Iris_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [23 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 2017 October 10 and 11](https://observations.lam.fr/astero/Data/7Iris/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/7_Iris_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/7_Iris_param.txt), read longitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.6](https://doi.org/10.1051/0004-6361/202141781); earlier [Hanuš et al. (2019), Figure 2](https://doi.org/10.1051/0004-6361/201834541) |

Iris is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 199 km, ecliptic J2000 pole (20°, 23°), sidereal period 7.138843 h. The original article is pinned and restorable.

- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/7_Iris_mpcd.obj): 13970 vertices, 27936 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 101.958245 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 246.448 × 242.631 × 155.531 km; these are not best-fit ellipsoid axes.

## Evidence

### SPHERE photograph

The photograph's placement reproduces the survey's own comparison of these frames with its models, [Vernazza et al. (2021) Figure B.6](https://doi.org/10.1051/0004-6361/202141781), measured by `tools/objects/published-comparison.mts`:

| Check | Result |
| --- | --- |
| Outline overlap with the paper's ADAM panels, at our phase | 0.957 to 0.979; over a full turn in 10° steps it peaks at our phase in three 2017 columns and 10° away in the fourth, by 0.004 |
| Outline overlap with the paper's photographs | 0.964 to 0.983 |
| Our outline against itself drawn at the paper's pixel scale | 0.985 to 0.988, what this measure gives one shape at these two pixel sizes |
| Projected spin axis on the sky | 23.3° to 23.5°; the figure's arrows 19.2° to 20.7° |
| Outline residual in the native frames after the centre fit | 0.843 px mean over 23 frames, smallest at our phase |

The axis difference is about the 3.0° between the release record's pole and the paper's Table A.1; that is not verified as its cause. Earlier, against Hanuš et al. (2019) Figure 2, the same cameras gave outline overlaps of 0.972 and 0.980 and put the authors' own crater identifications on one surface point to 6.1 km. The measurements are in [`evidence/published-comparison.json`](evidence/published-comparison.json) and the ledger entry `zimpol-published-comparison`; [the paper's panels beside ours](evidence/published-comparison.webp) and [the first frame of each epoch beside our render and limb](evidence/sphere-camera-comparison.webp) show them.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 23 | 9 | 6.83° | 1.98° | 6.54° | its other 23 frames | 0 of 23 | — | 23 of 23, 0.75° | — | ×1.02 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.6](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

The registration stage reports a conflict for this lens, and the lens ships on its published comparison instead, under the rule in the [surface-observations guide](../../../tools/objects/surface-observations/README.md#registration-stage). The outline test scores 9 of 23 frames, whose outlines are barely elongated enough to define an angle, and finds 6.5°. The same measure between the paper's own model and its images gives −9.3° to +13.4°, so it would reject the published fit too. The relief sweep places all 23 frames at 0.75°.

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 2151.6 m error; the authored stopping threshold is 2200 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1167.0 m and maximum 2456.1 m.

Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 99.5 km reference sphere, with a -40 to 40 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The survey's rotation record lists pole longitude first. An earlier cross-frame test read it latitude-first, 9.4° from the paper's pole, and its failure is preserved in the ledger. Read longitude-first, it matches Hanuš et al. (2019) Table 1 to 0.1°.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with relative frame levels matched between 0.86 and 1.51. It is not albedo or colour. The frames see Iris from about 64° south, so the northern surface is unphotographed and keeps the grid. The native outlines fix the rotational phase to about a degree; the paper states no phase uncertainty.

The crater coordinates in Hanuš et al. (2019) Table 2 are not used. Projected as printed, they land a median 139 km from the authors' own contours in their Figure 4, and no rotation or mirror of the table fits all six named craters. Their longitude system is not stated.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Alternative released mesh](https://observations.lam.fr/astero/3Dshape/7_Iris_adam.obj): radius 102.477112 km. The ADAM model is an alternative reconstruction of the same shape. Excluded as a second lens. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.

- [Released SPHERE images](https://observations.lam.fr/astero/Data/7Iris/): individual, illuminated, resolved telescope images. Excluded as a globe texture in this PR: they are not a registered global reflectance mosaic. They remain the observational constraints behind the selected reconstruction.

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
