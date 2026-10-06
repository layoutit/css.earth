# Puck

Puck is shown as one Voyager 2 photograph on an approximate reference sphere.

## Sources

- Puck has one **Monochrome** dataset: the original calibrated Voyager 2 narrow-angle clear-filter observation **C2683716**, acquired on 24 January 1986. The [PDS GEOMED image](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26837XX/C2683716_GEOMED.IMG) and its detached label are kept unchanged.
- It is registered to an explicitly approximate **81 km reference sphere**, using the 162 km mean diameter in the [PDS Uranus satellite table](https://pds-rings.seti.org/uranus/uranus_satellites_table.html). The older 77 km radius in the pinned PCK and the rounded 150 km diameter on NASA's introductory page are not used for display size.
- The camera roll comes from the [Voyager Uranus ISS SEDR pointing kernel](https://pds-rings.seti.org/voyager/ck/vg2_ura_version1_type1_iss_sedr.bc).

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

The VICAR raster is 1,000 × 1,000 signed 16-bit samples, converted to I/F by the FICOR77 multiplier of 0.0001 through the calibrated-camera decoder. The geometrically corrected raster samples about **4.04 km/pixel**, but Puck spans only about 40 corrected pixels, so no texture or topography is synthesized.

`source/geometry/registration.json` records the OPUS Sun/observer geometry, range, pixel scale and fit. The pole roll, **83.290674638° clockwise from image-up**, is derived from the SEDR kernel, spacecraft clock and IAU pole at exposure end. SEDR pointing alone cannot locate the tiny disc, so only the image centre was fitted to the illuminated limb, at (426.9, 700.2) in the corrected raster.

A bounded 50/50 Lommel-Seeliger/Lambert normalization is applied to calibrated I/F, displayed over 0–0.0594 I/F (the 99.5th percentile of displayed samples). Only edge-connected low-signal sky is masked, with a two-pixel boundary inset. Samples beyond 75° incidence, 70° emission or 2.5× gain are withheld.

The scene rotation uses the IAU/WGCCRE model with PCK periodic terms evaluated at the 4 September 2026 TT reference epoch (JD 2461287.5). The radius table samples the reference sphere every 5°, simplified to **432 native PolyCSS `u` leaves** in one closed component.

## Evidence

- About 32.7% of the prepared equirectangular map pixels keep qualified observation coverage. This is a raster-pixel fraction, not an equal-area surface measurement.
- The reference-sphere outline was inspected against the source image.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 1 | 0 | — | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- This is not a measured shape or an elevation model. The original detector sampled about **4.77 km/pixel**, and enlarging the photograph cannot supply fine terrain.
- The illumination correction reduces broad shading. It does not recover physical albedo, account for unresolved slopes or reconstruct cast shadows. No phase-function correction is claimed.
- Uncovered pixels show the neutral grid.
- The image is coarse limb-pointed evidence only. No surface landmarks establish image-to-shape registration, and the sphere is an approximation.
- Small periodic rotation terms are frozen beyond the reference epoch.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
