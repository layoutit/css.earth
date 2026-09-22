# 9 Metis

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/9_Metis_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 4 nights from 2018-06-08 to 2018-07-10](https://observations.lam.fr/astero/Data/9Metis/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/9_Metis_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/9_Metis_param), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.8](https://doi.org/10.1051/0004-6361/202141781) |

9 Metis is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 173 km, ecliptic J2000 pole (181°, 22°), sidereal period 5.079176 h. The original article is pinned and restorable.

- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/9_Metis_mpcd.obj): 2962 vertices, 5920 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 85.910665 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 212.146 × 190.170 × 137.418 km; these are not best-fit ellipsoid axes.

- [Deconvolved ZIMPOL frames](https://observations.lam.fr/astero/Data/9Metis/Deconv/): 30 camera-1 intensity frames over four nights, 2018-06-08 to 2018-07-10, each 256 × 256 px at 3.63 mas/px in the N_R filter with a 234.8 s exposure. Horizons puts the disc between 0.1520″ and 0.1580″ across those nights, so it spans 42 to 44 px. They are the survey's own deconvolutions; no radiometric calibration accompanies them.

- [Released parameter record](https://observations.lam.fr/astero/3Dshape/9_Metis_param): pole latitude 22.7124°, pole longitude 181.3819°, sidereal period 5.07917676 h, then phase epoch JD 2434419.0 and phase 0°. The survey's files do not agree on column order; this one is read latitude-first because 181.3819° cannot be a latitude. The release names this file without an extension.

## Evidence

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1603.8 m error; the authored stopping threshold is 1700 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 880.4 m and maximum 1824.4 m.

Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.8](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-06-08 06:44:46 | 0.959 | 0.952 | 0.966 | 0° | -2°, -0.5° | 24.0° against 22.0° |
| 2018-06-08 07:43:56 | 0.956 | 0.959 | 0.966 | 0° | -3°, -1° | 24.0° against 22.1° |
| 2018-06-12 04:13:13 | 0.959 | 0.961 | 0.967 | 0° | -1.5°, 0° | 24.5° against 22.5° |
| 2018-07-10 03:55:59 | 0.958 | 0.957 | 0.962 | -10° | -0.5°, -0.5° | 28.0° against 26.0° |
| 2018-06-17 03:05:19 | 0.963 | 0.955 | 0.964 | 0° | -2°, 2° | 25.1° against 23.2° |
| 2018-07-10 05:00:22 | 0.932 | 0.925 | 0.963 | 0° | -7.5°, -7.5° | 28.0° against 26.0° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.391 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 30 | 4.48° | 3.59° | 2.68° | its other 30 frames | 0 of 30 | — | 24 of 30, -2.75° | — | ×1.12 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.8](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 86.5 km reference sphere, with a -30 to 30 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase. The photograph does not use it: that lens takes the absolute phase from the pinned parameter record, so where its frames land on the body is set by the record and not by the display meridian.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Metis from 3° to 9° south, so surface the survey did not see keeps the missing-imagery grid. Nothing registers the frames against surface markings, because the two tests that would do so find nothing to lock onto here; the lens ships on the survey's own comparison figure, reproduced above, and the mesh, the rotation record and that figure all come from this same survey's images.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Alternative released mesh](https://observations.lam.fr/astero/3Dshape/9_Metis_adam.obj): radius 86.604374 km. The SPHERE photograph rides it, because the release's rotation record describes this reconstruction; the Shape and Elevation views keep the MPCD refinement, which uses resolved SPHERE detail (survey section 3 and Appendix B). An earlier version of the lens rode the MPCD, which the registration stage's limb rule put slightly closer to the record (2.30° against 2.72°); the lens now rides the model the record describes and is checked against the survey's Figure B.8.

- [Released SPHERE images](https://observations.lam.fr/astero/Data/9Metis/): individual, illuminated, resolved telescope images. The deconvolved camera-1 frames are cast onto the ADAM mesh as the SPHERE photograph lens, checked against the survey's Figure B.8; the reduced `Red/` products are not used. This is photographed illumination, not a radiometrically calibrated global reflectance mosaic, and it remains the observational constraint behind the selected reconstruction.

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

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. The release’s parameter file is read as a light-curve inversion spin record for the photograph's cameras, latitude-first, and not as an IAU W model; the display meridian stays arbitrary.

Original JPL Horizons elements and independent vectors are pinned at JD 2461286.5 (2026-09-03). Heliocentric ICRF conics serve the existing fixed-date context, not long-term perturbation ephemerides. The independent vectors at ±30 days have measured regression guards in the astronomy package.

TDB is approximated as TT within 2 ms.

</details>

<a id="reproduction"></a>

<details>
<summary>Reproduction</summary>

Source pins live in [source/manifest.json](source/manifest.json); source/preparation/acquisition.json restores the ignored OBJ, original article and Inter font. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe.  Title provenance remains in its source directory.

</details>
