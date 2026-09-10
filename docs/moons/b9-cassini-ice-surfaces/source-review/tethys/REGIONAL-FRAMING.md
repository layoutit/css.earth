# Tethys geographic framing: bounded independent review

[Stephan et al. (2016)](https://doi.org/10.1016/j.icarus.2016.03.002), section 2.2 and Figures 1–2, supply useful regional context. The [public manuscript](https://openaccess.inaf.it/bitstream/20.500.12386/24722/1/Stephan_Tethys_11092015.pdf) was downloaded and its actual coverage map, ISS basemap and geology figure inspected. The source paper uses west-positive longitude; the original N cubes use east-positive longitude. Convert with `east = (360 - west) mod 360`. The paper's 180°W–0°–180°W map runs from the leading hemisphere on the left to trailing on the right.

The paper describes orbit 47 observations in the Ithaca Chasma region, orbit 136 trailing-hemisphere observations, and orbit 168 observations around Odysseus. Our selected observations are a subset of those orbital visits, not the paper's complete map:

| Selected observation | Geometry-cut native centers | Permitted description |
| --- | --- | --- |
| 1561668191_1, orbit 47 | 327.48–338.01°E, 16.32°S–9.19°N | Equatorial region near Ithaca Chasma; no full-canyon coverage claim |
| 1660463972_1, orbit 136 | 122.34–172.22°E, 42.84–6.71°S | Southern trailing-side region; IR25 is withheld by detector quality |
| 1719613772_1, orbit 168 | 248.94–352.59°E, 1.57°S–67.62°N | Leading-side regional observation; severe selected-band detector clipping |
| 1719616836_1, orbit 168 | 249.50–346.00°E, 29.86°S–40.79°N | Leading-side regional observation with clean selected detector bands |

The published Odysseus center is **32.8°N, 128.9°W = 231.1°E**. Among all valid source-navigation centers, even before the stricter geometry cut, the closest center in `1719613772_1` is **20.94°** away; the closest in `1719616836_1` is **25.88°** away. The paper's approximately 445 km crater diameter corresponds to a radius around 24° on a 531 km sphere. These particular images reach the vicinity/edge of the crater, not its center. Calling them resolved maps of Odysseus would overstate this selection. The article also notes that part of Odysseus was unilluminated during the visit.

`check-regional-framing.py` reproduces these angular checks from the original N planes; `regional-framing-check.json` preserves native sample/line anchors. The two non-Odysseus reference positions in that JSON are explicitly coarse regional points, not independently measured landmarks.

This paper comparison is consistent with the broad hemisphere/region framing. It does **not** measure a source-to-basemap registration residual or prove the exact absolute pointing of the selected cubes. The archive's reconstructed spacecraft pointing, original ellipsoid/frame and finite detector sampling remain the coordinate basis. The existing renderer and fixed body geometry are untouched.

## Exact normal-map comparison: non-diagnostic

The restored current USGS normal-map source was subsequently checked against its body manifest: `Tethys_Cassini_mosaic_global_293m.tif`, 66,401,923 bytes, SHA-256 `40723c3ebfaaa52a657827b37309bc84234811db1cf26a21d086e26aba2b3640`. Its 11520×5760 equirectangular projection uses planetocentric latitude, east-positive longitude, zero central longitude and the documented 536,300 m projection radius. This projection radius is used to address the source map; it does not replace the VIMS source ellipsoid or scene geometry.

`check-iss-framing.py` samples the exact ISS source at original N coordinates for all nine selected observations. It compares the predeclared IR25 and IR44 radiance bands separately, with raw detector-quality masks and the recipe's geometry cuts. For each band, the released frame and five deliberately wrong-frame alternatives use the **same** common nonmissing source pixels. No brightness mask, registration fit, source warp, photometric correction or full-source-image array is used.

The result is **non-diagnostic**. Correct-frame Spearman correlation is near zero for most substantial observation samples. For example, the clean `1719616836_1` observation gives 0.032 (IR25) and 0.013 (IR44), each with 343 samples; several wrong-frame controls are slightly higher. The small 64-sample IR44 comparison in `1807456038_1` is positive at 0.353, but a wrong-frame control reaches 0.454. The seven-sample strip cannot support a useful conclusion. These results neither independently verify the released framing nor establish that any alternate orientation is correct.

The saved native-array panel was visually inspected. VIMS radiance shows broad illumination structure while individual ISS samples show much finer photographed surface texture. The comparison intentionally samples one ISS source cell per N center; it does not reproduce VIMS footprint integration. Wavelength, illumination, archive processing, sampling and spatial dependence make these correlations unsuitable as a calibrated significance or precision-registration test.

`iss-framing.json` pins the actual reference, recipe, plot script, quality helper and PNG; `iss-framing.png` retains the diagnostic arrays. The final bounded check completed in 0.47 seconds of measured processing with approximately 154 MiB peak process RSS. No correction follows from this result. An independent measured feature tie is still required for a stronger source-to-fixed-map registration claim; until then, label the scientific surfaces with approximate registration and preserve source gaps.

The paper's maps are context only: no published figure colors were sampled to create any scientific values, and none of its model-derived abundance/particle-size conclusions are transferred into these three-band products.
