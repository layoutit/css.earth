# Iapetus: independent numerical and detector-support review

This review covers only Nantes C/N pairs **1568129671_1** and **1568133146_2**. It verifies their released values and source-camera reconstruction. It does not qualify the subsequently selected wider cube 1568157352_4, absolute alignment to the ISS base mosaic, final mapped coverage, or the mounted result.

The two initial cubes contain useful, distinct bright/dark infrared signals. Their coordinates can be recovered from the archived camera tables. **Connecting adjacent image centers would invent coverage across large scan-line gaps**, especially in 1568129671_1. A source-detector support model is required before publishing a surface map.

The subsequent [detector-rasterizer review](rasterizer-review.md) covers all three Iapetus trial cubes and identifies a tested 1e−7 rad temporal inset. The [mixed-mode Tethys review](tethys-rasterizer-review.md) qualifies its separate, larger guard. These later reviews do not establish absolute ISS alignment.

## Reproducible evidence

- [validate-native.py](validate-native.py) independently reads little-endian float32 core values with `struct`, checks source hashes/labels, computes the selected index, and measures native center spacing. It does not import the product converter.
- [independent-native-validation.json](independent-native-validation.json) contains actual decoded values, byte offsets, full-source pins, all row-pair spacing summaries and explicit source anchors.
- [qualify-detector-footprints.py](qualify-detector-footprints.py) independently reconstructs source camera timing, cached rotations, observer position and ellipsoid ray intersections using the standard library. It imports only the sibling value reader.
- [detector-footprint-qualification.json](detector-footprint-qualification.json) records all 2,276 center comparisons, 12 explicit ray/corner anchors, finite-exposure pose diagnostics, and unresolved aperture assumptions.

Run these scripts with `PYTHONDONTWRITEBYTECODE=1` and an explicit `--native-dir` containing the four original C/N files. Their default input directory is the worktree's `output/b9-source-intake/iapetus/native`. The camera audit completed in approximately 0.8 seconds; no build, browser, NumPy processing, or runtime image generation was used.

### Complete source pins

The actual four-file total is **3,354,630 bytes**. These complete-file hashes supersede prefix-only hashes for full-product identity; the earlier intake remains a record of the metadata-only stage.

| File | Actual bytes | SHA-256 |
| --- | ---: | --- |
| C1568129671_1_ir.cub | 1,911,053 | `e7a4d85a4e30022e9a0af4de5ba06e799e0ee0f9ddb6e36c77068eb251a6b861` |
| N1568129671_1_ir.cub | 310,986 | `64a4d7636de33d6458ed95640d8f6cbb3ed8c943e8ddb23fa94e16097ac229fd` |
| C1568133146_2_ir.cub | 904,329 | `8c70f0c76666038d19a08efefbdc0a15f988a8b5bbd0bf69c6813b62248807a2` |
| N1568133146_2_ir.cub | 228,262 | `a7da80d17d7f17ae10bbc0e8340dcd779f71c760692a689b18edbfb9c43b904f` |

## Values and quantity

Both source labels give actual centers 1.28142, 1.59305, 1.82362, 2.02129 and 2.20310 µm at one-based IR bands 25, 44, 58, 70 and 81. RGB is 70/44/25. The fixed-channel, dimensionless water-ice absorption index is:

```text
Rc = (18181 × R58 + 19767 × R81) / 37948
D  = 1 − R70 / Rc
```

All five contributing planes contain finite positive values at all **1,600 + 676** source pixels. No selected sample has an ISIS NULL or saturation code. Negative index values remain measurements: cube 1568129671_1 contains two and they must not be silently clamped. The independent calculation uses the released wavelength centers, rather than rounded portal wavelengths or a fitted absorption minimum.

| Cube | Index minimum / median / maximum | Native latitude extent | Native east-longitude extent |
| --- | --- | --- | --- |
| 1568129671_1 | −0.04424461 / 0.26558300 / 0.76470578 | −45.213879° to +4.293189° | 149.486633° to 157.661804° |
| 1568133146_2 | 0.02903983 / 0.14515283 / 0.75269991 | −14.333492° to +1.468380° | 148.951385° to 168.092545° |

These are **center extents, not filled geographic rectangles or measured coverage area**. All centers pass the proposed phase 10–120° and incidence/emission ≤70° presentation cuts. Native resolution ranges are 2,811–3,025 m and 6,600–6,659 m, respectively.

An independently decoded bright example, first cube zero-based sample/line (10,10), has R58=0.4022189975, R70=0.0973410681, R81=0.3611751199 and D=0.7444038687 at 150.490112°E, 28.560745°S. Its darker example (20,20) has D=0.0509932271 at 155.661667°E, 8.827858°S. This is a spectral absorption contrast; it does not establish ice fraction, grain size or temperature.

The Nantes pipeline already applies spatial filtering and has no Iapetus photometric normalization. Source geometry and illumination, viewing angle, mixed terrain, noise and calibration can affect both displays. See the [intake report](../iapetus.md) for policy, calibration and special-pixel sources.

## Camera and scan support

The independent camera follows the retained [ISIS 3.5.0 VimsGroundMap source](https://isis.astrogeology.usgs.gov/3.5.0/Object/Programmer/_vims_ground_map_8cpp_source.html). It uses the label's native-clock-to-ET anchor, the decimal clock fraction divided by 15959, timing correction 1.01725, Hermite interpolation of observer position, and quaternion interpolation of body/pointing rotations. For zero-based sample x and line y:

```text
t = startET + y × (samples × exposure + interlineDelay)
            + (x + 0.5) × exposure
```

Rays intersect the released **747.4 × 747.4 × 712.4 km** ellipsoid. All reconstructed center directions agree with N planetocentric latitude/east-positive longitude to **≤0.000007606°**, consistent with the stored float32 coordinate precision. This checks source coordinate conventions, transform order, clock interpretation and camera sample positions. It is not an independent estimate of spacecraft-pointing error or agreement with current ISS imagery.

In the first cube, adjacent-line center distance reaches **33.88 km**, versus approximately 2.88 km native resolution. The largest gap is between lines 14 and 15, zero-based. The component perpendicular to the local sample direction also grows to about **6.09 native-resolution units**; this is not merely image shear. Row pairs 8→9 through 22→23 have particularly large perpendicular spacing; some other rows overlap or fold. Exact per-row and per-sample diagnostics are in the JSON. Resolution-normalized spacing is a diagnostic, not a physical acceptance threshold.

The source camera helper can evaluate angular offsets at a **fixed detector acquisition time**. Changing the sample coordinate and recomputing its time would incorrectly mix spatial corners with subsequent acquisitions. Its effective-square corner outputs remain explicitly provisional; they cannot themselves justify physical observation coverage.

### Physical aperture and finite exposure

The [PDS instrument description](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/Cassini/inst-vims.html) lists IR physical IFOV 0.25 × 0.5 mrad and NORMAL effective IFOV 0.5 × 0.5 mrad with two contributions. The [RC19 calibration report](https://pds-rings.seti.org/pds4/bundles/cassini_vims/cassini_vims_cruise/document/vims-wavelength-and-radiometric-calibration-report.pdf), PDF page 10, explains that the narrower aperture moves halfway through NORMAL integration; HI-RES retains the narrower aperture. Its timing discussion also includes mirror-settling correction. The [PDS pixel-timing note](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/Cassini/logs/VIMS%20IR%20Pixel%20Timing_final-a.pdf) supports the scanning-clock correction.

The ISIS 0.495/0.2475 mrad quantities are angular sample pitches. They must not be relabeled as precisely calibrated physical aperture widths. The cited aperture dimensions are nominal; their optical response and signed half-step order are not resolved by this review.

Five pose samples per exposure isolate pointing/observer motion while holding the nominal mirror center fixed. Maximum movement from the midpoint is **411.95 m** in the first cube and **24.25 m** in the second. This motion is smaller than the severe scan-line gaps, but it is relevant at aperture edges.

A conservative implementation may keep the two possible NORMAL half-step orders explicit and intersect their supported unions. Within-half temporal checks must be identified as discrete checks, not proof of continuous-exposure or PSF support. The nominal archived center lies at the boundary between the two narrow apertures; withholding that center under one possible order does not imply the entire detector footprint is empty. HI-RES needs its own narrow-aperture qualification. This report supplies source facts and diagnostic math; it does **not** certify a final footprint rasterizer.

## Native appearance and remaining registration limit

The [first native RGB diagnostic](1568129671_1-native-rgb.png) and [second diagnostic](1568133146_2-native-rgb.png) replicate original detector samples at eight screen pixels per sample, using the same I/F 0–0.45 RGB display scale. They are diagnostic false color and retain the native acquisition array; they do not represent contiguous geographic cells. No interpolation is used in these panels.

[Tosi et al.](https://arxiv.org/html/0902.3591v4#S4) independently select the first observation for its bright/dark boundary and use the same approximate RGB wavelengths. The first diagnostic has a pronounced bright/high-absorption versus darker/weak-absorption division; the second adds a bright patch in a mostly darker field. Observation identity and this interpretation agree with the published text. The original figure-image retrieval failed, so this review does **not** claim a direct pixel comparison with that figure.

The existing normal/enhanced minimaps were initially inspected only as context. The subsequent [independent ISS framing check](iss-framing.md) uses the pinned original USGS mosaic and its actual GeoTIFF transform; the released convention outperforms all tested gross-frame alternatives in all three cubes, with corresponding bright/dark features visible in the comparison panel. This supports gross placement without establishing local relief displacement or a quantitative pointing-error bound. Publish approximate source registration honestly; preserve missing coverage and scan gaps.
