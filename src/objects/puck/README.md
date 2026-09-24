# Puck

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- Puck has one **Monochrome** dataset: the original calibrated Voyager 2 narrow-angle clear-filter observation **C2683716**, acquired on 24 January 1986.

- It is registered to an explicitly approximate **81 km reference sphere**, using the 162 km mean diameter in the [PDS Uranus satellite table](https://pds-rings.seti.org/uranus/uranus_satellites_table.html).

## Evidence

- The [PDS GEOMED image](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26837XX/C2683716_GEOMED.IMG) and its detached label are pinned unchanged.

- About 32.7% of the prepared equirectangular map pixels retain qualified observation coverage. This is a raster-pixel fraction, not an equal-area surface measurement.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 1 | 0 | — | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- This is not a detailed measured shape or an elevation model. The original detector sampled about **4.77 km/pixel**. Enlarging this photograph cannot supply fine terrain.

- **Illumination correction:** It reduces broad acquisition shading; it does not recover unique physical albedo, account for unresolved terrain slopes or reconstruct cast shadows. No phase-function correction is claimed.

- **Photographic coverage:** The remaining pixels show the existing neutral grid.

- Its approximate shape and limited resolution remain registration uncertainties; this is not a new photogrammetric shape solution.

- **Faithfulness status:** The Monochrome image is retained as coarse limb-pointed evidence only. No surface landmarks establish image-to-shape registration, and the analytic sphere remains an approximation.

- Browser results are not recorded in this source account.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="puck-sources-and-interpretation"></a>

The older 77 km radius in the pinned PCK and the rounded 150 km diameter in NASA's introductory page are not used for display size.

The PDS geometrically corrected raster samples about **4.04 km/pixel**, but resampling does not improve the optical resolution: Puck spans only about 40 corrected pixels. No plausible-looking texture or local topography is synthesized.

## Source and camera

The attached VICAR header defines a 1,000 × 1,000 signed little-endian HALF raster at byte 2,000. Its FICOR77 multiplier converts the integer samples to I/F by multiplying by 0.0001. This uses the existing calibrated-camera decoder, not a screenshot or contrast-enhanced press image.

`source/geometry/registration.json` records the OPUS body-fixed Sun/observer geometry, range, corrected-pixel angular scale, and source fit. Longitudes in the camera recipe are west-positive; the shared shape convention is east-positive. The source pole roll, **83.290674638° clockwise from image-up**, is derived from the pinned [Voyager Uranus ISS SEDR pointing kernel](https://pds-rings.seti.org/voyager/ck/vg2_ura_version1_type1_iss_sedr.bc), spacecraft clock, leap seconds and IAU Puck pole at exposure end. The record includes the matrix, clock record and pole vectors, so the roll does not depend on an eyeballed image rotation.

The present scene uses a separate authored IAU/WGCCRE rotation. Its pole and prime meridian include the PCK periodic terms evaluated at the 4 September 2026 TT reference epoch (JD 2461287.5). The declared reference epoch allows propagation to the shared scene epoch. The reported secular spin rate is retained; small periodic terms are frozen beyond that epoch. This is a sourced phase model, not an arbitrary orientation. The observation registration instead evaluates the original 1986 frame.

Uncorrected SEDR absolute pointing is insufficient to locate this tiny disc precisely. Only the image-center translation was fitted to its illuminated limb, holding the physical radius, source range, Sun/observer directions, pixel scale and roll fixed. The fitted center is (426.9, 700.2) in the corrected raster. The reference-sphere outline was inspected against the actual source.

## Illumination and coverage

The shared controlled-shape-camera recipe applies a bounded 50/50 Lommel-Seeliger/Lambert normalization to calibrated I/F. The display range of 0–0.0594 I/F, the 99.5th percentile of displayed samples, is a visualization scale, not a measured maximum reflectance.

Sky offset and robust noise were measured in a local empty image rectangle. Only edge-connected low-signal sky is masked, so isolated dark terrain is not automatically erased. A two-pixel boundary inset accounts for pointing/shape uncertainty. Samples beyond 75° incidence, 70° emission, or 2.5× correction gain are withheld. There is no cross-observation level matching because this dataset uses one frame.

Surface, poles, thumbnail, minimap and full-silhouette context portrait share this interpretation. Flood lighting and directional Shadows remain the shared controls.

## Candidate survey

Surveyed 2026-09-08:

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

## Preparation and restoration

The checked-in radius table samples the stated reference sphere every 5°. The shared radial preparer simplifies 5,040 triangles to **480 native PolyCSS `u` leaves**, one closed component with Euler characteristic 2. Its estimated simplifier error is 1.38 km under the 1.5 km setting; this is a display simplification metric, not a scientific shape-accuracy claim.

Original image and label and the SEDR pointing kernel are restorable through the pinned acquisition plan. The small reference table, other geometry kernels, source evidence and generated context portrait are checked in. The portrait is reproducible with the shared radial-snapshot recipe in `preparation/navigation.json`.

</details>
