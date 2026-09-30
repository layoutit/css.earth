# Prometheus

Prometheus is shown on the Cassini-era PDS shape model with a monochrome photograph, a false-color filter composite and an elevation view.

## Sources

- **Monochrome** uses 7 original Cassini ISS NAC clear-filter images, calibrated by the PDS Ring-Moon Systems Node with CISSCAL 4.0beta into linear I/F.
- **False color** uses original Cassini ISS NAC filter observations displayed as RGB (IR3 / GRN / UV3), calibrated by CISSCAL 4.0beta into linear I/F. Each frame uses its own measured camera row in the [Thomas 2018 prometheus document](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/prometheus_document.pdf), registered to the matching original plate model. A second complete sequence, IR3 `N1643263159_1`, GRN `N1643263046_1` and UV3 `N1643263237_1` from January 27, 2010, adds coverage near 226°W at about 222 m per pixel.
- **Elevation** comes from the [Thomas, Joseph and Ansty (2018) PDS shape release](https://doi.org/10.26033/ewy3-jy61), shown as radial height above an explicitly chosen 43.1 km reference sphere.
- The camera focal length and pixel pitch come from the [Cassini ISS instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti): 2003.44 mm and 12 µm.
- [NASA’s Prometheus overview](https://science.nasa.gov/saturn/moons/prometheus/) supplies editorial context. JPL values in the vendored astronomy package supply the physical radius and orbit.

The first false-color sequence:

| RGB channel | Filter | Observation | Mid-time (UTC) | Approx. m/pixel at centre |
| --- | --- | --- | --- | ---: |
| red | IR3 | n1640497881 | 2009-12-26T05:07:47.899 | 339 |
| green | GRN | n1640497816 | 2009-12-26T05:06:43.669 | 339 |
| blue | UV3 | n1640497927 | 2009-12-26T05:08:29.899 | 339 |

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

## Processing

The original floating-point IMG products and their PDS labels are pinned in [the input manifest](source/manifest.json). Observation IDs and camera geometry are authored in [source/preparation/terrestrial.json](source/preparation/terrestrial.json) from Table 1 of the PDS model documentation. The camera projection intersects the original PDS shape using each observation's range, centre, projected north and observer and Sun directions. The PDF longitudes are positive west; the rendered mesh and map use positive east.

Monochrome applies a bounded Lunar-Lambert normalization to reduce photographed disk shading, with per-frame levels fitted from overlaps. An edge-connected 0.003 I/F threshold rejects faint sky noise.

False color colors only samples all three filters see, within 75° incidence and emission. One common range, 0–0.8 I/F, maps them to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). No per-band equalization or colorimetric transform is applied.

The released plate connectivity is simplified by meshoptimizer to 720 native PolyCSS triangle leaves with 128px raster cells. The surface is closed, with Euler characteristic two. The model's Archinal et al. (2011) pole and linear prime-meridian rotation are used at the shared display epoch. The final atlas is WebP quality 94. No runtime source processing is performed.

## Evidence

- The added sequence raises accepted False color coverage from **30.3% to 38.1%** of the sampled physical surface area.
- Both added filters pass held-out RMS ≤1 pixel and maximum ≤2 pixels against the new green reference. Reproduce with `node packages/bake/cli/align-camera-bands.mts src/objects/prometheus/source/preparation/coverage-registration.json output/prometheus-registration.json --check-only`. These relative checks do not reduce the published shape uncertainty.
- Across 4,096 radial rays the simplified model differs from the original by 202 m on average, 517 m at the 95th percentile and 1572 m at the largest sampled point.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 7 | 3 | 3.00° | — | — | its other 7 frames | 3 of 7 | -0.25° | 4 of 7, -6.75° | — | ×1.02, 2 unjoined groups | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The two false-color sequences have different viewing and illumination geometry and no accepted overlap for level matching, so their relative brightness is unmatched.
- The three filters were acquired one after another. The result is not a true-color photograph or a composition map. Source shadows and phase-dependent brightness remain, and small color fringes can remain at sharp relief.
- The false-color footprint is smaller than Monochrome coverage; gray grid marks gaps.
- Monochrome is an approximate reflectance presentation, not recovered albedo: the authored weight is 0.5, gain is at most 2.5, and samples beyond 80° incidence or 78° emission are withheld.
- Elevation includes the moon's elongated shape; it is not height above an equipotential. The documented model uncertainty is 0.2–0.4 km, and parts of the leading side are least constrained. Small crater morphology is not reliably encoded.
- Small optical librations and dynamical phase errors are not represented.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
