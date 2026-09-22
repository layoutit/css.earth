# Adeona

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-data"></a>

| Input | Selected source |
| --- | --- |
| Shape | [Released reconstruction](https://observations.lam.fr/astero/3Dshape/145_Adeona_adam.obj) |
| Size and pole | [Vernazza et al. (2021), Tables 1 and A.1](https://doi.org/10.1051/0004-6361/202141781) |
| SPHERE photograph | [15 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 3 nights from 2017-12-31 to 2018-01-07](https://observations.lam.fr/astero/Data/145Adeona/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/145_Adeona_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/145_Adeona_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.34](https://doi.org/10.1051/0004-6361/202141781) |

Adeona is a dark, carbonaceous main-belt asteroid observed in the ESO/VLT/SPHERE survey. Its published reconstruction combines resolved telescope images with light curves.

- [Vernazza et al. (2021), final VLT/SPHERE survey](https://doi.org/10.1051/0004-6361/202141781), Table 1 ([as CDS distributes it](https://cdsarc.cds.unistra.fr/ftp/J/A+A/654/A56/table1.dat)) and Table A.1: volume-equivalent diameter 144 ± 3 km, mass (2.4 ± 0.3) × 10^18 kg, ecliptic J2000 pole (101°, 48°), sidereal period 15.07081 h. The original article is pinned and restorable.

- [Original ADAM mesh](https://observations.lam.fr/astero/3Dshape/145_Adeona_adam.obj): 578 vertices, 1152 triangles, unmodified Cartesian coordinates in kilometers. Its measured volume-equivalent radius is 72.164637 km. The survey released no MPCD reconstruction for this body, and its Figure B.34 has no MPCD row. Maximum Cartesian extents are 156.375 × 151.436 × 152.932 km; these are not best-fit ellipsoid axes.

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.34](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-12-31 06:45:40 | 0.964 | 0.964 | 0.970 | 0° | -1.5°, -3° | 86.3° against 84.1° |
| 2018-01-01 05:19:37 | 0.962 | 0.947 | 0.966 | 0° | 1.5°, 2.5° | 86.4° against 84.7° |
| 2018-01-07 06:16:39 | 0.961 | 0.960 | 0.964 | 0° | 1.5°, 3° | 87.1° against 85.3° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 15 native frames after the centre fit is 1.470 px at our phase; the lowest of a ±30° sweep is 1.154 px at -20°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 15 | 0 | — | — | — | its other 15 frames | 0 of 15 | — | 11 of 15, -4.75° | — | ×1.02 | no verdict |

`zimpol` ships on its paper’s comparison, [Figure B.34](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The released mesh is one closed component with Euler characteristic 2, measured on the release file. Its radii run from 62.69 to 85.63 km.

## Known problems

Shape uses the shared neutral-gray material. It is not photographed color, reflectance, regolith or inferred composition. Elevation samples the original mesh radius minus a 72 km reference sphere, with a -15 to 15 km legend. This includes global shape, not height above a gravitational equipotential.

Source constraints are uneven and ground-based; a 4096 × 2048 display map does not add observational resolution. The existing scientific preparer samples 721 × 361 source directions and applies its recorded cartographic hillshade. Both views retain the shared Shadows control and flood lighting.

Rotation has an explicitly arbitrary display meridian, not an absolute rotational phase.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Adeona from 52° to 53° south, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected data</summary>

- [Released SPHERE images](https://observations.lam.fr/astero/Data/145Adeona/): individual, illuminated, resolved telescope images. The deconvolved camera-1 frames are the SPHERE photograph lens; the reduced products are not used. They remain the observational constraints behind the selected reconstruction.

- [Individual research](https://observations.lam.fr/astero/Papers/Vernazza2021.pdf): complementary interpretation and model/image comparisons.

</details>

<a id="frame-and-ephemeris"></a>

<details>
<summary>Frame and ephemeris</summary>

The original Cartesian frame is retained with +Z north and east-positive longitude. The published ecliptic pole is converted to equatorial J2000 with obliquity 23.439291111°.

Original JPL Horizons elements and independent vectors are pinned at JD 2461286.5 (2026-09-03). Heliocentric ICRF conics serve the existing fixed-date context, not long-term perturbation ephemerides. The independent vectors at ±30 days have measured regression guards in the astronomy package.

TDB is approximated as TT within 2 ms.

</details>

<a id="reproduction"></a>

<details>
<summary>Reproduction</summary>

Source pins live in [source/manifest.json](source/manifest.json); source/preparation/acquisition.json restores the ignored OBJ, original article and Inter font. LAM's ordinary public-site cookie is explicitly recorded. Generated context.png is force-tracked as a pinned intermediate and regenerated and verified by the existing radial snapshot recipe. Title provenance remains in its source directory.

</details>
