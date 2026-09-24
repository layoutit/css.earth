# Themis

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/24_Themis_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 5 nights from 2018-12-27 to 2019-01-17](https://observations.lam.fr/astero/Data/24Themis/Deconv/) on the released reconstruction the Shape view uses |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/24_Themis_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.19](https://doi.org/10.1051/0004-6361/202141781) |

Themis is a main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with an ADAM starting shape.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 208 km, ecliptic J2000 pole (146°, 73°), sidereal period 8.374187 h. The original article is pinned and restorable.

- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/24_Themis_mpcd.obj): 2978 vertices, 5952 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 103.803127 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 225.305 × 231.158 × 177.716 km; these are not best-fit ellipsoid axes.

- [Deconvolved ZIMPOL frames](https://observations.lam.fr/astero/Data/24Themis/Deconv/): 30 camera-1 intensity frames over six nights, 2018-12-27 to 2019-01-17, each 256 × 256 px at 3.63 mas/px in the N_R filter with a 151.8 s exposure. Horizons puts the disc between 0.1469″ and 0.1516″ across those nights, so it spans 41 to 42 px. They are the survey's own deconvolutions; no radiometric calibration accompanies them.

- [Released parameter record](https://observations.lam.fr/astero/3Dshape/24_Themis_param.txt): pole latitude 73.2155°, pole longitude 145.9511°, sidereal period 8.37419015 h, then phase epoch JD 2438904.0 and phase 0°. The survey's files do not agree on column order, so this one is read latitude-first on two independent grounds: 145.9511° cannot be a latitude, and both columns match the pole published for [DAMIT model 5916](https://damit.cuni.cz/projects/damit/asteroid_models/view/5916) (ecliptic longitude 146°, latitude 73°), whose phase epoch JD 2438904 and phase 0° are the record's own.

## Evidence

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 1715.9 m error; the authored stopping threshold is 1800 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 931.4 m and maximum 2449.6 m.

Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.19](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-12-27 06:43:58 | 0.960 | 0.958 | 0.966 | 0° | -3.5°, -0.5° | 109.5° against 107.6° |
| 2018-12-29 04:24:23 | 0.961 | 0.965 | 0.965 | 0° | -2°, 1.5° | 109.5° against 107.5° |
| 2019-01-09 05:14:59 | 0.961 | 0.964 | 0.966 | 10° | -2°, -2° | 109.2° against 107.2° |
| 2019-01-09 06:14:37 | 0.960 | 0.966 | 0.969 | 0° | -1.5°, 0° | 109.2° against 107.2° |
| 2019-01-13 06:07:03 | 0.957 | 0.961 | 0.965 | -10° | -4.5°, -2° | 109.1° against 107.1° |
| 2019-01-17 03:05:32 | 0.961 | 0.965 | 0.968 | -10° | -2°, -2.5° | 109.0° against 107.0° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.798 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

Each frame's camera is computed, never authored: the pinned rotation record gives the pole and the absolute rotational phase, pinned JPL Horizons tables give the Paranal sighting and the direction to the Sun at the exposure midpoint, each frame's own header gives its plate scale and exposure, and the disc centre is fitted to the limb of the lens mesh. Every camera field in the recipe is reproduced by `node tools/objects/observer-cameras.mts themis`, which refuses a recipe that has drifted from those inputs.

The frames cover 84.9% of the retained surface area. Level matching reconciles their relative brightness within gains of 0.91 to 2.74 across all 30 frames, joined as a single group, leaving at most a factor of 1.15 between overlapping frames. Display is the 1st to 99.5th percentile of the displayed samples, in relative deconvolved intensity with the photographed illumination retained.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 30 | 3.94° | 3.58° | 1.65° | its other 30 frames | 2 of 30 | — | 11 of 30, -8.25° | — | ×1.15 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.19](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

Of the registration stage's measurements, the outline is the one that reaches a verdict: all 30 frames project an outline elongated enough to define a position angle, between 1.227 and 1.328, and their predicted limb position angles match the photographed contour with 1.65° left after removing the 3.58° floor that exposures minutes apart set. The two sweeps that depend on surface markings do not place it and are not evidence either way: the cross-frame test finds only 2 of 30 frames decisive, and the relief sweep's 11 decisive frames disagree among themselves, from −9.5° to +9.5°, so their −8.25° median is a location rather than a measurement and reaches no verdict. That is what a nearly featureless C-type on a light-curve shape looks like to those tests.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 104 km reference sphere, with a -30 to 20 km legend. This includes global shape, not height above a gravitational equipotential.

The photograph carries no radiometric calibration, so its grayscale is relative deconvolved intensity with the photographed illumination left in, not measured albedo or colour; where frames overlap they are averaged, each fading out toward its disc edge; the grid marks surface that was unphotographed, too grazing or rejected. The survey released no ADAM reconstruction for this body, so the photograph rides the same MPCD mesh the Shape view uses rather than the separate reconstruction its rotation record was fitted alongside; the outline residual above is the measurement of how well that mesh and that record agree. Nothing registers the frames against surface markings: the two tests that would do so find nothing to lock onto here.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase. The photograph does not use it: that lens takes the absolute phase from the pinned parameter record, so where its frames land on the body is set by the record and not by the display meridian.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Alternative released mesh](https://observations.lam.fr/astero/3Dshape/24_Themis.obj): radius 104.072594 km. The release filename is unlabelled; no ADAM designation is inferred. Excluded as a second lens. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.

- [Released SPHERE images](https://observations.lam.fr/astero/Data/24Themis/): individual, illuminated, resolved telescope images. The deconvolved camera-1 frames are now cast onto the mesh as the SPHERE photograph lens, registered by its outline; the reduced `Red/` products are not used. This is photographed illumination, not a radiometrically calibrated global reflectance mosaic, and it remains the observational constraint behind the selected reconstruction.

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

Source pins live in [source/manifest.json](source/manifest.json); source/preparation/acquisition.json restores the ignored OBJ. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe.  Title provenance remains in its source directory.

</details>
