# Sylvia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Sylvia is a main-belt asteroid observed in the ESO/VLT/SPHERE survey.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Shape | [LAM `87_Sylvia_mpcd.obj`](https://observations.lam.fr/astero/3Dshape/87_Sylvia_mpcd.obj), [Vernazza et al. 2021](https://doi.org/10.1051/0004-6361/202141781). SPHERE-constrained reconstruction; original kilometer coordinates retained. |
| Elevation | Radius minus 137 km, false color over −50 to +70 km; broad shape, not gravitational height. |
| Position | [Retained Sylvia vector](../romulus/source/orbit/sylvia-heliocentric.txt) at 3 September 2026 TT, shared with Romulus. |
| SPHERE photograph | [32 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 6 nights from 2018-10-15 to 2018-11-29](https://observations.lam.fr/astero/Data/87Sylvia/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/87_Sylvia_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/87_Sylvia_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.29](https://doi.org/10.1051/0004-6361/202141781) |

## Evidence

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 2404.6 m error; the authored stopping threshold is 2500 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1342.9 m and maximum 2452.8 m. Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

The [epoch record](../romulus/source/validation/epoch-state.json) binds the retained heliocentric state. Older ±30-day conic checks apply to the generic astronomy API, not the updated scene snapshot or Romulus orbit.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/sylvia/source.test.mts).

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.29](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-10-15 08:46:57 | 0.961 | 0.955 | 0.966 | 0° | -1°, -0.5° | 85.7° against 83.8° |
| 2018-10-15 09:00:40 | 0.953 | 0.959 | 0.962 | 0° | -2.5°, -0.5° | 85.7° against 83.8° |
| 2018-10-19 04:30:52 | 0.956 | 0.946 | 0.967 | 10° | -1°, 2° | 85.7° against 83.9° |
| 2018-11-12 06:11:12 | 0.963 | 0.958 | 0.965 | 10° | -1.5°, 0.5° | 86.0° against 84.1° |
| 2018-11-12 07:02:46 | 0.965 | 0.962 | 0.966 | 0° | -1.5°, 0° | 86.0° against 84.0° |
| 2018-11-25 04:40:40 | 0.967 | 0.961 | 0.968 | 0° | 0°, 0.5° | 86.2° against 84.2° |
| 2018-11-26 02:31:28 | 0.967 | 0.965 | 0.971 | 0° | -1°, 0° | 86.2° against 84.2° |
| 2018-11-29 04:41:40 | 0.963 | 0.957 | 0.969 | 0° | -2°, 0.5° | 86.2° against 84.3° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 32 native frames after the centre fit is 5.298 px at our phase; the lowest of a ±30° sweep is 5.212 px at 14°.
<!-- published-comparison:end -->


### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 32 | 32 | 4.41° | 3.35° | 2.86° | its other 32 frames | 1 of 32 | — | 5 of 32, 7.00° | — | ×7.94 | registered |

`zimpol` ships on its paper’s comparison, [Figure B.29](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase. The release’s unlabeled parameter file is read as a spin record by the photograph’s cameras, in the column order the survey’s pole supports; it is not read as an IAU W model.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Sylvia from 18° south, so surface the survey did not see keeps the missing-imagery grid. Left out by name: zimpol-20181112-061547. Its limb fit does not settle: after 8 full and 16 half steps the centre still moves 0.55 px, and a lens states only settled centres. The figure does not show it.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="sylvia-sources-and-preparation"></a>
<a id="selected-data"></a>
<a id="shape-elevation-and-lighting"></a>
<a id="frame-and-ephemeris"></a>
<a id="canonical-prepared-position"></a>
<a id="reproduction"></a>

<details>
<summary>Methods and source notes</summary>

**Shape, elevation and lighting**

The original connected surface is simplified with meshoptimizer 1.2.0, ErrorAbsolute and RegularizeLight, to 800 native PolyCSS u triangles. Each raster leaf is 128 × 128 px in a 2048 × 6400 atlas. Geometry and per-texel flood/directional lighting are prepared ahead of runtime. No radial substitute, runtime triangulation, fabricated texture or additional renderer is used.

**Frame and ephemeris**

Original JPL Horizons elements and independent vectors are pinned at JD 2461286.5 (2026-09-03). Heliocentric ICRF conics serve the existing fixed-date context, not long-term perturbation ephemerides. The independent vectors at ±30 days have measured regression guards in the astronomy package. TDB is approximated as TT within 2 ms.

**Reproduction**

Source pins live in source/manifest.json; source/preparation/acquisition.json restores the ignored OBJ. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe. Run the authored object preparer to rebuild the display, and the existing runtime setup command to install published assets without original source data. Title provenance remains in its source directory.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 274 km, ecliptic J2000 pole (75°, 64°), sidereal period 5.18364 h. The original article is pinned and restorable.
- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/87_Sylvia_mpcd.obj): 2898 vertices, 5792 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 135.612406 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 372.437 × 251.295 × 207.099 km; these are not best-fit ellipsoid axes.
- [Alternative released mesh](https://observations.lam.fr/astero/3Dshape/87_Sylvia_adam.obj): radius 136.946453 km. The SPHERE photograph rides it, because the release's rotation record describes this reconstruction; the Shape and Elevation views keep the MPCD refinement, which uses resolved SPHERE detail (survey section 3 and Appendix B).
- [Released SPHERE images](https://observations.lam.fr/astero/Data/87Sylvia/): individual, illuminated, resolved telescope images. The deconvolved camera-1 frames are the SPHERE photograph lens, placed by computed cameras and checked against the survey's Figure B.29; the reduced `Red/` products are not used. This is photographed illumination, not a registered global reflectance mosaic, and the frames remain the observational constraints behind the selected reconstruction.
- [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf): complementary interpretation and model/image comparisons.

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 137 km reference sphere, with a -50 to 70 km legend. This includes global shape, not height above a gravitational equipotential. Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

The prepared scene now uses the retained [Sylvia heliocentric vector](../romulus/source/orbit/sylvia-heliocentric.txt) at JD 2461286.5 TT, shared with Romulus. Its position, velocity and solar GM define the same conic in every prepared observer and the solar-system overview. The [validated epoch record](../romulus/source/validation/epoch-state.json) retains source identity and time-scale provenance. The original ±30-day conic fixtures above remain evidence for the generic propagated astronomy API, not an accuracy guarantee for Romulus's published orbit or the updated fixed-date snapshot.

</details>
