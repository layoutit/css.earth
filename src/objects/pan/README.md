# Pan

## Sources

**Monochrome** now combines eight calibrated Cassini frames: the five March 2017 close views, the earlier `N1530371111_1` and `N1524970213_1` views, and the additional 2017 `N1867600368_1` view. The added camera rows come from the same published Pan shape document and use the unchanged source and display meshes. Nominal added footprints are about 1.62 km, 1.32 km and 587 m per source pixel; these fill gaps rather than supply close-flyby detail.

**False color** adds three original Cassini ISS NAC filter observations displayed as RGB (IR1 / GRN / UV3), calibrated by CISSCAL 4.0beta into linear I/F. This is false color. Each frame uses its own measured camera row in the [Thomas 2018 pan document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/pan_document.pdf), registered to the matching original plate model.

The shared [source-backed color preparation](../../../docs/color-preparation.md)
keeps measured bands floating through sampling and composition. A common
0–0.8 I/F range maps them to linear display channels, followed by IEC sRGB
encoding and final 8-bit quantization. This replaces direct linear byte mapping;
it does not reconstruct natural color.

The surface uses the [Thomas, Joseph and Ansty Saturn small-moon shape release](https://doi.org/10.26033/ewy3-jy61), archived by the NASA PDS Small Bodies Node. The original `pan_30k_plt.tab` contains 13,736 vertices and 27,468 triangular plates in kilometers. Its companion XML and per-body PDF are retained. The source frame has +X toward Saturn, +Y opposite orbital motion and +Z along the positive rotation axis. The source describes likely radial uncertainties of 0.2–0.3 km, with portions of the leading side least certain; small crater morphology is not reliably resolved by the model.

The original **Monochrome** selection used five original Cassini ISS NAC calibrated I/F frames from March 7, 2017. They are restored from the [PDS Ring-Moon Systems Node](https://pds-rings.seti.org/cassini/iss/access.html) and retain the CISSCAL 4.0beta labels. Inputs: `N1867604669`, `N1867604117`, `N1867602962`, `N1867606181`, `N1867606742`.

**Elevation** colors radial distance minus a 14 km reference sphere, with a ±7 km scale and fixed relief lighting derived from that same shape. This includes the overall flattened body and equatorial ridge. It is not elevation above a measured geoid, nor a separate fine-resolution stereo DEM. No missing photographic coverage is filled with synthetic imagery.

## Evidence

The [package check](evidence/cassini-coverage/package-check.json) verifies source/output pins and exact retention of scene and sky geometry against `fc4dfc18e` (main including #187). The [cold installation](evidence/cassini-coverage/delivery.json) downloaded all 38 files for this body from immutable URLs into an empty destination; no source preparation was needed. Nine source-manifest and photographic-recipe tests passed. Shared ownership diagnostics are unchanged from main; this is not a full-suite pass.

[Browser previews](evidence/cassini-coverage/browser.json) show the expanded Monochrome surface and oblique boundaries at DPR 1 on the earlier `e70004dbc` application with the same moon assets. They expose the coarse coverage and brightness seams described below. They are preliminary: the local preview used a different cached M2-9 bank, explicitly recorded in the capture metadata. Current-main application review still requires the six new nebula banks introduced by #187; DPR 2 and responsive checks remain pending.

Monochrome coverage rises from **35.1% to 63.6%** of the fixed display mesh in the shared equal-area measurement. The [display measurement](evidence/cassini-coverage/display-measurement.json) records the sampled brightness range. The [preparation record](evidence/cassini-coverage/refresh.json) pins the recipe, source observations and retained scene. Coverage uses 64 deterministic area samples per display triangle; it is not an image-grid pixel percentage.

<details>
<summary>Earlier evidence, at its recorded revisions</summary>

The following records describe the earlier surfaces. They are retained as historical evidence; the current coverage expansion is measured above. Geometry evidence still applies because the retained scene is unchanged.

The 2026-09-13 [color-encoding capture](evidence/filter-color/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/filter-color/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

**False color:** The sunlit ridge and small southern patches carry color; most of the photographed underside remains unavailable after the illumination and common-coverage cuts. The [browser record](evidence/filter-color/capture.json) pins the loaded image responses, camera, settings and inspected views at DPR 1 and 2. The existing Monochrome images, body leaves and picking triangles are unchanged; the selected false-color assets use the revised display encoding. Dragging, Shadows and the mobile selector passed without page errors or replaced scene DOM. Scientific qualification comes from the original camera/shape release and the registration evidence described here; these screenshots document the mounted result.

[False color](evidence/filter-color/color-dpr1.png) · [DPR 2](evidence/filter-color/color-dpr2.png) · [Oblique with Shadows](evidence/filter-color/oblique-shadows-dpr1.png) · [Mobile](evidence/filter-color/mobile.png). These captures were refreshed on 2026-09-13 after integrating main at `0636327ba`. The record pins the tested recipe, runtime, display transfer and loaded image bytes, and compares retained geometry with `8cc1a2fae`.

Geometry is simplified from the source connectivity with the shared meshoptimizer preparer before texture baking. The prepared mesh has 800 native PolyCSS triangle leaves, within the 2,000-leaf ceiling, with a 200 m simplifier error setting. That setting is an algorithmic allowance, not a bound on source scientific uncertainty. No ellipsoid is substituted for the equatorial ridge. A 2,592-direction radial sample (5° grid offset from poles and seam) compared the prepared mesh with the source: mean error 62 m, 95th percentile 136 m, maximum sampled error 249 m. These samples are not an exhaustive maximum error bound.

</details>

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 8 | 1 | 7.00° | — | — | its other 8 frames | 0 of 8 | — | 5 of 8, -1.25° | — | ×1.14 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

**New coverage:** the older photographs are visibly coarser than the 2017 close-up and retain brightness seams near the ridge. Overlap matching requires a maximum fitted factor of 2.40; the authored budget is 2.5. The linear monochrome display starts at zero and ends at 0.967, the measured 99.5th-percentile level rounded to three decimals. These are display choices, not an absolute albedo calibration.

**False color:** Three filters were acquired sequentially, and are not a simultaneous true-color photograph or a composition map. Source shadows and phase-dependent brightness remain. The common footprint is smaller than Monochrome coverage; gray grid marks gaps. Small color fringes can remain at sharp relief because the shape and camera solutions have finite accuracy. This sequence covers part of the southern face and ridge; ring shadows and unobserved terrain remain gaps.

Lunar-Lambert normalization and level matching between overlapping frames reduce acquisition shading; they do not recover cast shadows or calibrated albedo. The edge-connected I/F≤0.003 sky mask can withhold very dark limb pixels. Unobserved regions remain a grid; source resolution varies.

The package's approximate fixed-epoch display rotation comes from the pinned [NAIF pck00011 coefficients](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), with the pole evaluated at the shared 2026 epoch. It is not the `pan_mst2018.bpc` libration solution used to control the shape. Image registration uses the source PDF's independent measured geometry, not the approximate display phase.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="pan-sources-and-presentation"></a>
<a id="selected-data"></a>
<a id="lenses"></a>
<a id="dataset-survey"></a>
<a id="orientation-content-and-credits"></a>

<details>
<summary>Methods and source notes</summary>

**Lenses**

Each image is projected onto the released shape using its own sub-spacecraft and subsolar coordinates, distance, projected north angle and measured image center from Table 1 of `pan_document.pdf`. Those tables use west-positive longitude; preparation converts to the mesh's east-positive coordinates. The pinned NAIF `cas_iss_v10.ti` gives a 2003.44 mm focal length and 12 micrometer pixels. The approximation uses the ideal perspective camera and neglects higher-order optical distortion.

The calibrated VICAR header controls binary raster addressing. The archived detached labels retain a stale image pointer and do not account for the binary header record; reading that pointer alone would shift the image by one row. The original files remain unchanged.

All lenses retain the generic Shadows control. The native triangle atlases contain source texture and prepared directional illumination tied to the body frame. Minimap and thumbnail images are prepared separately from the same interpreted data; the context image uses the actual shape silhouette and full-phase relief shading.

**Dataset survey**

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

**Orientation, content and credits**

Facts are sourced from [NASA's Pan overview](https://science.nasa.gov/saturn/moons/pan/) and the vendored astronomy package. The source mesh, image calibration, scientific-model uncertainty and display simplification are separate properties. Credits: Peter Thomas, Joe Joseph, Trey Ansty; NASA/JPL-Caltech/Space Science Institute; NASA PDS Small Bodies and Ring-Moon Systems Nodes.

The initial camera uses the prepared ecliptic presentation basis and the radial mesh’s CSS X/Y transport to face the source portrait direction; geographic longitude/latitude are not copied into scene yaw/pitch.

The shared preparation applies a bounded Lunar-Lambert display normalization using source geometry, then overlap level matching fitted where both frames see the surface within 70° of incidence and emission (widest current gain 2.40). This reduces broad acquisition shading; it does not reconstruct cast-shadow interiors or become a calibrated albedo map. Samples beyond the accepted incidence/emission angles, bounded gain or available image footprint are withheld. The frame-edge-connected sky mask uses I/F ≤ 0.003, retaining disconnected dark crater floors; this boundary heuristic may withhold very dark limb pixels. Unobserved regions receive the shared neutral grid. Where views overlap, each point keeps the finest-resolution photograph; lower-resolution frames remain lower-resolution.

</details>
