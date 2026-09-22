# Janus

## Sources

**False color** adds three original Cassini ISS NAC filter observations displayed as RGB (IR3 / GRN / UV3), calibrated by CISSCAL 4.0beta into linear I/F. This is false color. Each frame uses its own measured camera row in the [Thomas 2018 janus document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/janus_document.pdf), registered to the matching original plate model.

- **Monochrome:** 6 Cassini ISS narrow-angle, clear-filter frames calibrated to I/F by CISSCAL and distributed by the PDS Ring-Moon Systems Node.

- **Elevation:** radial height of the released shape above a 89.2 km reference sphere, with a shared shaded-relief palette.

- **Geometry:** Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models, [PDS release](https://sbn.psi.edu/pds/resource/saturnsatshapes.html), [DOI 10.26033/ewy3-jy61](https://doi.org/10.26033/ewy3-jy61).

## Evidence

The 2026-09-13 [color-encoding capture](evidence/filter-color/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/filter-color/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

**False color:** A dark, regional color footprint covers part of the cratered hemisphere; it does not extend the Monochrome footprint. The [browser record](evidence/filter-color/capture.json) pins the loaded image responses, camera, settings and inspected views at DPR 1 and 2. The existing Monochrome images, body leaves and picking triangles are unchanged; the selected false-color assets use the revised display encoding. Dragging, Shadows and the mobile selector passed without page errors or replaced scene DOM. Scientific qualification comes from the original camera/shape release and the registration evidence described here; these screenshots document the mounted result.

[False color](evidence/filter-color/color-dpr1.png) · [DPR 2](evidence/filter-color/color-dpr2.png) · [Oblique with Shadows](evidence/filter-color/oblique-shadows-dpr1.png) · [Mobile](evidence/filter-color/mobile.png). These captures were refreshed on 2026-09-13 after integrating main at `0636327ba`. The record pins the tested recipe, runtime, display transfer and loaded image bytes, and compares retained geometry with `8cc1a2fae`.

- The exact frames, archive URLs and byte pins are in [source/manifest.json](source/manifest.json). [source/preparation/terrestrial.json](source/preparation/terrestrial.json) retains each measured camera solution from the shape release's [source/shape/janus_document.pdf](source/shape/janus_document.pdf).

- Dimensions, floating-point encoding and record lengths are checked before reading.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 6 | 0 | — | — | — | its other 6 frames | 4 of 6 | -0.25° | 3 of 6, -2.75° | — | ×1.03, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

The existing Monochrome and Elevation shadow atlases changed slightly when rebuilt. A separate preparation of the unchanged main-branch recipe produces these new files byte for byte: this is prior prepared-output drift, not a color-lens effect. [Pinned comparison and reproduction](evidence/filter-color/shadow-reproduction.json). Unshaded maps and textures retain their previous bytes.

**False color:** Three filters were acquired sequentially, and are not a simultaneous true-color photograph or a composition map. Source shadows and phase-dependent brightness remain. The common footprint is smaller than Monochrome coverage; gray grid marks gaps. Small color fringes can remain at sharp relief because the shape and camera solutions have finite accuracy.

- **Elevation:** This is a shape-derived scientific visualization, not local altitude above a geoid or a high-resolution crater DEM.

- Model uncertainty: 0.3–1.3 km; the sub-Saturn region is least certain.

- Gray grid marks missing coverage. Regions have different source resolution and some visible seams remain; this is a visualization mosaic, not a new calibrated global albedo product.

- **Rotation:** Its secular IAU/PCK rotation terms provide an explicitly approximate fixed-epoch display orientation; periodic libration terms and the precise Cassini binary rotation kernel are omitted.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## False color preparation

<details>
<summary>Source products, processing and qualification</summary>

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | IR3 | n1627319215 | 2009-07-26T16:24:54.075 | 595 |
| green | GRN | n1627319647 | 2009-07-26T16:32:07.946 | 586 |
| blue | UV3 | n1627319759 | 2009-07-26T16:33:49.367 | 584 |

Original floating-point IMG products and detached labels are pinned in [the input manifest](source/manifest.json). All three products are unbinned FULL resolution, use lossless spacecraft compression and report zero missing lines. The [recipe](source/preparation/terrestrial.json) records the zero-based detector centres, west-positive observer and solar longitudes, and 2003.44 mm / 12 μm Cassini NAC focal scale. Camera rays and occlusion are evaluated on the original shape; the existing simplified display mesh is retained.

Only common, visible three-filter samples are colored. The maximum incidence and emission angles are 75° to avoid the most foreshortened limb and terminator; detector coverage is inset by two source pixels. The existing edge-connected 0.003 I/F background exclusion retains interior dark patches. This signal-based background rule is an approximate coverage mask, not a detector-quality flag.

The observed I/F samples remain floating point through registration and overlap composition. One common range, 0–0.8 I/F, maps them to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). Clipping and 8-bit quantization happen only at that final boundary. No per-band brightness equalization, clear-filter sharpening or single-band photometric model changes their ratios. No colorimetric transform has been applied; even visible-filter RGB is labelled false color. Prepared source illumination and the app's Shadows control remain separate.

</details>

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="janus-source-and-interpretation"></a>

## Selected presentation

- The large-scale irregular figure is included.

- The original plate topology is simplified before texture baking; the configured target is 720 native PolyCSS raster triangles, below the 2,000-leaf ceiling. The source coordinate system is kilometres, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north. Its tables use zero-based plate indices.

## Preparation

The generic source-shape camera preparer maps calibrated photographs using the measured perspective, source shape, west-positive subspacecraft/subsolar coordinates, image north azimuth and origin pixel. The NAC pixel scale uses 12 µm / 2003.44 mm from the [Cassini instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). No camera alignment is fitted by eye.

The attached VICAR header owns the calibrated raster offset. These products retain a binary telemetry record after the label, so the pixels begin at byte 8192; some detached PDS labels have a stale record-2 image pointer.

A bounded Lunar-Lambert disk correction reduces photographed illumination. Incidence/emission cutoffs and source-mesh shadow/visibility tests reject unstable or hidden samples. An edge-connected 0.003 I/F background threshold withholds sky without deleting isolated dark crater interiors. Robust overlap level matching fitted where both frames see the surface within 70° of incidence and emission (widest gain 1.71) reduces exposure changes. The display maps I/F 0–0.558, the 99.5th percentile of displayed samples, linearly to the available brightness range after correction; original calibrated source values remain unchanged. Photographic crater shadows that lack recoverable signal are not invented.

Flood mode retains the corrected observations under uniform illumination. The shared Shadows toggle selects a prepared normal-based directional bank on the same irregular mesh. A spherical lighting overlay is not fitted to this shape. Small dedicated minimaps and navigation images are prepared from the same interpreted surface; HD atlases are never used as minimap downloads.

## Orientation and navigation

The initial camera and navigation portrait look toward 216°E, 0°N, close to the best fully illuminated source viewpoint. This is presentation framing, separate from the source camera geometry.

The astronomy package already owns the moon's Saturn-relative orbital elements. The photograph projection independently uses the archived measured camera solution and does not depend on that display attitude. See `source/preparation/rotation.json` and the pinned NAIF `pck00011.tpc`.

## Dataset survey

- Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

- **Not added as duplicate lenses:** individual clear-filter photographs of the same terrain. They contribute to one Monochrome map.

Cassini frame `N1630068448_1` is not used. On the lit body its calibrated I/F has a median of 0.046 at 23° phase, a third or less of the 0.14–0.27 measured in the other six clear-filter frames at 39–90° phase, although a lower phase should look brighter. No level between frames reconciles it: with it, Monochrome showed a dark region with bright seams. The 7% of covered area it supplied now shows the missing-coverage grid.

- **Facts:** [NASA Janus](https://science.nasa.gov/saturn/moons/janus/) and [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/). No substantial atmosphere or cutaway is claimed.

## Preparation ownership

Source photos and scientific models are preparation inputs, not cold scene downloads. Credits and limitations remain with each dataset.

The initial camera uses the prepared ecliptic presentation basis and the radial mesh’s CSS X/Y transport to face the source portrait direction; geographic longitude/latitude are not copied into scene yaw/pitch.

</details>
