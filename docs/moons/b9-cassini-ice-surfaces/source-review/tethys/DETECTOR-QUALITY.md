# B9 original detector quality

The nearly flat Tethys 1.28 µm planes are detector clipping, not a uniform surface property. Original PDS3 counts plus their original per-band, per-line BACKGROUND suffix reach the 12-bit maximum **4095**. The archive's calibrated RC19 cubes retain finite I/F values at these clipped locations. Calibrated special-value checks alone therefore miss them.

The implementation is [cassini-vims-detector-quality.py](../../../../../tools/objects/acquisition/cassini-vims-detector-quality.py), SHA-256 `e02acd15b1af115d3482a6272ba78d79071db2757d45854fb0d0527681dc314e`. Eight focused synthetic tests cover background reconstruction, valid dark values, band-specific clipping, composed filter dependencies, missing-background handling, other invalid backgrounds, native special values, identity mismatches, and unsupported history. All 13 selected real C/QUB pairs passed format/identity checks.

## Original detector interpretation

[McCord et al. (2004), Fig. 1 caption](https://doi.org/10.1016/j.icarus.2004.07.001) documents 12-bit VIMS digitization and explains why background-subtracted IR saturation can appear below 4095 DN. [ISIS vimscal documentation](https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/vimscal/vimscal.html) establishes that the sideplane was already subtracted when CompressorId is present. For these original QUBs, `COMPRESSOR_ID=1`, the IR background mode is `SINGLE`, and spectral summing/editing are off.

The decoder checks target, product identity, native start/stop clocks, UTC start/stop, exposure, dimensions, sampling mode, original band order, and calibrated IR band order. Original IR band `k` is full-cube band `k+96`. The cube is big-endian signed 16-bit core data, sample-fastest, followed by a signed 32-bit BACKGROUND per spectral band and line; four additional housekeeping suffix bands complete each line. Every selected background is independently matched against the calibrated C cube's attached `SideplaneIr` table. Actual core end and final record padding are checked. Some originals declare one more 512-byte `FILE_RECORDS` record than present; receipts preserve this discrepancy instead of silently changing it.

Pixels are withheld for original special/invalid values, invalid background, reconstructed ADC below zero, or ADC at/above 4095. Ordinary zero and negative **background-subtracted** values remain valid when the original codes are otherwise valid; ADC zero is also retained. There is no I/F brightness mask or percentile exclusion.

## Archive-filter dependencies

The [archive pipeline](https://vims.univ-nantes.fr/info/isis-calibration) and each C cube's attached history agree: applicable images received 5×5 `noisefilter` classification with replacement by NULL, followed by 3×3 `lowpass` replacement of NULL/LIS. The [historical noisefilter description](https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/noisefilter/noisefilter.html) defines classification using boxcar statistics; [lowpass](https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/lowpass/lowpass.html) defines replacement using the boxcar average.

For these recorded operations, the conservative dependency radius is **2 + 1 = 3 native pixels**, separately per selected band. A clipped value can affect a noise decision within radius 2; that output can then affect a replacement within radius 1. This is a bound on possible dependencies, not evidence that every withheld value was changed. Narrow cubes with no recorded spatial filters use radius zero. Unknown processing chains fail closed. Quality masks remove support; they do not interpolate new values or bridge scan gaps. RGB uses the intersection of its three source-band masks, and depth uses its three masks; they can retain different coverage.

## The missing Iapetus row is handled explicitly

Iapetus `1568157352_4` has raw NULL values across zero-based row 41 and BACKGROUND `57344`. Its calibration is not globally corrupted by this marker: the exact [ISIS v3.5.2 source](https://raw.githubusercontent.com/DOI-USGS/ISIS3/77c10385ee31526b54cc42b82ee30a1ac4ed8c58/isis/src/cassini/apps/vimscal/vimscal.cpp), matching the C history's ISIS release, maps `57344` to NULL (lines 875–878), excludes it from the least-squares fit (901–902), and propagates the missing-row correction as NULL (272–275). Source SHA-256: `3fa43d3feff07f5deb21d2597d456c4d1464754ff83e6a3d01d4636379e6c552`.

The source-aware policy withholds that row and its ±3-row filter dependency, leaving **1968 of 2304 native pixels** before geometry cuts in each selected band. Other invalid/clipped BACKGROUND values would still invalidate the band's global fit. The first two Iapetus cubes and Phoebe `1465671822_1` have no defects in the selected bands. Phoebe's independent registration continuum bands 57 and 83 are also clean across all 864 native pixels.

## Tethys results

Counts below are source native pixels after the trial's geometry cuts, then after original detector quality and recorded filter dependencies. They are not final map area or prepared texel counts.

| Original observation | Geometry eligible | RGB eligible | Depth eligible |
| --- | ---: | ---: | ---: |
| 1807469104_1 | 7 | 7 | 7 |
| 1807456038_1 | 64 | 18 | 64 |
| 1807473499_1 | 201 | 35 | 201 |
| 1818547570_1 | 97 | 97 | 97 |
| 1561668191_1 | 184 | 184 | 184 |
| 1660463972_1 | 138 | 0 | 138 |
| 1719613772_1 | 366 | 0 | 133 |
| 1719616836_1 | 343 | 343 | 343 |
| 1606213356_1 | 130 | 130 | 130 |

Full-frame IR25 clipping counts are 446/544 in `1719613772_1` (640 ms IR exposure), 133/288 in `1660463972_1` (240 ms), 46/144 in `1807456038_1`, 98/288 in `1807473499_1`, and 1/512 in `1818547570_1`. The adjacent `1719616836_1` control uses 160 ms, with no selected-band clipping. The long-exposure `1719613772_1` also clips IR44 (103 pixels), IR58 (196), and IR81 (31), affecting both proposed products.

The recommended selection retains the same physical bands, **R/G/B = IR70/44/25** near 2.02/1.59/1.28 µm, with detector-quality masks applied before ownership selection. This preserves source identity and honest missing coverage. It does not substitute bands per pixel or use brighter-looking observations. Depth remains the original three-band continuum-relative quantity, not ice abundance.

## Evidence and limits

- `download-receipts.json` pins exact original QUB download URLs, redirects, sizes and hashes.
- `inspect-spectral-planes.py` and `native-spectral-review.json` independently decode the C planes and N geometry with stdlib `struct`, without converter or camera imports.
- `*-detector-quality.json` retains all per-band masks and exact original defect indices for the 13 selected originals; `detector-quality-summary.json` collects their receipts.
- `vimscal-source-receipt.json` pins the historical background algorithm. `vimscal-v3.5.2.cpp`, `noisefilter-3.5.html`, and `lowpass-3.5.html` retain the inspected primary sources.

The masks do not undo archive filtering, detect every possible detector defect, establish exact optical footprints, or prove absolute pointing. Native spectra remain photometrically uncorrected. Their apparent differences can reflect illumination, phase, resolution, processing and observation joins as well as surface properties. Final maps must preserve these caveats and withheld support.

The Stephan manuscript PDF and its extracted text/page images are retained only under ignored `output/b9-source-intake/tethys/review-reading/`. They are reading copies, not proposed redistribution assets; cite the authoritative manuscript URL in the delivery.
