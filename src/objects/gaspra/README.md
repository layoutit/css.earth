# Gaspra

The asteroid 951 Gaspra on the Thomas shape model, with two calibrated Galileo close-ups, the processed monochrome
mosaic and an elevation map. No photographic texture or terrain is synthesized to fill missing observations.

## Sources

The panel's editorial credit is NASA's Galileo mission page: <https://science.nasa.gov/mission/galileo/>.

| View or property | Source and interpretation |
| --- | --- |
| SSI reflectance | Galileo clear-filter [107318326](source/observations/107318326rcal_clr.xml) and [107318313](source/observations/107318313rcal_clr.xml), 29 October 1991, about 54 m/pixel. I/F normalized to 50° incidence and phase with a published Hapke model; fixed display stretch, no fitted gain. |
| Monochrome and shape | [Thomas PDS release](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/). The processed high-pass mosaic adds mapped coverage; it is not calibrated albedo. |
| Elevation | Thomas shape radius minus 6.1 km, false color from −2 to +5 km; not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/GASPRA/target) Gaspra centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

The photometric model is the Hapke fit of [Helfenstein et al. (1994)](https://doi.org/10.1006/icar.1994.1005),
recorded in [the model record](source/photometry/helfenstein-1994-hapke.json). The rotation comes from the pinned
[NAIF pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc). One labelled name carries a
caption note from its English Wikipedia article (CC BY-SA 4.0), recorded in `source/features/notes.json`.

## Processing

**Shape.** The shape has 16,471 rows at 2° spacing, radius 4.1442–10.7966 km, with no ellipsoid substitution. Its
west-positive longitude is converted once to the renderer's east-positive frame. Meshoptimizer 1.2.0 simplifies the
32,040-triangle source grid to 800 faces, one closed component. The pole is RA 9.47°, Dec 26.70°, with
W = 83.67° + 1226.9114850° × d. Horizons confirms the 6.1 km radius and about 7.042 hour rotation; GM is unavailable,
so no mass is invented.

**SSI reflectance.** The cameras come from the Thomas image catalog and the Galileo SSI instrument kernel, with no
local fitting or warping. Bad data is withheld from the original detector files and `gaspbad.tab`, not by a brightness
threshold. Projection keeps incidence and emission under 65° with a five-pixel inset at detector edges. Both frames
are normalized to 50° incidence, 0° emission and 50° phase with the Hapke model: single-scattering albedo 0.36,
shadow-hiding amplitude 1.63 and roughness 29°, plus width 0.06 and asymmetry −0.18 from Hasselmann et al. (2016).
The second frame's overlap gain is 1.014. The display range is 0–0.0902 I/F, the 99.5th percentile, shown linearly.
Where frames overlap, the finer one wins.

**Monochrome.** The mosaic displays the published 8-bit high-pass values. Its PDS4 display section says bottom-to-top,
but its bytes, the observation geometry and the Stooke map put row zero at the north and columns increasing east (see
`source/reference/registration.md`). The recipe uses `rowOrder: north-to-south` and `longitudeDirection: east`. A
display pixel needs all four interpolation samples valid; missing regions use the neutral grid.

**Elevation.** Radius minus the 6.1 km reference sphere, on a −2 to +5 km palette. It includes the body's irregular
shape and is not height above an equipotential.

**Features.** Each gazetteer centre is cast through the prepared hit mesh, so anchors sit on the shape model. Craters
and faculae trace a rim circle, other types their published extent box. Outlines are not published boundaries.

## Evidence

- Mesh accuracy: over 3,200 equal-area rays the mean error is 34.708 m and the maximum 202.662 m, with no missed rays.
- Frame 107318326 was checked against the Thomas mosaic on four withheld 32×32 patches: every correlation exceeds 0.7,
  RMS residual 0.866026 source pixels, maximum 1.000000, under the four-pixel limit (about 216 m). Frame 107318313
  gives 2.646 px RMS and 3.162 px maximum. Results are in `source/reference/calibrated-registration*.json`; reproduce
  with `python packages/bake/cli/verify-catalog-camera.py src/objects/gaspra/source OUTPUT_DIRECTORY` (numpy, scipy,
  astropy and Pillow; Node on PATH).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `calibrated` | 2 | 0 | — | — | — | its other 2 frames | 0 of 2 | — | 0 of 2 | — | ×1.00 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Coverage remains partial and the grid marks gaps. The Thomas mosaic keeps photographed shadows, seams and oversampled
  detail; 64.6022% of its cylindrical pixels are missing, not a surface-area percentage.
- The registration checks against the Thomas mosaic share mission observations and are not independent absolute
  cartography.
- The frames lie at about 51° phase, so the 48–54° phase limit extrapolates the Hapke model by up to 3°, and its
  0.56 µm fit is narrower than the clear filter's band.
- Image 107315039 failed to establish four separate registration checks and is excluded.
- Directional lighting cannot remove photographed shadows or model all terrain self-occlusion.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
