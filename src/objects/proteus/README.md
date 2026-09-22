# Proteus

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- **[Voyager archive](https://pds-rings.seti.org/voyager/iss/):** **Monochrome:** clear-filter frames C1137317 and C1138920.

- **False color:** original green C1137350, blue C1137339 and violet C1137328 shown as red, green and blue, with one independently registered camera per band.

- **Elevation:** Stooke `n8proteus.tab`, radial height relative to 208 km, displayed from −35 to +25 km.

## Evidence

The 2026-09-13 [color-encoding capture](evidence/filter-color/capture.json) checks the revised surface at DPR 1 and 2, dragging, Shadows, and the mobile selector. Its source/asset hashes identify the tested uncommitted changes above `8cc1a2fae`; retained geometry is identical to that baseline. [Image delivery](evidence/filter-color/delivery.json) verifies the current immutable URLs by byte count and SHA-256. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

[Displayed surface](evidence/filter-color/color-dpr1.png) · [DPR 2](evidence/filter-color/color-dpr2.png) · [Shadows](evidence/filter-color/oblique-shadows-dpr1.png) · [Mobile](evidence/filter-color/mobile.png). This display repair does not promote the existing coarse registration to feature-controlled photographic terrain.

- **Color registration:** Nominal held-out RMS errors are violet 1.18, blue 1.34 and green 1.64 corrected pixels.

- The focused object tests independently check signed DN/I/F samples in all three bands and exercise the real three-camera intersection, including complete loss of coverage when one band is absent.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 2 | 0 | — | — | — | its other 2 frames | 0 of 2 | — | 1 of 2 | — | no overlap, 2 unjoined groups | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The close frame provides about 1.14 km per geometrically corrected pixel; the other hemisphere is about 6.81 km/pixel. The close image has strong dark-current background and low signal-to-noise; grain and differing resolution are source limitations.

- This is a coarse filter-color observation, not true color or a calibrated albedo map. Only the common reliable interior is mapped; roughly 40 km or coarser near the image centre is a conservative interpretation scale.

- **Faithfulness status:** The Monochrome and False color lenses retain broad observed brightness, but their outline/inter-band checks do not provide independent cartographic feature control. They are coarse observations, not feature-registered photographic surfaces.

- Unseen shape is modelled, not measured local topography. The authored six-pixel envelope is conservative working uncertainty, not a confidence interval or absolute ground truth.

- The applied illumination model is a display normalization, not an albedo inversion.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="proteus-sources"></a>

## Selected views and limits

- Native detector scale is respectively 1.35 and 8.03 km/pixel. It is not an HD terrain survey.

- The displayed shape uses 1,100 triangles with a 2 km simplification-error ceiling, below the 2,000-leaf budget.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

## Source interpretation

The PDS4 Stooke archive supplies a 5-degree west-positive longitude / planetocentric latitude / radius grid in kilometres. Preserve its origin (which is not necessarily the centre of figure), weld its duplicated seam and poles, and triangulate the published grid. This gives 2,522 vertices and 5,040 source triangles. Meshoptimizer simplifies that source before UV/lighting baking. The archive warns that the old model can exaggerate facets and depressions.

Camera input is the original calibrated and geometrically corrected Voyager **GEOMED** VICAR product: 1,000 × 1,000 signed HALF samples, LOW byte order, explicit FICOR I/F multiplier. Camera scale is 7.841764329 microradians per corrected pixel. The attached raster header owns layout. OPUS supplies observer/Sun body coordinates and range; PDS ISS SEDR CK supplies image rotation. The original SEDR pointing is approximate, so image-centre translation is refined against sunlit limb gradients with orientation, range and shape held fixed. The authored solutions and sky samples are in `source/geometry/registration.json`; these are not modern photogrammetric control.

A measured constant sky median is subtracted before the existing bounded lunar-Lambert illumination normalization (weight 0.5, maximum gain 2.5; incidence/emission below 75 degrees). This improves presentation, not a calibrated albedo inversion. Cast shadows, low-signal boundaries and unreliable samples remain gaps. No unseen terrain is painted into the photographic lens. Shared flood lighting and directional Shadows both remain available.

Elevation is radius relative to the stated reference sphere, coloured with the shared elevation palette and prepared relief. It communicates broad shape, not a geoid, altimetry, or a high-resolution terrain survey. The minimap, surface, native triangle atlases and navigation portrait use the same interpretation. Navigation keeps the complete model silhouette while marking photographic gaps.

## Coarse filter-color registration

Each color frame is the original 1,000×1,000 signed HALF GEOMED product. FICOR77 dark-current subtraction and its explicit multiplier give I/F = DN × 0.0001. The archive [PROCESSING.TXT](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8207/DOCUMENT/PROCESSING.TXT) describes signed calibration, reseau/blemish repair and interpolation across missing raw strips. These standard processed products retain blur, noise and possible repair artifacts; they are not raw detector coverage masks. No special missing constant is declared for GEOMED. Exterior zero padding and connected low-signal sky are masked before signed finite interior contributors are interpolated. Negative values are not automatically missing; only final display values are clamped.

`source/geometry/color-registration.json` records a translation fit to the full 5,040-triangle source outline, with OPUS observer/Sun directions and range and SEDR CK/PCK roll fixed. Alternating 45-degree sunlit sectors fit the centre; the intervening sectors are withheld. Four additional ±2-pixel initializations change the fitted centres by less than 0.35 pixel; the largest held-out discrepancy across those runs is 4.6 pixels. A nine-pixel Manhattan inset guarantees at least 6.36 pixels of Euclidean separation from known invalid boundaries. No new fit is adopted for the noisy closest clear frame.

Independent sky samples are retained in `source/geometry/color-background.json`: medians −0.0017, −0.0011 and −0.0037 I/F for violet, blue and green, respectively. Subtract each measured offset, use its own three-MAD-sigma sky threshold, and require all three band masks and complete bilinear contributors to be valid. A common display range of 0–0.10 I/F maps floating samples to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). This display follows bounded lunar-Lambert normalization (weight 0.5, gain at most 2.5, incidence/emission at most 60°). Channel gains remain exactly 1; this does not white-balance, histogram-match or pan-sharpen the observations.

The reproducible source check is `python source/preparation/register-voyager-color.py source` from this package with numpy, spiceypy and Node available. It verifies source hashes and compares the retained registration receipt without changing images. `--write` regenerates only that receipt; the source manifest must then be repinned deliberately.

## Sources and restoration

- [Stooke PDS release](https://sbn.psi.edu/pds/resource/stkshape.html), Stooke (2025), DOI **10.26033/yt84-5y91**; underlying research: Stooke (1994), DOI 10.1007/BF00572198.

- [PDS Voyager processing](https://pds-rings.seti.org/voyager/iss/calib_images.html) and [ISS pointing kernels](https://pds-rings.seti.org/voyager/ck/).

- Geometry files preserve the original OPUS responses, PDS CK and NAIF clock/frame/leap-second kernels. `source/shape/pck00011.tpc` owns pole/spin conventions. The displayed ephemeris and IAU/WGCCRE spin use the vendored astronomy package and are separate from the 1989 image-registration inputs.

- `source/manifest.json` pins the original inputs and authored documents; `source/preparation/acquisition.json` restores missing image, radius-table and font inputs. Required small geometry documents and the pinned navigation portrait are checked in, so a fresh source restore does not depend on an ignored generated image.

Source preparation owns every image, triangle and lighting raster; the generic runtime only decodes the prepared package.

</details>
