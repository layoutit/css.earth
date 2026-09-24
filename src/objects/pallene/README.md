# Pallene

## Sources

Pallene has one **Monochrome** view. The selected [PDS Cassini image N1496910582](https://opus.pds-rings.seti.org/opus/#/detail=co-iss-n1496910582) was taken on 2005-06-08 at 08:02:15.536 UTC (mid exposure), through the clear filters at 454.56 m/native pixel, 75,862.43 km range and 21.126° phase. Its roughly 8 × 12 pixel resolved disc supports a coarse brightness patch. No fine terrain or hidden hemisphere is reconstructed. The other regions use the shared neutral coverage grid. Flood and Shadows remain independent shared controls.

[Thomas et al. (2013)](https://doi.org/10.1016/j.icarus.2013.07.022) and the actual pinned [NAIF PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), `BODY633_RADII`, give semi-axes 2.88 × 2.08 × 1.80 km. The earlier [LPSC 2013 abstract](https://www.lpi.usra.edu/meetings/lpsc2013/pdf/1598.pdf) uses 1.84 km for the short axis; the published/PCK value is selected. Mean reference radius is 2.23 km. This reference value is distinct from the exact volume-equivalent radius of the analytic ellipsoid.

## Evidence

Detector translation is measured from the original image, independently of the north angle, fixed axes, range and plate scale. A least-squares fit of the illuminated ellipsoid limb/terminator gives zero-based center [510.40754617, 511.81032051], RMS 0.498 native pixel at I/F 0.12. Varying the boundary threshold from 0.08 to 0.20 changes the center by under 0.22 pixel and gives RMS 0.37–0.78 pixel. This is a pointing refinement, not an adjustment of the moon's shape. OPUS coordinates projected through the later kernel set do not reproduce the detector center; those predictions are retained in the receipt and are not used as pointing. The small body-frame/pointing discrepancy is part of the registration uncertainty; no exact spacecraft-navigation solution is claimed.

The 2026-09-10 follow-up checked the pinned 1024 × 1024 calibrated source directly. At I/F 0.08–0.20 its illuminated disc is only 8 × 13 pixels, and the source crop contains no independently identifiable surface feature to fit. The result is recorded in [registration-attempt-2026-09-10.json](source/survey/registration-attempt-2026-09-10.json). The existing limb fit remains useful pointing evidence, but it cannot establish surface-feature registration to the ellipsoid; the photographic patch stays explicitly coarse and its limits are not upgraded.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/pallene/source.test.mts).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 1 | 1 | 18.00° | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

At the 512 × 256 preparation grid, 16,617 cells (12.68%) remain observed; these are resampled cells, not independent source pixels. The same interpretation feeds the surface atlas, thumbnail, minimap and context portrait. The context's full known silhouette remains present wherever imagery is absent.

The mission-era binary attitude is used for photographic registration. Runtime presentation freezes the BPC pole sampled at 2010-10-16T18:20:52.721 UTC (RA 40.82129048°, Dec 83.35802948°) with an explicitly arbitrary display meridian. It predicts no current spin phase. The shared Cassini-era 2005–2018 orbit fit has a maximum 27.65 km residual across six independent epoch checks; its propagation to the 2026 application epoch is unqualified. The view is not current precision navigation.

This approximate local illumination normalization omits a phase function, multiple scattering and sub-resolution shape; it is not calibrated albedo recovery. The low phase limits the mismatch, and the coarse photograph supplies no resolved crater detail.

The finer 2010/2011 frame trials below were excluded for saturation, high phase or too little reliable coverage. Their limits were not relaxed to add pixels.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

<a id="pallene-sources-and-interpretation"></a>
<a id="measured-shape"></a>
<a id="observation-geometry-and-validity"></a>
<a id="dataset-survey"></a>
<a id="runtime-orientation-and-restoration"></a>

<details>
<summary>Methods and source notes</summary>

**Measured shape**

`shape/ellipsoid.tab` is a checked-in analytic realization of those dimensions, sampled every 5° with the exact formula in `measurements.json`; it is not a detailed measured mesh. The long, intermediate and polar axes are X, Y and Z. Longitude is east-positive `atan2(y,x)`; latitude is planetocentric. No topographic perturbation is added. The shared meshoptimizer path reduces 5,040 sampled triangles to 480 native PolyCSS `u` triangles (242 vertices), retaining a closed, outward-wound, single-component surface. Its 40 m simplifier allowance produced a 36.389 m library estimate; that estimate is neither an exhaustive error bound nor the measurement uncertainty of the moon. In 2,000 Fibonacci equal-area directions, prepared radii differ from the analytic measured ellipsoid by 22.062 m mean, 40.138 m at the 95th percentile and 62.894 m maximum sampled error, with no missing rays.

**Observation geometry and validity**

The original VICAR image is CISSCAL 4.0beta calibrated I/F. The attached header owns the raster offset: 8,192 bytes, after both the 4,096-byte header and binary telemetry record. The detached label's record-2 pointer is stale. Values are little-endian 32-bit floats. The original raw BYTE image and label are retained as independent saturation evidence: the resolved disc reaches DN228, below the DN255 clipping value.

OPUS supplies the planetocentric observer/Sun latitude, west-positive longitude, range and resolution. These are pinned in `survey/n1496910582-metadata.json`. They are mapped to the same IAU_PALLENE XYZ convention; west longitudes become negative east longitudes. Source north comes independently from archived NAIF `pallene_mst2013.bpc` (frame 633), reconstructed Cassini `05157_05162ra.bc`, `cas_rocks_v18.tf`, `cas_v43.tf`, `cas_iss_v10.ti`, `cas00172.tsc` and `naif0012.tls`. Evaluating `pxform('IAU_PALLENE','CASSINI_ISS_NAC',midTime)` gives north azimuth 269.776104884° clockwise from image up. ISS samples/lines increase in negative camera X/Y, as the instrument kernel documents. The complete body-to-camera matrix and numeric source geometry are pinned.

Preparation rejects connected sky at I/F ≤0.02, insets that source validity by one native pixel, requires incidence and emission ≤55°, and keeps a point only where qualifying pixels carry at least half of its bilinear weight. These controls preserve the reliable interior and exclude the limb/PSF and uncertain pointing boundary. The surface is normalized per observation using a Lommel–Seeliger term, `gain=(mu0+mu)/(2*mu0)`, with gain≤2. The display range is 0–0.492 I/F, the 99.5th percentile of displayed samples, shown linearly. No level multiplier is fitted (one selected image).

**Investigation record**

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

NASA display photographs remain context-only references with photographed illumination; the calibrated PDS product remains the selected surface source.

**Runtime orientation and restoration**

`source/manifest.json` pins inputs, original labels, geometry receipts and source documentation. The analytic radius table and small authored files are checked in. `source/preparation/acquisition.json` restores external images and kernels from exact URLs/hashes; the generated context portrait is pinned beside the inputs. Shared commands are `node tools/objects/dist/operations.js acquire pallene --verify-only` and `node tools/objects/dist/prepare-authored.js pallene --write`.  Runtime publication, fresh installation and Chrome/DPR qualification require separate results.

</details>
