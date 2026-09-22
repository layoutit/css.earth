# Larissa

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- **[Voyager archive](https://pds-rings.seti.org/voyager/iss/):** **Monochrome:** Voyager clear-filter frame C1138148.

- **Elevation:** Stooke `n7larissa.tab`, radial height relative to 96 km, displayed from −12 to +12 km.

## Evidence

- The authored solutions and sky samples are in [source/geometry/registration.json](source/geometry/registration.json); these are not modern photogrammetric control.

- **Faithfulness status:** The Monochrome lens is retained as a coarse limb-pointed observation. No independently controlled surface feature fit is claimed, so the photographic surface is deferred under the catalog registration rule.

- Display ephemerides use the vendored astronomy package; Larissa's fitted precessing orbit has a measured maximum position residual of 472 km over the checked 1900–2100 Horizons fixture epochs.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` | 1 | 0 | — | — | — | none (one frame and no reference observation) | 0 of 0 | — | 1 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- **Photographic resolution:** About 3.54 km per geometrically corrected pixel (4.18 km/native pixel), leaving only roughly 50–60 samples across the visible disc.

- Unseen shape is modelled, not measured local topography.

- **Illumination correction:** This improves presentation, not a calibrated albedo inversion.

- **Elevation:** It communicates broad shape, not a geoid, altimetry, or a high-resolution terrain survey.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="larissa-sources"></a>

## Selected views and limits

- Close zoom is necessarily soft; no procedural crater detail is added.

- The displayed shape uses 600 triangles with a 1.8 km simplification-error ceiling, below the 2,000-leaf budget.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

## Source interpretation

The PDS4 Stooke archive supplies a 5-degree west-positive longitude / planetocentric latitude / radius grid in kilometres. Preserve its origin (which is not necessarily the centre of figure), weld its duplicated seam and poles, and triangulate the published grid. This gives 2,522 vertices and 5,040 source triangles. Meshoptimizer simplifies that source before UV/lighting baking. The archive warns that the old model can exaggerate facets and depressions.

Camera input is the original calibrated and geometrically corrected Voyager **GEOMED** VICAR product: 1,000 × 1,000 signed HALF samples, LOW byte order, explicit FICOR I/F multiplier. Camera scale is 7.841764329 microradians per corrected pixel. The attached raster header owns layout. OPUS supplies observer/Sun body coordinates and range; PDS ISS SEDR CK supplies image rotation. The original SEDR pointing is approximate, so image-centre translation is refined against sunlit limb gradients with orientation, range and shape held fixed.

A measured constant sky median is subtracted before the existing bounded lunar-Lambert illumination normalization (weight 0.5, maximum gain 2.5; incidence/emission below 75 degrees). Cast shadows, low-signal boundaries and unreliable samples remain gaps. No unseen terrain is painted into the photographic lens. Shared flood lighting and directional Shadows both remain available.

Elevation is radius relative to the stated reference sphere, coloured with the shared elevation palette and prepared relief. The minimap, surface, native triangle atlases and navigation portrait use the same interpretation. Navigation keeps the complete model silhouette while marking photographic gaps.

## Sources and restoration

- [Stooke PDS release](https://sbn.psi.edu/pds/resource/stkshape.html), Stooke (2025), DOI **10.26033/yt84-5y91**; underlying research: Stooke (1994), DOI 10.1007/BF00572198.

- [PDS Voyager processing](https://pds-rings.seti.org/voyager/iss/calib_images.html) and [ISS pointing kernels](https://pds-rings.seti.org/voyager/ck/).

- Geometry files preserve the original OPUS responses, PDS CK and NAIF clock/frame/leap-second kernels. `source/shape/pck00011.tpc` owns pole/spin conventions. Do not claim navigation ephemeris precision beyond the recorded model budget.

- `source/manifest.json` pins the original inputs and authored documents; `source/preparation/acquisition.json` restores missing image, radius-table and font inputs. Required small geometry documents and the pinned navigation portrait are checked in, so a fresh source restore does not depend on an ignored generated image.

Source preparation owns every image, triangle and lighting raster; the generic runtime only decodes the prepared package.

</details>
