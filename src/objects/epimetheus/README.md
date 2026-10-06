# Epimetheus

Epimetheus is shown on its released irregular shape with Cassini Monochrome photographs, a Cassini False color composite and an Elevation view.

## Sources

- **Monochrome:** 7 Cassini ISS narrow-angle, clear-filter frames calibrated to I/F by CISSCAL and distributed by the PDS Ring-Moon Systems Node.
- **False color:** two complete IR3/GRN/UV3 sequences from Cassini ISS NAC, calibrated by CISSCAL 4.0beta into linear I/F. The 2017 sequence is below. The second (`N1828124265_1`, `N1828122367_1`, `N1828122742_1`), acquired on December 6, 2015, has central footprints of about 160–225 m per pixel.
- **Elevation:** radial height of the released shape above a 58.2 km reference sphere, with a shared shaded-relief palette.
- **Geometry:** Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models, [PDS release](https://sbn.psi.edu/pds/resource/saturnsatshapes.html), [DOI 10.26033/ewy3-jy61](https://doi.org/10.26033/ewy3-jy61). Each frame uses its measured camera row in the [Thomas 2018 epimetheus document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/epimetheus_document.pdf).
- **Facts:** [NASA Epimetheus](https://science.nasa.gov/saturn/moons/epimetheus/) and [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/).

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | IR3 | n1866365919 | 2017-02-21T09:50:45.553 | 87 |
| green | GRN | n1866366139 | 2017-02-21T09:54:26.022 | 67 |
| blue | UV3 | n1866365809 | 2017-02-21T09:48:55.154 | 99 |

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

## Processing

The shape's plate topology is simplified to 440 PolyCSS raster triangles before texture baking. The source frame is in kilometres, +X approximately Saturn-facing, +Z north.

The shared source-shape camera preparer maps each calibrated photograph using the measured perspective, source shape and image geometry. The NAC pixel scale, 12 µm / 2003.44 mm, comes from the [Cassini instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). No camera alignment is fitted by eye. The [recipe](source/preparation/terrestrial.json) keeps each camera solution. Camera rays and occlusion are evaluated on the original shape.

For Monochrome, a bounded Lunar-Lambert disk correction reduces photographed illumination, and shadow and visibility tests reject hidden samples. An edge-connected 0.003 I/F background threshold withholds sky without deleting dark crater interiors. Overlap level matching (widest gain 1.79) reduces exposure changes. The display maps I/F 0–0.387, the 99.5th percentile, linearly to the brightness range.

For False color, only common, visible three-filter samples within 75° incidence and emission are colored. The two new filters are registered to the green reference by measured interior features: `node packages/bake/cli/align-camera-bands.mts src/objects/epimetheus/source/preparation/coverage-registration.json output/epimetheus-registration.json --check-only` reproduces the check. Values stay floating point until one common range, 0–0.8 I/F, maps them to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). No per-band equalization or colorimetric transform changes their ratios.

The shared Shadows toggle selects a prepared normal-based directional bank on the same irregular mesh. The opening view looks toward 123°E, 4°N, close to the best fully illuminated source viewpoint.

## Evidence

In the shared equal-area measurement on the display mesh, Monochrome covers **69.2%** and False color **26.6%**, using 64 area samples per triangle. Both new filters pass held-out RMS ≤1 pixel and maximum ≤2 pixels against the green reference. These relative checks do not reduce the published shape uncertainty or establish absolute geolocation.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 7 | 0 | — | — | — | its other 7 frames | 0 of 7 | — | 3 of 7, 1.50° | — | ×1.02, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **False color:** the three filters were acquired sequentially; the December 2015 sequence spans about 32 minutes, so each filter uses its own camera. This is IR3/GRN/UV3 false color, not natural color or a composition map. A single overlap gain scales all three channels together. Source shadows and phase-dependent brightness remain. Small color fringes can remain at sharp relief. Most of the moon still has no common color coverage.
- **Elevation:** This is a shape-derived visualization, not altitude above a geoid or a high-resolution crater DEM. Model uncertainty is discussed per region in the archived model document.
- Gray grid marks missing coverage. Regions have different source resolution and some visible seams remain; this is a visualization mosaic, not a calibrated global albedo product. The 0.003 I/F background rule is an approximate coverage mask, not a detector-quality flag.
- **Rotation:** Secular IAU/PCK terms give an approximate fixed-epoch display orientation; libration terms and the Cassini binary rotation kernel are omitted.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
