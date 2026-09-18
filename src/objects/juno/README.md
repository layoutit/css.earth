# Juno

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/3_Juno_mpcd.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [30 deconvolved ZIMPOL frames](https://observations.lam.fr/astero/Data/3Juno/Deconv/) |

Juno is an irregular main-belt asteroid with broad departures from an ellipsoid. This model combines light-curve constraints with resolved VLT/SPHERE observations.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 and Table A.1: volume-equivalent diameter 254 km, ecliptic J2000 pole (105°, 18°), sidereal period 7.209531 h. The original article is pinned and restorable.

- [Original MPCD mesh](https://observations.lam.fr/astero/3Dshape/3_Juno_mpcd.obj): 13506 vertices, 27008 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 126.115500 km. The survey's diameter averages ADAM and MPCD; the original coordinates are not rescaled to that average. Maximum Cartesian extents are 288.220 × 273.645 × 245.762 km; these are not best-fit ellipsoid axes.

## Evidence

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Source and output are each one closed component with Euler characteristic 2. Meshoptimizer estimates 2298.1 m error; the authored stopping threshold is 2400 m. This estimate is not a Hausdorff bound. Independent nearest-triangle sampling (8192 area-stratified samples each way) measured p95 1208.7 m and maximum 3217.3 m.

Full source face-centroid checks and 8192 sphere directions found no repeated radial intersection; this supports the radial-height lens, with the sampling limits stated. Reduction softens small features.

### The photograph

Each frame's camera is computed, never authored: the pinned rotation record gives the pole and the absolute rotational phase, pinned JPL Horizons tables give the Paranal sighting and the direction to the Sun at the exposure midpoint, each frame's own header gives its plate scale and exposure, and the disc centre is fitted to the limb of the lens mesh. Every camera field in the recipe is reproduced by `node tools/objects/observer-cameras.mts juno`, which refuses a recipe that has drifted from those inputs. The rotation record is read latitude-first: its second column, 103.7377°, cannot be a latitude, and its period, 7.20953041 h, matches the 7.209531 h of the survey table above.

The lens rides the released MPCD shape this body already selects, not the release's ADAM reconstruction. The 30 deconvolved ZIMPOL frames, camera 1, were taken over three nights, 2018-11-08 to 2018-11-12, all through the N_R filter at 25.65 s.

The projected disc spans about 102 px and the nadir pixel footprint is 2746 m, so the frames are better sampled than most bodies in this release. That is sampling, not resolved terrain: what the lens carries is real brightness on a measured shape.

The frames cover 72.7% of the retained surface area, transferred to 5,884,773 interior texels. Level matching reconciles their relative brightness within gains of 0.67 to 1.03 across all 30 frames, leaving at most a factor of 1.21 between overlapping frames. Display is the 1st to 99.5th percentile of the displayed samples, in relative deconvolved intensity with the photographed illumination retained.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 5 | 3.00° | 2.03° | 2.21° | its other 30 frames | 0 of 30 | — | 20 of 30, 3.75° | — | ×1.21 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

The outline is what places this body, and it does so on five frames out of thirty. Those five run from 02:05:02 to 02:07:18 on 2018-11-11, a single window of two and a quarter minutes, with outlines elongated between 1.294 and 1.300; their predicted limb position angles match the photographed contour with 2.21° left after removing the 2.03° floor that exposures minutes apart set. The other 25 are round: several sit at elongation 1.1923 to 1.1930 against the 1.2 minimum, missing the gate by under a thousandth. Five frames in one window sample one rotational phase, not five independent looks, so the longitude this lens is pinned at rests on a narrower check than the frame count suggests.

Neither sweep that depends on surface markings places it. The cross-frame test is decisive on 0 of 30 frames: these frames carry no markings it can register. The relief sweep is decisive on 20 of 30, but its offsets run from 0.50° to 6.50°, 3.25° from their own median, so they disagree by more than the three-degree gate and reach no verdict; its 3.75° median is a location rather than a measurement.

Before preparation, the same limb rule driven from the pinned inputs read 2.485° over a 2.151° floor. The stage's own number, above, is 2.21° over 2.03°. Both sit inside the gate, and the difference is the expected divergence between the two routes.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 127 km reference sphere, with a -40 to 40 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Original ADAM comparison](https://observations.lam.fr/astero/3Dshape/3_Juno_adam.obj): radius 127.337488 km. Excluded as a second lens: it is an alternative reconstruction of the same shape. The selected MPCD refinement uses resolved SPHERE detail; see survey section 3 and Appendix B.

- [Released SPHERE images](https://observations.lam.fr/astero/Data/3Juno/): individual, illuminated, resolved telescope images. Excluded as a globe texture in this PR: they are not a registered global reflectance mosaic. They remain the observational constraints behind the selected reconstruction.

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

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°. The release's unlabeled parameter file is preserved as evidence and is not read as an IAU W model; one unlabelled value exceeds a valid latitude, so its column order must not be guessed.

Original JPL Horizons elements and independent vectors are pinned at JD 2461286.5 (2026-09-03). Heliocentric ICRF conics serve the existing fixed-date context, not long-term perturbation ephemerides. The independent vectors at ±30 days have measured regression guards in the astronomy package.

TDB is approximated as TT within 2 ms.

</details>

<a id="reproduction"></a>

<details>
<summary>Reproduction</summary>

Source pins live in [source/manifest.json](source/manifest.json); source/preparation/acquisition.json restores the ignored OBJ, original article and Inter font. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated/verified by the existing radial snapshot recipe.  Title provenance remains in its source directory.

</details>
