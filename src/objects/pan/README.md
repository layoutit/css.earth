# Pan

Pan is shown on its released Cassini shape model, with its equatorial ridge, in three views: Monochrome photographs, False color and Elevation.

## Sources

The surface uses the [Thomas, Joseph and Ansty Saturn small-moon shape release](https://doi.org/10.26033/ewy3-jy61), archived by the NASA PDS Small Bodies Node. The original `pan_30k_plt.tab` contains 13,736 vertices and 27,468 triangular plates in kilometers. The source describes likely radial uncertainties of 0.2–0.3 km, with portions of the leading side least certain; small crater morphology is not reliably resolved by the model.

**Monochrome** combines eight calibrated Cassini ISS NAC frames restored from the [PDS Ring-Moon Systems Node](https://pds-rings.seti.org/cassini/iss/access.html): the five March 7, 2017 close views (`N1867604669`, `N1867604117`, `N1867602962`, `N1867606181`, `N1867606742`), and `N1530371111_1`, `N1524970213_1` and `N1867600368_1`. The added footprints are about 1.62 km, 1.32 km and 587 m per source pixel; they fill gaps rather than supply close-flyby detail.

**False color** adds three original Cassini ISS NAC filter observations displayed as RGB (IR1 / GRN / UV3), calibrated by CISSCAL 4.0beta into linear I/F. Each frame uses its own measured camera row in the [Thomas 2018 pan document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/pan_document.pdf).

Facts come from [NASA's Pan overview](https://science.nasa.gov/saturn/moons/pan/). Display rotation comes from the [NAIF pck00011 coefficients](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc). Credits: Peter Thomas, Joe Joseph, Trey Ansty; NASA/JPL-Caltech/Space Science Institute; NASA PDS Small Bodies and Ring-Moon Systems Nodes.

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

The shared meshoptimizer preparer simplifies the source to 800 triangles. No ellipsoid is substituted for the equatorial ridge.

Each image is projected onto the shape using its own sub-spacecraft and subsolar coordinates, distance, north angle and image center from Table 1 of `pan_document.pdf`, with the ideal perspective camera of NAIF `cas_iss_v10.ti`. The calibrated VICAR header controls raster addressing, because the detached labels carry a stale image pointer that would shift the image by one row.

A bounded Lunar-Lambert normalization and overlap level matching, within 70° of incidence and emission, reduce acquisition shading. Where views overlap, each point keeps the finest-resolution photograph. The frame-edge-connected sky mask uses I/F ≤ 0.003.

False color follows the shared [source-backed color preparation](../../../docs/color-preparation.md): a common 0–0.8 I/F range maps the bands to linear display channels, followed by IEC sRGB encoding. It does not reconstruct natural color.

**Elevation** colors radial distance minus a 14 km reference sphere, with a ±7 km scale and fixed relief lighting from the same shape. This includes the flattened body and ridge. It is not elevation above a measured geoid, nor a fine-resolution stereo DEM.

## Evidence

Monochrome covers **63.6%** of the fixed display mesh in the shared equal-area measurement, up from 35.1% with five frames. False color covers the sunlit ridge and small southern patches.

A 2,592-direction radial sample compared the prepared mesh with the source: mean error 62 m, 95th percentile 136 m, maximum sampled error 249 m. These samples are not an exhaustive maximum error bound.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 8 | 1 | 7.00° | — | — | its other 8 frames | 0 of 8 | — | 5 of 8, -1.25° | — | ×1.14 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The older photographs are visibly coarser than the 2017 close-up and retain brightness seams near the ridge. Overlap matching requires a maximum fitted factor of 2.40 against an authored budget of 2.5. The monochrome display ends at 0.967, the measured 99.5th-percentile level. These are display choices, not an absolute albedo calibration.
- The three color filters were acquired sequentially, so False color is not a simultaneous true-color photograph or a composition map. Its common footprint is smaller than Monochrome coverage; most of the photographed underside is unavailable. Small color fringes can remain at sharp relief.
- Normalization does not recover cast shadows or calibrated albedo. The sky mask can withhold very dark limb pixels. Unobserved regions remain a grid, and source resolution varies.
- The display rotation is approximate. It is not the `pan_mst2018.bpc` libration solution used to control the shape; image registration uses the source PDF's measured geometry instead.
