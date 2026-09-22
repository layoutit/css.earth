# Gaspra

## Sources

The panel's editorial credit is NASA's Galileo mission page: <https://science.nasa.gov/mission/galileo/>.

| View or property | Source and interpretation |
| --- | --- |
| SSI reflectance | Galileo clear-filter [107318326](source/observations/107318326rcal_clr.xml) and [107318313](source/observations/107318313rcal_clr.xml), 29 October 1991, about 54 m/pixel. I/F normalized to 50° incidence and phase with a published Hapke model; fixed display stretch, no fitted gain. |
| Monochrome and shape | [Thomas PDS release](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/). The processed high-pass mosaic adds mapped coverage; it is not calibrated albedo. |
| Elevation | Thomas shape radius minus 6.1 km, false color from −2 to +5 km; not gravitational height. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/GASPRA/target) Gaspra centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 720 × 360 | 0.76 → 1.23 MB |

Each atlas remains 2048 × 6400 pixels, with 800 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/gaspra/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

[The 9 September 2026 mosaic report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/README.md) records 107 focused tests, 60 browser conformance cases, DPR 1/2 production checks and fresh remote installation for the four-body change. [Validation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/validation.json) identifies tested commit `8ded7a5` and base `1fb76e4`; these are historical results.

The broader preparation suite was not green (1,666/1,957 passed); global platform and shell audits were stopped. A later overview/navigation change was outside the tested implementation.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `calibrated` | 2 | 0 | — | — | — | its other 2 frames | 0 of 2 | — | 0 of 2 | — | ×1.00 | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Gaspra (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (this export ships no projection file, so the metadata datum is recorded and the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 1 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

Coverage remains partial and the grid marks gaps. The Thomas mosaic retains photographed shadows, seams and oversampled detail; 64.6022% of its cylindrical pixels are missing, not a surface-area percentage. Its north-up array interpretation overrides a conflicting PDS4 display label.

Image 107315039 failed to establish four separate registration checks at the retained tolerance and is excluded. The two selected photographs supersede the older single-image presentation; their Thomas-mosaic registration checks share mission observations and are not independent absolute cartography.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="gaspra-source-record"></a>
<a id="source-survey-and-selection"></a>
<a id="coordinates-and-interpretation"></a>
<a id="physical-frame-and-geometry"></a>
<a id="first-calibrated-image-retained-source-record"></a>
<a id="reproduction-and-qualification"></a>
<a id="spacecraft-mosaic-update-2026-09-09"></a>

<details>
<summary>Methods and source notes</summary>

**Source survey and selection**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Coordinates and interpretation**

The selected shape contains 16,471 rows: 91 latitudes and 181 longitudes at 2° spacing, including a repeated longitude seam and consistent poles. Values are radii in kilometers, converted to meters in preparation. The source longitude is positive west and is converted once to the renderer's east-positive body frame. Radius spans 4.1442–10.7966 km; there is no ellipsoid substitution. The complete released grid includes regions with weaker observational constraints, which are not claimed to be equally well measured.

**Physical frame and geometry**

[NAIF pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), pinned here, gives BODY9511010 pole RA 9.47°, Dec 26.70°, and W = 83.67° + 1226.9114850° × d at J2000 TDB. The shared preparation approximates TDB as TT. Horizons confirms the 6.1 km radius and approximately 7.042 hour rotation; GM is unavailable, so no mass is invented. The shared orbital context owns the pinned osculating elements and epoch.

The full 90×180 sampled grid yields 32,040 triangles and 16,022 welded vertices before official meshoptimizer 1.2.0 simplification. The selected 800-face mesh uses native PolyCSS `u` raster triangles with 128-pixel cells, packed into 2048×6400 atlases. The 200 m library error allowance with `ErrorAbsolute` and `RegularizeLight` reaches an estimated 122.743 m. This estimate is not a guaranteed maximum radial deviation. A separate 3,200 equal-area ray sample finds mean 34.708 m, p95 87.307 m, p99 120.456 m and maximum 202.662 m error with zero missed rays. The mesh is closed and consistently wound: 402 vertices, 1,200 edges, 800 faces, one component, Euler characteristic 2.

**First calibrated image (retained source record)**

**Historical single-image record (2026-09-08):** The first calibrated-image preparation used the original Domingue/GLLSSICAL I/F FITS `107318326rcal_clr.fit`, clear filter, acquired 1991-10-29T22:26:15.149Z. It retains the observation's illumination and applies only a fixed 0–0.12 I/F display stretch with gamma 2.2. It does not recover albedo or fill the unseen hemisphere. The original high-pass mosaic remains the default view.

The Thomas shape's accompanying image catalog supplies observer and Sun coordinates, range (5,288 km), north azimuth and body-centre detector coordinates. Catalog samples/lines are treated as one-based; FITS detector rows are used in their stored order, checked directly against the original image. The pinned Galileo SSI instrument kernel supplies 1501.039 mm focal length and 0.01524 mm pixels. The individual calibrated-image labels use an earlier body frame and are not substituted for the shape's control catalog.

No local camera fitting or image warping is performed. Four spatially separated, withheld 32×32 image patches are checked against the published Thomas mosaic projected through the complete 32,040-triangle source mesh. The existing DoG/zero-mean normalized correlation method searches ±24 pixels; every correlation exceeds 0.7. RMS residual is 0.866026 source pixels and maximum is 1.000000; four pixels is the acceptance limit, approximately 216 m. These check the archived registration, not independent absolute ground truth: the mosaic uses the same mission observations. Profiles, exact input hashes and results are in `source/reference/calibrated-registration*.json`. Reproduce with `python tools/objects/terrestrial-layers/verify-catalog-camera.py src/objects/gaspra/source OUTPUT_DIRECTORY` (numpy, scipy, astropy and Pillow; Node on PATH).

Quality comes from the original `e8326.fit` detector data and `gaspbad.tab` bad-data blocks, not a brightness threshold. All recorded dropouts, saturated/low-full-well pixels, spikes and Reed–Solomon overflow are withheld, as are raw DN 255 and ISIS special values. The calibrated and raw labels must agree on observation identity, time, target and filter. Finite calibrated zero remains an eligible measurement. Bad-data rectangles use one-based inclusive line/sample coordinates; duplicate records are harmless. Archived lossy compression is retained and is not described as lossless.

Projection uses the source mesh's visibility and terrain-shadow rays, incidence/emission limits of 65°, and a five-pixel inset around detector edges and flagged gaps. These conservative margins limit uncertain limb transfer. The pinhole control is checked at source resolution; the SSI kernel's small radial distortion is not applied to the catalog's controlled image coordinates. Any remaining distortion is included in the measured residuals at the checked patches; this does not establish an exact error bound everywhere. The display mesh keeps its existing 800 native PolyCSS `u` raster faces and 128-pixel cells. Raster coverage counts refer to the cylindrical preparation grid, not physical surface area. Shadows default off.

**Spacecraft mosaic update (2026-09-09)**

Reproduce the added registration check with `python tools/objects/terrestrial-layers/verify-catalog-camera.py src/objects/gaspra/source OUTPUT --frame 107318313 --profile reference/registration-107318313.json`. The prepared observation report records each frame's share of the displayed surface from equal-area samples (`areaCoverage`), and the atlas observation index names the photograph behind every texel.

The original calibrated FITS/XML and raw detector FITS/label are pinned separately. Target, exact time, filter and spacecraft clock bind them to the archived `gaspbad.tab` block mask. The original four-pixel registration limit and five-pixel boundary inset remain. Four separated 16×16 patches on image 107318313 give 2.646 px RMS and 3.162 px maximum error with no local camera fitting. They check registration against the Thomas mosaic on the full original shape; that mosaic shares these photographs and is not independent absolute cartography.

The SSI reflectance view now combines the complementary clear-filter close-ups **107318326** and **107318313**, both approximately 54 m/pixel. The second image restores photographic coverage at the other end of Gaspra. There is one reflectance dataset row. Thomas’s processed Monochrome mosaic remains because it supplies additional mapped coverage; it is not interchangeable with calibrated I/F.

Gaspra uses the published Thomas optical shape and registered Galileo SSI high-pass monochrome mosaic. Elevation is radial height from that shape. No photographic texture or terrain is synthesized to fill missing observations.

Elevation colors encode radius minus the 6.1 km reference sphere, using a -2 to +5 km palette. They include the body's overall irregular shape and do not represent height above a gravitational equipotential. Cartographic relief is computed from the source field. Both views retain the shared Shadows control; directional lighting is a prepared diffuse approximation at the shared world epoch and cannot remove photographed shadows or model all terrain self-occlusion.

Both photographs are normalized to 50° incidence, 0° emission and 50° phase with the Hapke model of [Helfenstein et al. (1994)](https://doi.org/10.1006/icar.1994.1005). The abstract gives single-scattering albedo 0.36, shadow-hiding amplitude 1.63 and roughness 29°; the compilation of Hasselmann et al. (2016, Table 7) adds width 0.06 and Henyey–Greenstein asymmetry −0.18. [The model record](source/photometry/helfenstein-1994-hapke.json) cites both. The fit combined Earth-based photometry at 2–25° phase with Galileo data at 33–51°. The clear-filter frames lie at about 51° phase, so the 48–54° phase limit extrapolates the model by up to 3°, and the tabulated 0.56 µm fit is narrower than the clear filter's band. Incidence and emission stay limited to 65°, and gains to 0.4–4; no sample needed withholding. Overlap level matching, fitted where both frames see the surface within 70° of incidence and emission, gives the second frame a gain of 1.014. The display range is 0–0.0902 I/F, the 99.5th percentile of displayed samples, shown linearly. Where the frames overlap, each point keeps the finer photograph.

Clear-filter image 107315039 was also downloaded and tested. Its useful detector footprint did not establish four separate registration checks at the retained tolerance, so it is excluded. Earlier lower-resolution clear images are listed in the archive inventory but do not replace the complementary close-up pair.

The mosaic has a material metadata conflict. Its PDS4 generic display section says bottom-to-top, but its bytes, the source observation geometry and the independently published Stooke cylindrical map support row zero at the north and columns increasing east. The PDS3 original label has no array row-direction statement. West-positive coordinate labels do not imply westward-increasing image columns. See `source/reference/registration.md` and its pinned diagnostic data. The observation recipe therefore uses `rowOrder: north-to-south` and `longitudeDirection: east` for array sampling; the shape retains west-positive longitude.

The monochrome view displays the published 8-bit high-pass values without attempting calibrated albedo recovery. It retains photographed illumination, source seams, and oversampled low-detail regions. Exactly 167,449 of 259,200 source pixels are zero (64.6022% of the unweighted cylindrical raster, not a surface-area fraction). All four interpolation samples must be valid before a display pixel is accepted. Missing regions use the shared neutral grid and keep the known silhouette. The 2048×1024 prepared map adds display sampling, not new measured detail.

</details>
