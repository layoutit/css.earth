# Pandora

## Sources

- **Monochrome** uses 10 original Cassini ISS NAC clear-filter images, calibrated by the PDS Ring-Moon Systems Node with CISSCAL 4.0beta into linear I/F. Their observation IDs and camera geometry are authored in [source/preparation/terrestrial.json](source/preparation/terrestrial.json); each geometry row comes from Table 1 of the [PDS Pandora model documentation](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/pandora_document.pdf).
- **False color** adds three original Cassini ISS NAC filter observations displayed as RGB (IR3 / GRN / UV3), calibrated by CISSCAL 4.0beta into linear I/F. Each frame uses its own measured camera row in the same document, registered to the matching original plate model.
- **Elevation** comes from the [Thomas, Joseph and Ansty (2018) PDS shape release](https://doi.org/10.26033/ewy3-jy61), shown as radial height above an explicitly chosen 40.6 km reference sphere.

[NASA's Pandora overview](https://science.nasa.gov/saturn/moons/pandora/) supplies editorial context. Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

## Evidence

In false color the footprint covers part of the large crater and adjacent terrain; the reverse side and other missing intersections stay gray. The [shared color method](../../../docs/color-preparation.md) explains the display and its limits.

Across 4,096 approximately uniform radial rays, the simplified model differs from the original by 188 m on average, 445 m at the 95th percentile and 949 m at the largest sampled point. These are sampled radial differences, not an exhaustive geometric bound or the source measurement uncertainty.

An additional color-sequence fit failed its independent maximum-residual criterion, and no imagery from it is added. The [investigation ledger](investigations.json) records the decision and reopening condition.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 10 | 2 | 15.30° | — | — | its other 10 frames | 10 of 10 | 0.00° | 4 of 10, -2.75° | — | ×1.19, 2 unjoined groups | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **False color:** Three filters were acquired sequentially, and are not a simultaneous true-color photograph or a composition map. Source shadows and phase-dependent brightness remain. The common footprint is smaller than Monochrome coverage; gray grid marks gaps. Small color fringes can remain at sharp relief because the shape and camera solutions have finite accuracy.
- **Monochrome:** It is an approximate reflectance presentation, not recovered albedo: the authored weight is 0.5, gain is at most 2.5, and samples beyond 80° incidence or 78° emission are withheld. Missing areas and cast-shadow exclusions retain the shared gray coverage grid; no terrain is copied into them.
- **Elevation:** This includes the moon's elongated shape; it is not height above an equipotential/geoid. The documented model uncertainty is 0.2–0.3 km; the trailing side and south polar region are least constrained. Small crater morphology is not reliably encoded.
- **Orientation:** Small optical librations and dynamical phase errors are not represented.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## False color preparation

<details>
<summary>Source products, processing and qualification</summary>

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | IR3 | n1860790942 | 2016-12-18T21:15:05.265 | 209 |
| green | GRN | n1860790985 | 2016-12-18T21:15:48.685 | 205 |
| blue | UV3 | n1860790909 | 2016-12-18T21:14:31.562 | 212 |

The [recipe](source/preparation/terrestrial.json) records the detector centres, observer and solar longitudes and focal scale. Camera rays and occlusion are evaluated on the original shape.

Only common, visible three-filter samples are colored. The maximum incidence and emission angles are 75°; detector coverage is inset by two source pixels. The edge-connected 0.003 I/F background exclusion retains interior dark patches; it is an approximate coverage mask, not a detector-quality flag.

One common range, 0–0.8 I/F, maps the floating-point samples to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). No per-band brightness equalization, clear-filter sharpening or single-band photometric model changes their ratios.

</details>

## Methods and source notes

<details>
<summary>Monochrome, shape and orientation</summary>

<a id="pandora-source-and-presentation"></a>

The Monochrome images cover different sides and have varying resolution and illumination. The source pixel scale is approximately 134–609 m near the body center; more grazing areas are coarser. The 2048 × 1024 preparation raster does not imply uniformly resolved imagery.

The camera projection intersects the original PDS shape using each observation's range, center sample/line, projected north and observer/Sun directions. The focal length and pixel pitch come from the [Cassini ISS instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti): 2003.44 mm and 12 µm. The PDF longitudes are positive west; the rendered mesh and map use positive east.

A bounded Lunar-Lambert display normalization reduces photographed disk shading. Per-frame levels are fitted from overlaps that both frames see within 70° of incidence and emission; the widest gain, 5.16, belongs to N1860792666_1 at 109° phase, where Lunar-Lambert normalization leaves the phase function to the level.

Cassini frame `N1860792100_1` is not used: its published camera places 99.9% of the lit source shape on the photograph's sky while the photographed body lies elsewhere in the frame, so preparation refuses it. No camera correction is invented.

The released plate connectivity is simplified with meshoptimizer to 344 native PolyCSS triangle leaves. The simplified surface is closed with Euler characteristic two. The model's documented Archinal et al. (2011) pole and linear prime-meridian rotation are used at the shared fixed display epoch.

</details>
