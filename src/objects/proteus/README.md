# Proteus

## Sources

- [Voyager archive](https://pds-rings.seti.org/voyager/iss/): **Monochrome** uses clear-filter frames C1137317 and C1138920. **False color** shows original green C1137350, blue C1137339 and violet C1137328 as red, green and blue, with one independently registered camera per band. See [PDS Voyager processing](https://pds-rings.seti.org/voyager/iss/calib_images.html) and [ISS pointing kernels](https://pds-rings.seti.org/voyager/ck/).
- **Elevation** and shape: [Stooke PDS release](https://sbn.psi.edu/pds/resource/stkshape.html), Stooke (2025), DOI 10.26033/yt84-5y91; underlying research: Stooke (1994), DOI 10.1007/BF00572198. `n8proteus.tab` gives radial height relative to 208 km, displayed from −35 to +25 km.
- `source/shape/pck00011.tpc` owns pole/spin conventions. The displayed ephemeris and IAU/WGCCRE spin use the vendored astronomy package and are separate from the 1989 image-registration inputs.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

Color registration: nominal held-out RMS errors are violet 1.18, blue 1.34 and green 1.64 corrected pixels. The [shared color method](../../../docs/color-preparation.md) explains the scientific display and its limits.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 2 | 0 | — | — | — | its other 2 frames | 0 of 2 | — | 1 of 2 | — | no overlap, 2 unjoined groups | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The close frame provides about 1.14 km per geometrically corrected pixel; the other hemisphere is about 6.81 km/pixel. The close image has strong dark-current background and low signal-to-noise; grain and differing resolution are source limitations.
- This is a coarse filter-color observation, not true color or a calibrated albedo map. Only the common reliable interior is mapped; roughly 40 km or coarser near the image centre is a conservative interpretation scale.
- The Monochrome and False color datasets retain broad observed brightness, but their outline and inter-band checks do not provide independent cartographic feature control. They are coarse observations, not feature-registered photographic surfaces.
- Unseen shape is modelled, not measured local topography. The authored six-pixel envelope is conservative working uncertainty, not a confidence interval or absolute ground truth.
- The applied illumination model is a display normalization, not an albedo inversion.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Source interpretation and preparation</summary>

<a id="proteus-sources"></a>

### Shape

The Stooke archive supplies a 5-degree west-positive longitude / planetocentric latitude / radius grid in kilometres. Preparation keeps its origin (which is not necessarily the centre of figure), welds its duplicated seam and poles, and triangulates the published grid: 2,522 vertices and 5,040 source triangles. Meshoptimizer simplifies that to 1,100 displayed triangles with a 2 km simplification-error ceiling. The archive warns that the old model can exaggerate facets and depressions.

Elevation is radius relative to the stated reference sphere, colored with the shared elevation palette and prepared relief. It communicates broad shape, not a geoid, altimetry, or a high-resolution terrain survey.

### Monochrome

Camera input is the calibrated and geometrically corrected Voyager GEOMED VICAR product: 1,000 × 1,000 signed HALF samples. Native detector scale is 1.35 and 8.03 km/pixel for the two frames. OPUS supplies observer/Sun body coordinates and range; PDS ISS SEDR CK supplies image rotation. The SEDR pointing is approximate, so image-centre translation is refined against sunlit limb gradients with orientation, range and shape held fixed. The solutions and sky samples are in `source/geometry/registration.json`; these are not modern photogrammetric control.

A measured constant sky median is subtracted before bounded lunar-Lambert illumination normalization (weight 0.5, maximum gain 2.5; incidence/emission below 75 degrees). Cast shadows, low-signal boundaries and unreliable samples remain gaps. No unseen terrain is painted into the photographic dataset. Navigation keeps the complete model silhouette while marking photographic gaps.

### False color

FICOR77 dark-current subtraction gives I/F = DN × 0.0001. The archive [PROCESSING.TXT](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8207/DOCUMENT/PROCESSING.TXT) describes signed calibration, reseau/blemish repair and interpolation across missing raw strips; these products retain blur, noise and possible repair artifacts. Exterior zero padding and connected low-signal sky are masked.

`source/geometry/color-registration.json` records a translation fit to the full 5,040-triangle source outline, with OPUS observer/Sun directions and range and SEDR CK/PCK roll fixed. Alternating 45-degree sunlit sectors fit the centre; the intervening sectors are withheld. Four additional ±2-pixel initializations change the fitted centres by less than 0.35 pixel.

Measured sky medians (`source/geometry/color-background.json`) are subtracted per band, and all three band masks must be valid. A common display range of 0–0.10 I/F maps floating samples to linear display channels, followed by the [shared IEC sRGB output transfer](../../../docs/color-preparation.md). This follows bounded lunar-Lambert normalization (weight 0.5, gain at most 2.5, incidence/emission at most 60°). Channel gains stay exactly 1: no white balance, histogram matching or pan-sharpening.

### Reproduction

Run `python source/preparation/register-voyager-color.py source` from this package, after `node packages/bake/cli/restore-source-inputs.mts --object=proteus` restores its SPICE kernels, with numpy, spiceypy and Node available. It compares the retained registration receipt without changing images. `--write` regenerates only that receipt.

`source/manifest.json` records the original inputs; `source/preparation/acquisition.json` restores missing image, radius-table and font inputs.

</details>
