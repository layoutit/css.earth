# Larissa sources

## Selected views and limits

- **Monochrome:** Voyager clear-filter frame C1138148. About 3.54 km per geometrically corrected pixel (4.18 km/native pixel), leaving only roughly 50–60 samples across the visible disc. Close zoom is necessarily soft; no procedural crater detail is added.
- **Elevation:** Stooke `n7larissa.tab`, radial height relative to 96 km, displayed from −12 to +12 km. The displayed shape uses 600 triangles with a 1.8 km simplification-error ceiling, below the 2,000-leaf budget.

## Candidate survey

| Candidate | Decision |
| --- | --- |
| [Voyager ISS archive](https://pds-rings.seti.org/voyager/iss/), C1138148 | Included: resolved clear-filter image with recoverable geometry. |
| C1138142 and C1138153 | Inspected archive frames. Excluded: repeated similar coverage or much coarser wide-angle sampling; no distinct dataset or useful added detail. |
| Stooke global radius grid and shaded-relief drawings | Radius grid included as shape/Elevation; drawings excluded as photographic imagery. |
| USGS/PDS mapping, colour, composition and altimetry searches | No additional registered scientific layer was qualified. Global radius values are a coarse shape reconstruction and must not be presented as an observed high-resolution DEM. |

## Source interpretation

The PDS4 Stooke archive supplies a 5-degree west-positive longitude / planetocentric latitude / radius grid in kilometres. Preserve its origin (which is not necessarily the centre of figure), weld its duplicated seam and poles, and triangulate the published grid. This gives 2,522 vertices and 5,040 source triangles. Meshoptimizer simplifies that source before UV/lighting baking. The archive warns that the old model can exaggerate facets and depressions. Unseen shape is modelled, not measured local topography.

Camera input is the original calibrated and geometrically corrected Voyager **GEOMED** VICAR product: 1,000 × 1,000 signed HALF samples, LOW byte order, explicit FICOR I/F multiplier. Camera scale is 7.841764329 microradians per corrected pixel. The attached raster header owns layout. OPUS supplies observer/Sun body coordinates and range; PDS ISS SEDR CK supplies image rotation. The original SEDR pointing is approximate, so image-centre translation is refined against sunlit limb gradients with orientation, range and shape held fixed. The authored solutions and sky samples are in `source/geometry/registration.json`; these are not modern photogrammetric control.

A measured constant sky median is subtracted before the existing bounded lunar-Lambert illumination normalization (weight 0.5, maximum gain 2.5; incidence/emission below 75 degrees). This improves presentation, not a calibrated albedo inversion. Cast shadows, low-signal boundaries and unreliable samples remain gaps. No unseen terrain is painted into the photographic lens. Shared flood lighting and directional Shadows both remain available.

Elevation is radius relative to the stated reference sphere, coloured with the shared elevation palette and prepared relief. It communicates broad shape, not a geoid, altimetry, or a high-resolution terrain survey. The minimap, surface, native triangle atlases and navigation portrait use the same interpretation. Navigation keeps the complete model silhouette while marking photographic gaps.

## Sources and restoration

- [Stooke PDS release](https://sbn.psi.edu/pds/resource/stkshape.html), Stooke (2025), DOI **10.26033/yt84-5y91**; underlying research: Stooke (1994), DOI 10.1007/BF00572198.
- [PDS Voyager processing](https://pds-rings.seti.org/voyager/iss/calib_images.html) and [ISS pointing kernels](https://pds-rings.seti.org/voyager/ck/).
- Geometry files preserve the original OPUS responses, PDS CK and NAIF clock/frame/leap-second kernels. `source/shape/pck00011.tpc` owns pole/spin conventions. Display ephemerides use the vendored astronomy package; Larissa's fitted precessing orbit has a measured maximum position residual of 472 km over the checked 1900–2100 Horizons fixture epochs. Do not claim navigation ephemeris precision beyond the recorded model budget.
- `source/manifest.json` pins the original inputs and authored documents; `source/preparation/acquisition.json` restores missing image, radius-table, font and starfield inputs. Required small geometry documents are checked in.

Runtime install: `pnpm setup:assets --object=larissa`.
Source restore: `node tools/objects/dist/operations.js acquire larissa`.
Rebuild: `node tools/objects/dist/prepare-authored.js larissa --write` after building the shared packages/preparation tools. Source preparation owns every image, triangle and lighting raster; the generic runtime only decodes the prepared package.
