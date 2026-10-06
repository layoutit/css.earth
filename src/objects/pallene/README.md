# Pallene

Pallene has one **Monochrome** view: a coarse brightness patch from one Cassini
photograph on a measured triaxial ellipsoid. No fine terrain or hidden
hemisphere is reconstructed; other regions use the shared neutral coverage grid.

## Sources

- **Photograph:** [PDS Cassini image N1496910582](https://opus.pds-rings.seti.org/opus/#/detail=co-iss-n1496910582), taken on 2005-06-08 at 08:02:15.536 UTC (mid exposure), through the clear filters at 454.56 m/native pixel, 75,862.43 km range and 21.126° phase. It is CISSCAL 4.0beta calibrated I/F.
- **Shape:** [Thomas et al. (2013)](https://doi.org/10.1016/j.icarus.2013.07.022) and the pinned [NAIF PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), `BODY633_RADII`, give semi-axes 2.88 × 2.08 × 1.80 km. The earlier [LPSC 2013 abstract](https://www.lpi.usra.edu/meetings/lpsc2013/pdf/1598.pdf) uses 1.84 km for the short axis; the published/PCK value is selected.
- **Orientation:** archived NAIF `pallene_mst2013.bpc` with reconstructed Cassini kernels. OPUS supplies the observer and Sun geometry.

Source selections, recorded trials and open questions are in the
[investigation ledger](investigations.json).

## Processing

`shape/ellipsoid.tab` is an analytic realization of those dimensions, not a
detailed measured mesh. Meshoptimizer reduces it to 448 native PolyCSS
triangles, the fewest within its 40 m error allowance, which differ from the ellipsoid by 40.138 m at the 95th percentile.

The camera's north azimuth, 269.776104884°, comes from the kernels. Preparation
rejects sky at I/F ≤0.02, requires incidence and emission ≤55°, and normalizes
the surface with a Lommel–Seeliger term, `gain=(mu0+mu)/(2*mu0)`, with gain≤2.
The display range is 0–0.492 I/F, shown linearly. Shared commands are
`node packages/bake/cli/object-operations.mts acquire pallene --verify-only` and
`node site/build/prepare/prepare-authored.ts pallene --write`.

## Evidence

A least-squares fit of the illuminated ellipsoid limb and terminator gives the
detector centre with RMS 0.498 native pixel. Varying the boundary threshold from
0.08 to 0.20 moves the centre by under 0.22 pixel. This is a pointing
refinement, not an adjustment of the moon's shape. The illuminated disc is only
8 × 13 pixels and contains no independently identifiable surface feature to fit
([registration-attempt-2026-09-10.json](source/survey/registration-attempt-2026-09-10.json)),
so surface-feature registration is not established.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 1 | 1 | 18.00° | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- At the 512 × 256 preparation grid, 16,617 cells (12.68%) are observed; these are resampled cells, not independent source pixels.
- The illumination normalization omits a phase function, multiple scattering and sub-resolution shape; it is not calibrated albedo recovery.
- Finer 2010/2011 frames were excluded for saturation, high phase or too little reliable coverage.
- Runtime presentation freezes the pole sampled at 2010-10-16T18:20:52.721 UTC (RA 40.82129048°, Dec 83.35802948°) with an explicitly arbitrary display meridian. It predicts no current spin phase.
- The Cassini-era orbit fit has a maximum 27.65 km residual across six independent epoch checks; its propagation to the 2026 application epoch is unqualified.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

<a id="pallene-sources-and-interpretation"></a>
<a id="measured-shape"></a>
<a id="observation-geometry-and-validity"></a>
<a id="dataset-survey"></a>
<a id="runtime-orientation-and-restoration"></a>
