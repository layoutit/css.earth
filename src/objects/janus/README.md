# Janus

Saturn's moon Janus on the Thomas 2018 shape model, with a Cassini monochrome mosaic, a three-filter false-color view
and an elevation map.

## Sources

- **Monochrome:** 6 Cassini ISS narrow-angle, clear-filter frames calibrated to I/F by CISSCAL and distributed by the
  PDS Ring-Moon Systems Node.
- **False color:** three original Cassini ISS NAC filter observations displayed as RGB (IR3 / GRN / UV3), calibrated by
  CISSCAL 4.0beta into linear I/F. Each frame uses its own measured camera row in the
  [Thomas 2018 janus document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/janus_document.pdf).
- **Elevation:** radial height of the released shape above a 89.2 km reference sphere, with a shared shaded-relief
  palette.
- **Geometry:** Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models,
  [PDS release](https://sbn.psi.edu/pds/resource/saturnsatshapes.html),
  [DOI 10.26033/ewy3-jy61](https://doi.org/10.26033/ewy3-jy61).
- **Facts:** [NASA Janus](https://science.nasa.gov/saturn/moons/janus/) and
  [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/). Orientation uses `source/preparation/rotation.json`
  and the pinned NAIF `pck00011.tpc`.

The exact frames and archive URLs are in [source/manifest.json](source/manifest.json).
[source/preparation/terrestrial.json](source/preparation/terrestrial.json) keeps each measured camera solution. Every
examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

## Processing

The shape is simplified to 720 native PolyCSS triangles before texture baking. Photographs are mapped with each
frame's measured perspective, the source shape and the NAC pixel scale of 12 µm / 2003.44 mm from the
[Cassini instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). No camera alignment
is fitted by eye. The calibrated pixels begin at byte 8192, after a telemetry record; some detached PDS labels have a
stale image pointer.

**Monochrome.** A bounded Lunar-Lambert correction reduces photographed illumination. Angle cutoffs and source-mesh
shadow and visibility tests reject unstable or hidden samples. An edge-connected 0.003 I/F threshold withholds sky
without deleting dark crater interiors. Overlap level matching (widest gain 1.71) reduces exposure changes. The display
maps I/F 0–0.558, the 99.5th percentile, linearly. Photographic crater shadows without recoverable signal are not
invented.

Cassini frame `N1630068448_1` is not used. On the lit body its calibrated I/F has a median of 0.046 at 23° phase, a
third or less of the 0.14–0.27 measured in the other six clear-filter frames at 39–90° phase, although a lower phase
should look brighter. No level between frames reconciles it. The 7% of covered area it supplied now shows the
missing-coverage grid.

**False color.**

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | IR3 | n1627319215 | 2009-07-26T16:24:54.075 | 595 |
| green | GRN | n1627319647 | 2009-07-26T16:32:07.946 | 586 |
| blue | UV3 | n1627319759 | 2009-07-26T16:33:49.367 | 584 |

Only samples seen in all three filters are colored, with incidence and emission under 75° and a two-pixel detector
inset. One common range, 0–0.8 I/F, maps them to linear channels, followed by the
[shared IEC sRGB output transfer](../../../docs/color-preparation.md). There is no per-band equalization and no
colorimetric transform, so even the visible-filter channels are labelled false color.

The initial camera looks toward 216°E, 0°N, close to the best fully lit source viewpoint. This is presentation framing.

## Evidence

The false-color footprint is a dark region covering part of the cratered hemisphere. It was inspected in the browser at
DPR 1 and 2 with dragging, Shadows and the mobile selector, without page errors. The
[shared color method](../../../docs/color-preparation.md) explains the display and its limits.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 6 | 0 | — | — | — | its other 6 frames | 4 of 6 | -0.25° | 3 of 6, -2.75° | — | ×1.03, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **False color:** the three filters were taken in sequence, so this is not a simultaneous true-color photograph or a
  composition map. Source shadows and phase-dependent brightness remain. The common footprint is smaller than the
  Monochrome coverage. Small color fringes can remain at sharp relief. The 0.003 I/F background rule is an approximate
  coverage mask, not a detector-quality flag.
- **Monochrome:** regions have different source resolution and some seams remain. This is a visualization mosaic, not
  a calibrated global albedo product.
- **Elevation:** a shape-derived visualization, not altitude above a geoid or a high-resolution crater DEM.
- Model uncertainty is 0.3–1.3 km; the sub-Saturn region is least certain.
- **Rotation:** the secular IAU/PCK terms give an approximate fixed-epoch orientation; libration and the precise Cassini
  rotation kernel are omitted.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
