# Iapetus detector rasterizer: independent dense-time review

The zero-inset trial needs a small explicit temporal guard. A **1e−7 rad inset on each aperture axis** is supported by this bounded audit: it removed the observed between-pose edge cases and retained all 575 sampled actual output candidates. It reduces the nominal fast-axis aperture width by 0.08%. It is a conservative source-detector selection choice, not an absolute-pointing uncertainty bound or a calibrated optical response.

Evidence: [qualification script](qualify-rasterizer.py), [initial machine receipt](rasterizer-dense-qualification.json). The initial run used the source-camera equations in the earlier independent Iapetus helper; the script was subsequently generalized to the same original ISIS NORMAL/HI-RES branches for the separate Tethys review. Each receipt records the script and production code hashes actually used.

## Scope and results

The initial run reviewed all three trial observations: 1568129671_1, 1568133146_2 and 1568157352_4. It selected 16 detector pixels per observation, including the severe scan discontinuity in the first cube. Each selected source pixel was evaluated at **129 equally spaced exposure poses**, compared with the product's three poses within each half-exposure. Candidate locations combined actual trial map ownership, deliberately near-boundary camera rays and positive interior witnesses. The independent oracle inverts the source camera into angular aperture coordinates; it does not use production angular-frustum containment as its geometric oracle.

| Quantity | Result |
| --- | ---: |
| Actual output candidates retained at zero inset | 575 |
| Actual output candidates failing dense support | 0 |
| Deliberate boundary candidates accepted by production but failing dense support | 4 |
| Worst signed dense aperture margin | −3.1756944e−8 rad |
| Smallest tested inset eliminating those cases | 1e−8 rad per axis |
| Adopted, more conservative tested inset | 1e−7 rad per axis |
| Actual output candidates retained at adopted inset | 575 |

All four failures were caused by motion between the product's temporal samples. They occurred at zero-based pixel 632 in 1568133146_2 and pixel 1416 in 1568157352_4. Their coarse angular-rectangle margins were approximately +1e−9 rad, so the failure was not merely the difference between curved angular boundaries and corner-ray planes. The machine receipt contains exact coordinates and margins. A 1e−6 rad inset unnecessarily removed eight of the tested actual output candidates; it is not recommended from this evidence.

These results are empirical temporal qualification. Neither 129 samples nor the tested guard proves a continuous-exposure maximum. Physical aperture dimensions and half-step order retain the qualifications in the [source review](independent-validation.md).

## Scan gaps and lookup accelerator

Twelve points placed one-quarter, halfway and three-quarters between the first cube's original rows 14 and 15 were rejected by every source pixel in neighboring rows 12–17. Those points span original samples 10, 20, 30 and 39. This independently checks the known discontinuity without connecting its centers into geographic cells. Another observation or a later slew may legitimately cover a gap; this local test does not demand that the final multi-observation map erase such coverage.

The bounding lookup was compared with production angular containment over the **entire actual 1024 × 512 grid** for 12 apertures: 6,291,456 queries, 473 supported grid centers, and **zero supported centers dropped**. Fixed-seed global and wider-local random probes added 48,378 queries across all 48 selected apertures, including 93 supported centers, again with zero dropped. Random probes alone hit no supported centers in the smallest-footprint first cube; its exhaustive checks supply the useful positive evidence. This qualifies the selected apertures, not every possible source camera or limb configuration.

## Resource and registration boundaries

The run completed in **5.18 seconds**, peak resident memory **260,685,824 bytes (248.6 MiB)**, with numerical thread counts set to one. It read existing small trial TIFFs and the pinned source cubes, wrote only this lane's evidence, and did not bake, build, open a browser, or alter the converter.

This camera and rasterizer review cannot establish absolute alignment to the independent ISS base. A subsequent [independent framing check](iss-framing.md) uses the restored, hash-verified original USGS mosaic and supports the released convention over all tested sign/180°/latitude alternatives in each of the three cubes. The actual bright/dark feature comparison supports gross placement; a quantitative local pointing-error bound remains unmeasured.
