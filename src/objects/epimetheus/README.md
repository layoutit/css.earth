# Epimetheus

## Sources

**Additional observations:** two clear-filter views (`N1864500586_1`, `N1649345705_1`) expand Monochrome. A second complete IR3/GRN/UV3 sequence (`N1828124265_1`, `N1828122367_1`, `N1828122742_1`), acquired on December 6, 2015, expands False color. Its nominal central footprints are about 160–225 m per pixel. The source shape, display mesh and band-to-RGB assignment are unchanged.

The original **False color** sequence uses three original Cassini ISS NAC filter observations displayed as RGB (IR3 / GRN / UV3), calibrated by CISSCAL 4.0beta into linear I/F. This is false color. Each frame uses its own measured camera row in the [Thomas 2018 epimetheus document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/epimetheus_document.pdf), registered to the matching original plate model.

- **Monochrome:** 7 Cassini ISS narrow-angle, clear-filter frames calibrated to I/F by CISSCAL and distributed by the PDS Ring-Moon Systems Node.

- **Elevation:** radial height of the released shape above a 58.2 km reference sphere, with a shared shaded-relief palette.

- **Geometry:** Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models, [PDS release](https://sbn.psi.edu/pds/resource/saturnsatshapes.html), [DOI 10.26033/ewy3-jy61](https://doi.org/10.26033/ewy3-jy61).

## Evidence

The [package check](evidence/cassini-coverage/package-check.json) verifies source/output pins and exact retention of scene and sky geometry against `fc4dfc18e` (main including #187). The [cold installation](evidence/cassini-coverage/delivery.json) downloaded all 38 files for this body from immutable URLs into an empty destination; no source preparation was needed. Nine source-manifest and photographic-recipe tests passed. Shared ownership diagnostics are unchanged from main; this is not a full-suite pass.

The [prepared False color map](evidence/cassini-coverage/filter-color-map.webp) was inspected for coverage boundaries and color discontinuities. It is a flat preparation diagnostic, not a browser capture or a native reference image. Browser review of both lighting states, DPR 1/2 and responsive layout remains pending while current main’s six nebula banks are unavailable locally.

Monochrome coverage rises from **64.1% to 69.2%**, and False color from **4.1% to 26.6%**, in the shared equal-area measurement on the fixed display mesh. The [preparation record](evidence/cassini-coverage/refresh.json) pins the recipe, source observations and retained scene. Coverage uses 64 deterministic area samples per display triangle; it is not an image-grid pixel percentage.

The [original filter fit](evidence/coverage-registration-fit.json) and [fixed-camera recheck](evidence/coverage-registration-check.json) retain independent feature controls. Both new filters pass held-out RMS ≤1 pixel and maximum ≤2 pixels against the new green reference. Reproduce with `node tools/objects/terrestrial-layers/align-camera-bands.mts src/objects/epimetheus/source/preparation/coverage-registration.json output/epimetheus-registration.json --check-only`. The portable seed job beside it reproduces the original fit. These relative checks do not reduce the published shape uncertainty or establish independent absolute geolocation.

<details>
<summary>Earlier evidence, at its recorded revisions</summary>

The following records describe the earlier surfaces. They are retained as historical evidence; the current coverage expansion is measured above. Geometry evidence still applies because the retained scene is unchanged.

The 2026-09-13 [color-encoding capture](evidence/filter-color/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/filter-color/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

**False color:** A small northern footprint resolves craters within the three-filter intersection. Most of the body has no common color coverage. The [browser record](evidence/filter-color/capture.json) pins the loaded image responses, camera, settings and inspected views at DPR 1 and 2. The existing Monochrome images, body leaves and picking triangles are unchanged; the selected false-color assets use the revised display encoding. Dragging, Shadows and the mobile selector passed without page errors or replaced scene DOM. Scientific qualification comes from the original camera/shape release and the registration evidence described here; these screenshots document the mounted result.

[False color](evidence/filter-color/color-dpr1.png) · [DPR 2](evidence/filter-color/color-dpr2.png) · [Oblique with Shadows](evidence/filter-color/oblique-shadows-dpr1.png) · [Mobile](evidence/filter-color/mobile.png). These captures were refreshed on 2026-09-13 after integrating main at `0636327ba`. The record pins the tested recipe, runtime, display transfer and loaded image bytes, and compares retained geometry with `8cc1a2fae`.

- The exact frames, archive URLs and byte pins are in [source/manifest.json](source/manifest.json). [source/preparation/terrestrial.json](source/preparation/terrestrial.json) retains each measured camera solution from the shape release's [source/shape/epimetheus_document.pdf](source/shape/epimetheus_document.pdf).

- Dimensions, floating-point encoding and record lengths are checked before reading.

</details>

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 7 | 0 | — | — | — | its other 7 frames | 0 of 7 | — | 3 of 7, 1.50° | — | ×1.02, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

**New color coverage:** the December 2015 sequence spans about 32 minutes, so each filter uses its own camera and only common surface coverage contributes. The filters are matched by measured interior features through the fixed source shape. This is IR3/GRN/UV3 false color; it does not show natural color or establish composition. A single overlap gain scales all three channels together.

The existing Monochrome and Elevation shadow atlases changed slightly when rebuilt. A separate preparation of the unchanged main-branch recipe produces these new files byte for byte: this is prior prepared-output drift, not a color-lens effect. [Pinned comparison and reproduction](evidence/filter-color/shadow-reproduction.json). Unshaded maps and textures retain their previous bytes.

**False color:** Three filters were acquired sequentially, and are not a simultaneous true-color photograph or a composition map. Source shadows and phase-dependent brightness remain. The common footprint is smaller than Monochrome coverage; gray grid marks gaps. Small color fringes can remain at sharp relief because the shape and camera solutions have finite accuracy. The close 2017 sequence covers a northern region; the 2015 sequence adds a broader equatorial footprint. Most of the moon still has no common color coverage.

- **Elevation:** This is a shape-derived scientific visualization, not local altitude above a geoid or a high-resolution crater DEM.

- Model uncertainty: see the per-region confidence discussion in the archived model document.

- Gray grid marks missing coverage. Regions have different source resolution and some visible seams remain; this is a visualization mosaic, not a new calibrated global albedo product.

- **Rotation:** Its secular IAU/PCK rotation terms provide an explicitly approximate fixed-epoch display orientation; periodic libration terms and the precise Cassini binary rotation kernel are omitted.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## False color preparation

<details>
<summary>Source products, processing and qualification</summary>

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | IR3 | n1866365919 | 2017-02-21T09:50:45.553 | 87 |
| green | GRN | n1866366139 | 2017-02-21T09:54:26.022 | 67 |
| blue | UV3 | n1866365809 | 2017-02-21T09:48:55.154 | 99 |

Original floating-point IMG products and detached labels are pinned in [the input manifest](source/manifest.json). The original three products are unbinned FULL resolution, use lossless spacecraft compression and report zero missing lines. The [recipe](source/preparation/terrestrial.json) records the zero-based detector centres, west-positive observer and solar longitudes, and 2003.44 mm / 12 μm Cassini NAC focal scale. Camera rays and occlusion are evaluated on the original shape; the existing simplified display mesh is retained.

Only common, visible three-filter samples are colored. The maximum incidence and emission angles are 75° to avoid the most foreshortened limb and terminator; the original sequence retains its two-pixel detector inset. The added sequence uses the shared measured footprint without an extra inset. The existing edge-connected 0.003 I/F background exclusion retains interior dark patches. This signal-based background rule is an approximate coverage mask, not a detector-quality flag.

The observed I/F samples remain floating point through registration and overlap composition. One common range, 0–0.8 I/F, maps them to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). Clipping and 8-bit quantization happen only at that final boundary. No per-band brightness equalization, clear-filter sharpening or single-band photometric model changes their ratios. No colorimetric transform has been applied; even visible-filter RGB is labelled false color. Prepared source illumination and the app's Shadows control remain separate.

</details>

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="epimetheus-source-and-interpretation"></a>

## Selected presentation

- The large-scale irregular figure is included.

- The original plate topology is simplified before texture baking; the configured target is 720 native PolyCSS raster triangles, below the 2,000-leaf ceiling. The source coordinate system is kilometres, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north. Its tables use zero-based plate indices.

## Preparation

The generic source-shape camera preparer maps calibrated photographs using the measured perspective, source shape, west-positive subspacecraft/subsolar coordinates, image north azimuth and origin pixel. The NAC pixel scale uses 12 µm / 2003.44 mm from the [Cassini instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). No camera alignment is fitted by eye.

The attached VICAR header owns the calibrated raster offset. These products retain a binary telemetry record after the label, so the pixels begin at byte 8192; some detached PDS labels have a stale record-2 image pointer.

A bounded Lunar-Lambert disk correction reduces photographed illumination. Incidence/emission cutoffs and source-mesh shadow/visibility tests reject unstable or hidden samples. An edge-connected 0.003 I/F background threshold withholds sky without deleting isolated dark crater interiors. Robust overlap level matching fitted where both frames see the surface within 70° of incidence and emission (widest gain 1.79) reduces exposure changes. The display maps I/F 0–0.387, the 99.5th percentile of displayed samples, linearly to the available brightness range after correction; original calibrated source values remain unchanged. Photographic crater shadows that lack recoverable signal are not invented.

Flood mode retains the corrected observations under uniform illumination. The shared Shadows toggle selects a prepared normal-based directional bank on the same irregular mesh. A spherical lighting overlay is not fitted to this shape. Small dedicated minimaps and navigation images are prepared from the same interpreted surface; HD atlases are never used as minimap downloads.

## Orientation and navigation

The initial camera and navigation portrait look toward 123°E, 4°N, close to the best fully illuminated source viewpoint. This is presentation framing, separate from the source camera geometry.

The astronomy package already owns the moon's Saturn-relative orbital elements. The photograph projection independently uses the archived measured camera solution and does not depend on that display attitude. See `source/preparation/rotation.json` and the pinned NAIF `pck00011.tpc`.

## Dataset survey

- Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

- **Not added as duplicate lenses:** individual clear-filter photographs of the same terrain. They contribute to one Monochrome map.

- **Facts:** [NASA Epimetheus](https://science.nasa.gov/saturn/moons/epimetheus/) and [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/). No substantial atmosphere or cutaway is claimed.

## Preparation ownership

Source photos and scientific models are preparation inputs, not cold scene downloads. Credits and limitations remain with each dataset.

The initial camera uses the prepared ecliptic presentation basis and the radial mesh’s CSS X/Y transport to face the source portrait direction; geographic longitude/latitude are not copied into scene yaw/pitch.

</details>
