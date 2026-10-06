# Metis

Metis, a small inner moon of Jupiter, is shown as Galileo photographs projected onto a smooth reference ellipsoid. The soft appearance is the information in the original photographs; no crater detail or color is added.

## Sources

- **Monochrome** combines original Galileo SSI clear-filter frames C0532890500, C0420681401, C0420685801, C0394682801 and C0401751800.
- The surface is a **smooth reference ellipsoid**, with semi-axes 30 × 20 × 17 km from `BODY516_RADII` in NAIF `pck00011.tpc`.
- Denk et al., *Io and the Minor Jovian Moons – Prospects for JUICE*, Figure 10 and Table 3, guided the image survey; no paper artwork is used as a texture.

Imagery is pinned in [source/manifest.json](source/manifest.json) and restored through [source/preparation/acquisition.json](source/preparation/acquisition.json). Source selections and trials are in the [investigation ledger](investigations.json).

## Processing

The eight-bit SSI data are decoded from their VICAR layout; the original files and labels are kept unchanged. Observer and Sun latitude, longitude and range come from OPUS, checked against recorded phase and pixel scale. Several early PDS labels have inconsistent Sun and range values, so those fields are not used. `NORTH_AZIMUTH` is read under the [PDS definition](https://pds.nasa.gov/datastandards/documents/dd/all/current/ch33s02.html), which puts north approximately down in the January 2000 image. Image-centre translation is refined against the illuminated ellipsoid. Geometry records are in `source/geometry/`.

A measured empty-sky median is removed, then the shared bounded lunar-Lambert approximation (weight 0.5, maximum gain 1.5, incidence and emission below 70 degrees) reduces photographed illumination. The 1.5 cap withholds 5,057 of C0394682801's 5,445 samples and lowers area coverage from 60.4% to 53.9%. Overlap level matching needs gains up to 1.75 (C0394682801).

`source/shape/model.json` records the ellipsoid formula, and `metis-ellipsoid.tab` samples it every 5 degrees; these are not radius measurements. Meshoptimizer simplifies its 5,040 triangles to 480 within a 500 m allowance, a preparation setting rather than an uncertainty.

## Evidence

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 5 | 1 | 20.00° | — | — | its other 5 frames | 0 of 5 | — | 0 of 5 | — | ×1.02 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The finest sampling is 2.97 km/pixel, only about 14 pixels across the illuminated body; other views are 5.78–8.74 km/pixel. The ellipsoid gives overall dimensions, not Metis's irregular outline, and its dimension uncertainties are roughly kilometres. No Elevation dataset is shown because there is no resolved terrain.
- Values are relative detector counts, **not calibrated I/F**. The corrections are empirical display choices, not calibrated albedo.
- Monochrome is a coarse ellipsoid projection with no independent surface landmarks. It shows the broad outline, not a feature-registered surface.
- Unreliable samples and cast shadows stay missing and use the shared neutral grid.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
