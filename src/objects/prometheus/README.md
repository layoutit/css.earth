# Prometheus

## Sources

**Additional False color coverage:** IR3 `N1643263159_1`, GRN `N1643263046_1` and UV3 `N1643263237_1`, acquired on January 27, 2010, add a second complete sequence near 226°W. Its nominal central footprint is about 222 m per pixel, compared with roughly 339 m per pixel in the earlier sequence. Published camera directions, ranges, focal scale and the source and display meshes are retained; detector translation and roll are checked against independent image features.

The original **False color** sequence uses three original Cassini ISS NAC filter observations displayed as RGB (IR3 / GRN / UV3), calibrated by CISSCAL 4.0beta into linear I/F. This is false color. Each frame uses its own measured camera row in the [Thomas 2018 prometheus document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/prometheus_document.pdf), registered to the matching original plate model.

- **Monochrome** uses 7 original Cassini ISS NAC clear-filter images, calibrated by the PDS Ring-Moon Systems Node with CISSCAL 4.0beta into linear I/F.

- **Elevation** comes from the same [Thomas, Joseph and Ansty (2018) PDS shape release](https://doi.org/10.26033/ewy3-jy61), shown as radial height above an explicitly chosen 43.1 km reference sphere.

## Evidence

The [package check](evidence/cassini-coverage/package-check.json) verifies source/output pins and exact retention of scene and sky geometry against `fc4dfc18e` (main including #187). The [cold installation](evidence/cassini-coverage/delivery.json) downloaded all 38 files for this body from immutable URLs into an empty destination; no source preparation was needed. Nine source-manifest and photographic-recipe tests passed. Shared ownership diagnostics are unchanged from main; this is not a full-suite pass.

The [prepared False color map](evidence/cassini-coverage/filter-color-map.webp) was inspected for coverage boundaries and color discontinuities. It is a flat preparation diagnostic, not a browser capture or a native reference image. Browser review of both lighting states, DPR 1/2 and responsive layout remains pending while current main’s six nebula banks are unavailable locally.

Accepted False color coverage rises from **30.3% to 38.1%** of the sampled physical surface area. The [preparation record](evidence/cassini-coverage/refresh.json) pins the recipe, source observations and retained scene. Coverage uses 64 deterministic area samples per display triangle; it is not an image-grid pixel percentage.

The [original filter fit](evidence/coverage-registration-fit.json) and [fixed-camera recheck](evidence/coverage-registration-check.json) retain independent feature controls. Both new filters pass held-out RMS ≤1 pixel and maximum ≤2 pixels against the new green reference. Reproduce with `node tools/objects/terrestrial-layers/align-camera-bands.mts src/objects/prometheus/source/preparation/coverage-registration.json output/prometheus-registration.json --check-only`. The portable seed job beside it reproduces the original fit. These relative checks do not reduce the published shape uncertainty or establish independent absolute geolocation.

<details>
<summary>Earlier evidence, at its recorded revisions</summary>

The following records describe the earlier surfaces. They are retained as historical evidence; the current coverage expansion is measured above. Geometry evidence still applies because the retained scene is unchanged.

The 2026-09-13 [color-encoding capture](evidence/filter-color/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/filter-color/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

**False color:** The colored face resolves the same cratered terrain through a different set of filters; small color fringes and uncovered margins remain. The [browser record](evidence/filter-color/capture.json) pins the loaded image responses, camera, settings and inspected views at DPR 1 and 2. The existing Monochrome images, body leaves and picking triangles are unchanged; the selected false-color assets use the revised display encoding. Dragging, Shadows and the mobile selector passed without page errors or replaced scene DOM. Scientific qualification comes from the original camera/shape release and the registration evidence described here; these screenshots document the mounted result.

[False color](evidence/filter-color/color-dpr1.png) · [DPR 2](evidence/filter-color/color-dpr2.png) · [Oblique with Shadows](evidence/filter-color/oblique-shadows-dpr1.png) · [Mobile](evidence/filter-color/mobile.png). These captures were refreshed on 2026-09-13 after integrating main at `0636327ba`. The record pins the tested recipe, runtime, display transfer and loaded image bytes, and compares retained geometry with `8cc1a2fae`.

- Their observation IDs and camera geometry are authored in [source/preparation/terrestrial.json](source/preparation/terrestrial.json); each geometry row comes from Table 1 of the [PDS Prometheus model documentation](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/prometheus_document.pdf).

- Across 4,096 approximately uniform radial rays, the simplified model differs from the original by 202 m on average, 517 m at the 95th percentile and 1572 m at the largest sampled point. These are sampled radial differences, not an exhaustive geometric bound or the source measurement uncertainty.

</details>

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 7 | 3 | 3.00° | — | — | its other 7 frames | 3 of 7 | -0.25° | 4 of 7, -6.75° | — | ×1.02, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

**New color coverage:** the two sequences have different viewing and illumination geometry and no accepted overlap for level matching. Their relative brightness therefore remains unmatched. A common band display range is retained; there is no per-channel white balance or inferred natural-color correction.

**False color:** Three filters were acquired sequentially, and are not a simultaneous true-color photograph or a composition map. Source shadows and phase-dependent brightness remain. The common footprint is smaller than Monochrome coverage; gray grid marks gaps. Small color fringes can remain at sharp relief because the shape and camera solutions have finite accuracy.

- **Monochrome:** It is an approximate reflectance presentation, not recovered albedo: the authored weight is 0.5, gain is at most 2.5, and samples beyond 80° incidence or 78° emission are withheld. Missing areas and cast-shadow exclusions retain the shared gray coverage grid; no terrain is copied into them.

- **Elevation:** This includes the moon’s elongated shape; it is not height above an equipotential/geoid. The documented model uncertainty is 0.2–0.4 km; parts of the leading side are least constrained. Small crater morphology is not reliably encoded.

- **Orientation:** Small optical librations and dynamical phase errors are not represented.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## False color preparation

<details>
<summary>Source products, processing and qualification</summary>

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | IR3 | n1640497881 | 2009-12-26T05:07:47.899 | 339 |
| green | GRN | n1640497816 | 2009-12-26T05:06:43.669 | 339 |
| blue | UV3 | n1640497927 | 2009-12-26T05:08:29.899 | 339 |

Original floating-point IMG products and detached labels are pinned in [the input manifest](source/manifest.json). The original three products are unbinned FULL resolution, use lossless spacecraft compression and report zero missing lines. The [recipe](source/preparation/terrestrial.json) records the zero-based detector centres, west-positive observer and solar longitudes, and 2003.44 mm / 12 μm Cassini NAC focal scale. Camera rays and occlusion are evaluated on the original shape; the existing simplified display mesh is retained.

Only common, visible three-filter samples are colored. The maximum incidence and emission angles are 75° to avoid the most foreshortened limb and terminator; the original sequence retains its two-pixel detector inset. The added sequence uses the shared measured footprint without an extra inset. The existing edge-connected 0.003 I/F background exclusion retains interior dark patches. This signal-based background rule is an approximate coverage mask, not a detector-quality flag.

The observed I/F samples remain floating point through registration and overlap composition. One common range, 0–0.8 I/F, maps them to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). Clipping and 8-bit quantization happen only at that final boundary. No per-band brightness equalization, clear-filter sharpening or single-band photometric model changes their ratios. No colorimetric transform has been applied; even visible-filter RGB is labelled false color. Prepared source illumination and the app's Shadows control remain separate.

</details>

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="prometheus-source-and-presentation"></a>

## Selected data

The original floating-point IMG products and their detached PDS labels are pinned in `source/manifest.json`. The images cover different sides and have varying resolution and illumination. The source pixel scale is approximately 196–474 m near the body center; more grazing areas are coarser. Preparation raster size is 2048 × 1024 and does not imply uniformly resolved imagery.

The shared camera projection intersects the original PDS shape and applies each observation’s range, center sample/line, projected north and observer/Sun directions. The camera focal length and pixel pitch come from the [Cassini ISS instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti): 2003.44 mm and 12 µm. The PDF longitudes are positive west; the rendered mesh and map use positive east. The source frame has +X toward Saturn, +Y opposite orbital motion and +Z north. VICAR `LBLSIZE + NLB × RECSIZE` owns the pixel-data offset; the detached labels omit the binary header record.

A bounded Lunar-Lambert display normalization reduces photographed disk shading. Per-frame levels are fitted from overlaps that both frames see within 70° of incidence and emission; the widest gain, 3.24, belongs to N1643261394_1 at 104° phase, where Lunar-Lambert normalization leaves the phase function to the level. An edge-connected threshold of 0.003 I/F rejects faint sky noise; isolated dark pixels within the body are retained. This conservative display mask does not classify every low signal as missing. Fine photographed relief and residual exposure differences may remain. The app’s directional Shadows setting remains independent of this source correction.

Fixed relief illumination makes model slopes readable. Palette bounds and the unshaded numeric legend are in the authored recipe.

## Shape, orientation and delivery

The released zero-indexed plate connectivity is retained before meshoptimizer simplification. The display uses 720 native PolyCSS triangle leaves, under the 2,000-leaf ceiling, with 128px raster cells. The simplified surface is closed, has consistent shared-edge winding and Euler characteristic two. None of these sampled source rays had an additional outward surface intersection. The model’s documented Archinal et al. (2011) pole and linear prime-meridian rotation are used at the shared fixed display epoch.

All lenses use the same prepared geometry and coverage interpretation. A dedicated 512px context image and small map previews are generated from that geometry and map; they do not fetch the source image archive. WebP quality 94 is the final atlas encoding, after lossless map preparation. No runtime source processing is performed.

## Source survey

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

[NASA’s Prometheus overview](https://science.nasa.gov/saturn/moons/prometheus/) supplies editorial context. JPL values in the vendored astronomy package supply the physical radius and orbit used by the shared application. Restore source bytes with the authored acquisition recipe, then run the shared object preparer; prepared runtime files are distributed through `inventory.json`.

The initial camera uses the prepared ecliptic presentation basis and the radial mesh’s CSS X/Y transport to face the source portrait direction; geographic longitude/latitude are not copied into scene yaw/pitch.

</details>
