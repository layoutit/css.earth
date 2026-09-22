# Metis

## Sources

- **Monochrome** combines original Galileo SSI clear-filter frames C0532890500, C0420681401, C0420685801, C0394682801 and C0401751800.

- The surface is a **smooth reference ellipsoid**, with semi-axes 30 × 20 × 17 km from `BODY516_RADII` in NAIF `pck00011.tpc`.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

- OPUS owns observer and Sun planetocentric latitude, west-positive longitude and range, checked against recorded phase and image pixel scale.

- Original imagery is pinned in [source/manifest.json](source/manifest.json) and restored through [source/preparation/acquisition.json](source/preparation/acquisition.json).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 5 | 1 | 20.00° | — | — | its other 5 frames | 0 of 5 | — | 0 of 5 | — | ×1.02 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The finest sampling is 2.97 km/pixel, only about 14 pixels across the projected illuminated body; complementary views are 5.78–8.74 km/pixel. It describes measured overall dimensions, not Metis's detailed irregular outline. No Elevation lens is exposed because the ellipsoid contains no resolved terrain measurements.

- **Photometry:** They are relative detector counts, **not calibrated I/F**. These are empirical display corrections, not recovery of calibrated albedo.

- **Faithfulness status:** The Monochrome lens is a coarse ellipsoid projection with no independent surface landmarks. It remains available as an observation of the broad outline, not a feature-registered photographic surface.

- Unreliable source samples and cast shadows remain missing; no geometry, hidden texture or false neutral colour is inferred from them. Gaps use the shared neutral grid.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="metis-sources"></a>

## Selected view and limitations

The soft appearance is the information in the original photographs. No invented crater detail or colour is added.

The prepared surface uses 480 native raster triangles and shared flood and directional lighting.

## Geometry and photographic preparation

Original eight-bit reconstructed SSI data are decoded from their attached VICAR layout, preserving line prefixes and binary-header offsets. The original files and detached labels are preserved unchanged.

Several early raw PDS labels contain inconsistent Sun/range values, so those fields are not used. `NORTH_AZIMUTH` is clockwise from image right under the [PDS definition](https://pds.nasa.gov/datastandards/documents/dd/all/current/ch33s02.html); adding 90 degrees supplies the shared camera's clockwise angle from image up. In particular, north is approximately down in the January 2000 raw image. The OPUS image-center and pole-clock values disagree with that image and are not used. Image-center translation is refined against the illuminated ellipsoid while holding its dimensions, camera scale and source directions fixed. Coordinates and the original metadata are recorded in `source/geometry/`.

A measured empty-sky median is removed, then the shared bounded lunar-Lambert approximation (weight 0.5, maximum gain 1.5, incidence/emission below 70 degrees) reduces photographed illumination. At a cap of 2, 739 of the 766 saturated display samples had been normalized by more than 1.5, in thin slivers at the edge of C0532890500 and C0394682801; the 1.5 cap withholds 5,057 of C0394682801's 5,445 samples and lowers area coverage from 60.4% to 53.9%. Overlap level matching is fitted where both frames see the surface within 70° of incidence and emission and needs gains up to 1.75 (C0394682801). The coarse ellipsoid limits registration.

`source/shape/model.json` records the analytic ellipsoid sampling formula. `metis-ellipsoid.tab` is a checked-in 5-degree sampling of that formula, not independent radius measurements. Its sampling is verified against the original PCK dimensions in the numerical source test. Shared meshoptimizer preparation simplifies its 5,040 triangles to 480 within a 500 m library error allowance; that allowance is a preparation setting, not a measurement uncertainty. Original dimension uncertainties are roughly kilometres.

Surface, pole atlas, minimap and navigation portrait use the same interpreted map. The context portrait preserves the complete measured silhouette; shared lighting stays available instead of hiding source shadows by disabling application controls.

## Source restoration

The small measured ellipsoid, geometry records and prepared context portrait are checked in. Font: Inter.

Useful source review: Denk et al., *Io and the Minor Jovian Moons – Prospects for JUICE*, Figure 10 and Table 3. Its image identifications guided the survey; no extracted paper artwork is used as a texture.

</details>
