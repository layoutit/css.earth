# Polydeuces

## Sources

- [Hedman et al. (2020), Table 1](https://arxiv.org/abs/1912.09192) supplies semiaxes 1.75 × 1.55 × 1.31 km with uncertainties 0.2 × 0.2 × 0.2 km.

- The Monochrome lens uses NASA/JPL-Caltech/SSI Cassini N1527002576, CL1/IR1 near infrared, 2006-05-22.

## Evidence

- CISSCAL I/F and detached label are pinned, along with the raw frame used to exclude saturation. The query and candidate evidence are in [source/survey](source/survey).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 1 | 1 | 7.00° | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The mesh is an analytic ellipsoid approximating those axes, not a copy of the detailed irregular shape solution. The body is only about 9 × 7 native pixels.

- **Faithfulness status:** The Monochrome frame is retained as coarse pointing evidence only. At roughly 9 × 7 pixels, it cannot establish surface-feature registration to the analytic ellipsoid.

- The 1-pixel inset and 55° incidence/emission cuts limit limb/registration uncertainty. Bounded Lommel-Seeliger normalization (gain ≤2) suppresses geometric shading without inventing fine terrain or recovering albedo. Gray grid retains true gaps.

- Display pole aligned to the fitted orbital normal; arbitrary meridian, no measured spin or current landmark phase is claimed. This is distinct from the orbital position, which uses JPL Horizons samples over 2020–2032 and the shared fitted ellipse plus prepared slow-longitude libration terms. Independent fractional-day reference epochs measure fit residuals, not a universal accuracy bound; extrapolation outside the fitted interval is not qualified.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="polydeuces-source-record"></a>

## Included presentation

Appendix B revises the older 1.5 × 1.2 × 1.0 km values.

Physical scale uses the volume-equivalent radius 1.525973578806757 km. The 5° radius table and formula are checked in. Meshoptimizer prepares 480 native triangle leaves; its 38.149339470168925 m error allowance is a simplifier parameter, not a physical measurement uncertainty.

Table 7 provides camera center, north azimuth, observer/Sun coordinates and range; the shared camera projection uses the measured-axis approximation.

## Investigation record

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

## Orientation, position and delivery

Pole RA 40.562369830280026°, Dec 83.5427248263262°. Photographic registration uses its separate historical Table 7 frame.

Both shared Flood and Shadows remain available. Prepared context, minimap, thumbnail and lighting derive from this same shape and material. Source inputs and authored documents are pinned in source/manifest.json; external files are restorable through preparation/acquisition.json. NASA/PDS source attribution and the separate font terms are retained.

</details>
