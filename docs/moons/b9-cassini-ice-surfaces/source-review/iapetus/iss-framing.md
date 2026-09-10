# Iapetus: independent ISS framing evidence

The released VIMS east-positive longitude and north-positive latitude convention is supported by an independent comparison with the pinned **USGS Cassini/Voyager ISS mosaic**. It performs better than every tested longitude reversal, 180° shift and latitude reversal in all three selected observations. This supports gross placement and orientation; it does not establish a local pointing-error or subpixel registration bound.

Evidence: [script](check-iss-framing.py), [numeric receipt](iss-framing.json), [native-array comparison panel](iss-framing.png).

## Original inputs and method

The USGS input is the original `Iapetus_Cassini_Voyager_mosaic_global_783m.tif`, **16,612,487 bytes**, SHA-256 `eb8acdbed3af495102b6ec6d3efce1f03dc6bc39bb43323c23231ce590494d6e`. Its actual GeoTIFF transform gives 802.85145591739 m pixels, upper-left coordinates −2312212.1930421 m / +1156106.096521 m, equirectangular central longitude 0 and reference radius 736,000 m. The original map has 5760 × 2880 grayscale samples. Exactly zero is missing and is excluded from comparisons.

At each valid VIMS N center, the script samples the containing ISS source pixel and compares it with the original VIMS band 25 continuum I/F, near 1.28 µm. It applies no translation, image warp, correlation-maximizing fit, photometric correction or source interpolation. The camera's released coordinates and the independent GeoTIFF transform determine the lookup.

The six explicitly tested frames are the released convention, longitude sign reversal, +180° longitude, latitude sign reversal, both signs reversed, and reversed longitude plus 180°. Each comparison retains only shared nonmissing samples; all alternatives happen to preserve the same counts in this cohort.

| VIMS source | Native samples compared | Released-frame Spearman correlation | Best tested wrong-frame correlation |
| --- | ---: | ---: | ---: |
| 1568129671_1 | 1600 | 0.53547 | 0.42187, latitude reversed |
| 1568133146_2 | 676 | 0.35507 | 0.23494, latitude reversed |
| 1568157352_4 | 934 | 0.43737 | 0.23941, both signs reversed |

Pearson comparisons likewise prefer the released frame in all three observations. These are descriptive correlations, not calibrated significance tests: native samples are spatially correlated and the two instruments measure different wavelengths under different illumination and processing.

## Actual visual review

The saved panel was opened and inspected. The first observation reproduces the major upper bright/lower dark division in the independent ISS samples. The second reproduces the distinctive left-side bright patches within mostly darker terrain. The wider observation has compatible gross northern dark structure; finer photographic shading and contrast differ substantially. No exact intensity or native-pixel parity is claimed.

Both panel columns retain the original detector-array arrangement. A line gap remains a gap in geographic coverage even when its neighboring native rows appear beside one another in this diagnostic. The panel is not a geographic coverage map. Gray cells represent the explicitly excluded sample set.

The check completed in **0.15 seconds** of measured numerical work, with **105,791,488 bytes (100.9 MiB)** peak RSS. It read existing local inputs and changed only the evidence panel/receipt. No renderer, geometry, runtime camera, source values or registration parameters changed.

The result supports the current approximate source registration and excludes the tested gross-frame alternatives as better explanations of these features. It leaves local offsets, relief displacement, optical response and a quantitative absolute pointing-error bound unmeasured.
