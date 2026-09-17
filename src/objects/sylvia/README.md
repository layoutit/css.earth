# Sylvia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Sylvia is a main-belt asteroid observed in the ESO/VLT/SPHERE survey.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Shape | [LAM `87_Sylvia_mpcd.obj`](https://observations.lam.fr/astero/3Dshape/87_Sylvia_mpcd.obj), [Vernazza et al. 2021](https://doi.org/10.1051/0004-6361/202141781). SPHERE-constrained reconstruction; original kilometer coordinates retained. |
| Elevation | Radius minus 137 km, false color over −50 to +70 km; broad shape, not gravitational height. |
| Position | [Retained Sylvia vector](../romulus/source/orbit/sylvia-heliocentric.txt) at 3 September 2026 TT, shared with Romulus. |

## Evidence

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 2404.6 m error; the authored stopping threshold is 2500 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1342.9 m and maximum 2452.8 m. Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

The [epoch record](../romulus/source/validation/epoch-state.json) binds the retained heliocentric state. Older ±30-day conic checks apply to the generic astronomy API, not the updated scene snapshot or Romulus orbit.

[Source test definitions](../../../tests/objects/unit/sylvia/source.test.mts).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 16 | 15 | 2.89° | 1.87° | 2.20° | its other 16 frames | 0 of 16 | — | 3 of 16, 1.50° | — | ×1.05 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`.
<!-- registration-report:end -->

## Known problems

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase. The release’s unlabeled parameter file is preserved as evidence and is not read as an IAU W model.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

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

Source pins live in source/manifest.json; source/preparation/acquisition.json restores the ignored OBJ, original article and Inter font. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe. Run the authored object preparer to rebuild the display, and the existing runtime setup command to install published assets without original source data. Title provenance remains in its source directory.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 274 km, ecliptic J2000 pole (75°, 64°), sidereal period 5.18364 h. The original article is pinned and restorable.
- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/87_Sylvia_mpcd.obj): 2898 vertices, 5792 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 135.612406 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 372.437 × 251.295 × 207.099 km; these are not best-fit ellipsoid axes.
- [Alternative released mesh](https://observations.lam.fr/astero/3Dshape/87_Sylvia_adam.obj): radius 136.946453 km. The ADAM model is an alternative reconstruction of the same shape. Excluded as a second lens. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.
- [Released SPHERE images](https://observations.lam.fr/astero/Data/87Sylvia/): individual, illuminated, resolved telescope images. Excluded as a globe texture in this package: they are not a registered global reflectance mosaic. They remain the observational constraints behind the selected reconstruction.
- [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf): complementary interpretation and model/image comparisons.

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 137 km reference sphere, with a -50 to 70 km legend. This includes global shape, not height above a gravitational equipotential. Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

The prepared scene now uses the retained [Sylvia heliocentric vector](../romulus/source/orbit/sylvia-heliocentric.txt) at JD 2461286.5 TT, shared with Romulus. Its position, velocity and solar GM define the same conic in every prepared observer and the solar-system overview. The [validated epoch record](../romulus/source/validation/epoch-state.json) retains source identity and time-scale provenance. The original ±30-day conic fixtures above remain evidence for the generic propagated astronomy API, not an accuracy guarantee for Romulus's published orbit or the updated fixed-date snapshot.

</details>
