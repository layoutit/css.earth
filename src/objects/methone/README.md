# Methone

## Sources

- Methone uses its measured smooth ellipsoid and a **Monochrome** Cassini view.

- [Thomas et al. (2013)](https://doi.org/10.1016/j.icarus.2013.07.022) give semi-axes 1.94 ± 0.02, 1.29 ± 0.04 and 1.21 ± 0.02 km, with a mean radius of 1.45 ± 0.03 km.

- The selected exposure midpoint is 2012-05-20T07:09:49.699 UTC.

## Evidence

- The mission `methone_mst2013.bpc`, `cas_rocks_v18.tf`, reconstructed spacecraft CK and ISS frame/instrument kernels independently fix the north clock angle at 179.9162 degrees. `survey/source-camera.json` records the matrix, exact kernel URLs and pins, midpoint and extraction convention.

- The native boundary residual is 1.97 pixels.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 1 | 0 | — | — | — | none (one frame and no reference observation) | 0 of 0 | — | 0 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- Three source pixels at the edge are withheld for this pointing/shape uncertainty. This is a refined pointing fit, not an independently controlled cartographic solution.

- **Faithfulness status:** The Monochrome lens remains a coarse observation with an ellipsoid limb/terminator fit only. It is not promoted as feature-registered photography until independent surface control is available.

- Phase-function and detailed material scattering are not recovered, so the result is an approximate reflectance presentation, not absolute calibrated albedo at zero phase.

- Display orientation therefore retains the measured 2012 pose, explicitly frozen; it does not extrapolate a rotation phase to 2026.

- Its compact fit uses SAT415 samples from 2005–2018 and has a maximum independent-epoch position residual of about 17,511 km. The 2026 orbit is extrapolated beyond that source window; it is an approximate system visualization, not a precise current ephemeris.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="methone-sources-and-interpretation"></a>

Current [NAIF PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) uses the same BODY632_RADII. The analytic radius table preserves these axes; the reference radius sets world scale without renormalizing the shape. The 5-degree source table is reduced to 480 native `u` leaves. No local relief is inferred from image brightness.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

## Image geometry and coverage

OPUS provides observer and Sun planetocentric latitudes and west-positive longitudes, and 4,454.706 km center distance. `survey/observation-metadata.json` preserves them.

The image center is fitted to the measured ellipsoid's illuminated limb and terminator, holding those physical and mission parameters fixed. Camera west longitudes are converted to east-positive mesh coordinates by the shared recipe.

CISSCAL's attached VICAR header owns the raster offset: 8,192 bytes, little-endian float32, 1,024 square. The detached label's older record pointer is not used to read the binary telemetry as pixels. Edge-connected I/F below 0.012 defines sky; isolated dark observed samples are retained. Incidence above 75 degrees, emission above 72 degrees, and corrections greater than 2.5 are withheld. The same standard grid marks gaps on surface, poles, thumbnail, minimap and full-silhouette context portrait.

## Photometry and display

The shared preparer applies a 50:50 Lommel–Seeliger/Lambert disk correction to linear I/F before encoding. Its disk factor is normalized at normal incidence and emission. The display range is 0–0.505 I/F, the 99.5th percentile of displayed samples, shown linearly; one observation needs no level matching.

The real leading-side oval remains darker. The published comparison finds an approximately 13% contrast and notes that small isolated image spots are not reproducible between frames. Such detector artifacts are not interpreted as craters. No texture sharpening, invented terrain or reconstructed shadowed surface is added. Flood and directional Shadows use the shared mesh lighting.

The binary rotation model covers 2004–2018. The source-image projection still uses the true capture geometry. Orbital propagation is owned by the shared astronomy package.

</details>
