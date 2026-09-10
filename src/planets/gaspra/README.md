# Gaspra

## Sources

| View or property | Source and interpretation |
| --- | --- |
| SSI reflectance | Galileo clear-filter [107318326](source/observations/107318326rcal_clr.xml) and [107318313](source/observations/107318313rcal_clr.xml), 29 October 1991, about 54 m/pixel. Original I/F and acquisition illumination; fixed display stretch, no fitted gain. |
| Monochrome and shape | [Thomas PDS release](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/). The processed high-pass mosaic adds mapped coverage; it is not calibrated albedo. |
| Elevation | Thomas shape radius minus 6.1 km, false color from −2 to +5 km; not gravitational height. |

## Evidence

[The 9 September 2026 mosaic report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/README.md) records 107 focused tests, 60 browser conformance cases, DPR 1/2 production checks and fresh remote installation for the four-body change. [Validation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids/evidence/spacecraft-mosaics/validation.json) identifies tested commit `8ded7a5` and base `1fb76e4`; these are historical results.

The broader preparation suite was not green (1,666/1,957 passed); global platform and shell audits were stopped. A later overview/navigation change was outside the tested implementation.

## Known problems

Coverage remains partial and the grid marks gaps. The Thomas mosaic retains photographed shadows, seams and oversampled detail; 64.6022% of its cylindrical pixels are missing, not a surface-area percentage. Its north-up array interpretation overrides a conflicting PDS4 display label.

Image 107315039 failed to establish four separate registration checks at the retained tolerance and is excluded. The two selected photographs supersede the older single-image presentation; their Thomas-mosaic registration checks share mission observations and are not independent absolute cartography.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

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

Survey completed 2026-09-07. Authoritative labels and relevant descriptions are pinned in `source/reference/`.

| Candidate | Contribution and disposition |
| --- | --- |
| [Thomas optical shape and mosaic](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/) | **Included.** The 2° planetocentric radius table derives from Galileo stereogrammetry and limb matching. Its associated 720×360, 2 pixels/degree mosaic uses SSI images 107318313 and 107318326, with best source detail about 55 m/pixel. Exact zero explicitly marks poor or missing coverage. |
| [Stooke shape](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/951gaspra.xml) | **Excluded in favor of the registered Thomas pair.** A coarser 5° model with a documented modification for light-curve agreement. Its newer publication date does not mean better spatial sampling; the model changes are separate from the Thomas mosaic's source geometry. |
| [Stooke global mosaics and detailed sheets](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html#gaspra) | **Inspected; deferred as a replacement.** They add low-resolution coverage and finer display sampling, based on Thomas positional control. The 3600×1800 cylindrical source is pinned as a comparison. It mixes strongly oversampled imagery, seams and gray gaps without a supplied validity mask identified in this survey. The Thomas map provides explicit missing-data semantics and a directly associated shape. The Stooke image independently supports north-up, east-right array orientation. |
| [Radiometrically calibrated Galileo SSI images](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.ssi.cal-images/) | **Included as a separate I/F view:** the selected clear-filter pair, using the camera catalog accompanying the Thomas shape. The archive’s nadir calibration workaround prevents its own geometry calculation; it is not a ready global texture. See the registration and quality checks below. |
| [2026 color/geometry cubes](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.color_geom_cubes_v1.0/) | **Deferred, useful future source.** Six 150×150 color/angle cubes and 350×350 geometry cubes, spatially registered by assumed translations and tied to the Thomas model. They contain calibrated six-filter radiance plus incidence/emission/phase, but no latitude/longitude backplanes or photometric correction. A new camera-to-shape registration would be required; this release is not treated as missing or as a ready global color map. |
| [NIMS spectral image cube](https://sbn.psi.edu/pds/resource/gaspracube.html) and [point spectra](https://sbn.psi.edu/pds/resource/gaspraspec.html) | **Excluded from these surface views.** They are valuable infrared measurements, but point-perspective spectral/point observations are not a global optical surface or elevation map. No composition or thermal lens is inferred from them. |

**Coordinates and interpretation**

The selected shape contains 16,471 rows: 91 latitudes and 181 longitudes at 2° spacing, including a repeated longitude seam and consistent poles. Values are radii in kilometers, converted to meters in preparation. The source longitude is positive west and is converted once to the renderer's east-positive body frame. Radius spans 4.1442–10.7966 km; there is no ellipsoid substitution. The complete released grid includes regions with weaker observational constraints, which are not claimed to be equally well measured.

**Physical frame and geometry**

[NAIF pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), pinned here, gives BODY9511010 pole RA 9.47°, Dec 26.70°, and W = 83.67° + 1226.9114850° × d at J2000 TDB. The shared preparation approximates TDB as TT. Horizons confirms the 6.1 km radius and approximately 7.042 hour rotation; GM is unavailable, so no mass is invented. The shared orbital context owns the pinned osculating elements and epoch.

The full 90×180 sampled grid yields 32,040 triangles and 16,022 welded vertices before official meshoptimizer 1.2.0 simplification. The selected 800-face mesh uses native PolyCSS `u` raster triangles with 128-pixel cells, packed into 2048×6400 atlases. The 200 m library error allowance with `ErrorAbsolute` and `RegularizeLight` reaches an estimated 122.743 m. This estimate is not a guaranteed maximum radial deviation. A separate 3,200 equal-area ray sample finds mean 34.708 m, p95 87.307 m, p99 120.456 m and maximum 202.662 m error with zero missed rays. The mesh is closed and consistently wound: 402 vertices, 1,200 edges, 800 faces, one component, Euler characteristic 2.

**First calibrated image (retained source record)**

**Historical single-image record (2026-09-08):** The first calibrated-image preparation used the original Domingue/GLLSSICAL I/F FITS `107318326rcal_clr.fit`, clear filter, acquired 1991-10-29T22:26:15.149Z. It retains the observation's illumination and applies only a fixed 0–0.12 I/F display stretch with gamma 2.2. It does not recover albedo or fill the unseen hemisphere. The original high-pass mosaic remains the default view.

The Thomas shape's accompanying image catalog supplies observer and Sun coordinates, range (5,288 km), north azimuth and body-centre detector coordinates. Catalog samples/lines are treated as one-based; FITS detector rows are used in their stored order, checked directly against the original image. The pinned Galileo SSI instrument kernel supplies 1501.039 mm focal length and 0.01524 mm pixels. The individual calibrated-image labels use an earlier body frame and are not substituted for the shape's control catalog.

No local camera fitting or image warping is performed. Four spatially separated, withheld 32×32 image patches are checked against the published Thomas mosaic projected through the complete 32,040-triangle source mesh. The existing DoG/zero-mean normalized correlation method searches ±24 pixels; every correlation exceeds 0.7. RMS residual is 0.866026 source pixels and maximum is 1.000000; four pixels is the acceptance limit, approximately 216 m. These check the archived registration, not independent absolute ground truth: the mosaic uses the same mission observations. Profiles, exact input hashes and results are in `source/reference/calibrated-registration*.json`. Reproduce with `python tools/objects/terrestrial-layers/verify-catalog-camera.py src/planets/gaspra/source OUTPUT_DIRECTORY` (numpy, scipy, astropy and Pillow; Node on PATH).

Quality comes from the original `e8326.fit` detector data and `gaspbad.tab` bad-data blocks, not a brightness threshold. All recorded dropouts, saturated/low-full-well pixels, spikes and Reed–Solomon overflow are withheld, as are raw DN 255 and ISIS special values. The calibrated and raw labels must agree on observation identity, time, target and filter. Finite calibrated zero remains an eligible measurement. Bad-data rectangles use one-based inclusive line/sample coordinates; duplicate records are harmless. Archived lossy compression is retained and is not described as lossless.

Projection uses the source mesh's visibility and terrain-shadow rays, incidence/emission limits of 65°, and a five-pixel inset around detector edges and flagged gaps. These conservative margins limit uncertain limb transfer. The pinhole control is checked at source resolution; the SSI kernel's small radial distortion is not applied to the catalog's controlled image coordinates. Any remaining distortion is included in the measured residuals at the checked patches; this does not establish an exact error bound everywhere. The display mesh keeps its existing 800 native PolyCSS `u` raster faces and 128-pixel cells. Raster coverage counts refer to the cylindrical preparation grid, not physical surface area. Shadows default off.

**Spacecraft mosaic update (2026-09-09)**

Reproduce the added registration check with `python tools/objects/terrestrial-layers/verify-catalog-camera.py src/planets/gaspra/source OUTPUT --frame 107318313 --profile reference/registration-107318313.json`. The existing contribution audit is `node tools/objects/terrestrial-layers/audit-camera-mosaic.mts src/planets/gaspra/source OUTPUT`; it records matched area-weighted before/after sampling and lossless Float32 contribution planes. The audit grids use the authored 4096×2048 cylindrical sampling, not atlas texel counts as surface area.

The original calibrated FITS/XML and raw detector FITS/label are pinned separately. Target, exact time, filter and spacecraft clock bind them to the archived `gaspbad.tab` block mask. The original four-pixel registration limit and five-pixel boundary inset remain. Four separated 16×16 patches on image 107318313 give 2.646 px RMS and 3.162 px maximum error with no local camera fitting. They check registration against the Thomas mosaic on the full original shape; that mosaic shares these photographs and is not independent absolute cartography.

The SSI reflectance view now combines the complementary clear-filter close-ups **107318326** and **107318313**, both approximately 54 m/pixel. The second image restores photographic coverage at the other end of Gaspra. There is one reflectance dataset row. Thomas’s processed Monochrome mosaic remains because it supplies additional mapped coverage; it is not interchangeable with calibrated I/F.

Gaspra uses the published Thomas optical shape and registered Galileo SSI high-pass monochrome mosaic. Elevation is radial height from that shape. No photographic texture or terrain is synthesized to fill missing observations.

Elevation colors encode radius minus the 6.1 km reference sphere, using a -2 to +5 km palette. They include the body's overall irregular shape and do not represent height above a gravitational equipotential. Cartographic relief is computed from the source field. Both views retain the shared Shadows control; directional lighting is a prepared diffuse approximation at the shared world epoch and cannot remove photographed shadows or model all terrain self-occlusion.

Both included photographs retain original illumination and the same fixed calibrated display transfer. No relative gain is fitted. The existing coarse-to-fine projection blends only near its geometric and detector boundaries. Run the contribution audit below to retain the actual weights for both sources.

Clear-filter image 107315039 was also downloaded and tested. Its useful detector footprint did not establish four separate registration checks at the retained tolerance, so it is excluded. Earlier lower-resolution clear images are listed in the archive inventory but do not replace the complementary close-up pair.

The mosaic has a material metadata conflict. Its PDS4 generic display section says bottom-to-top, but its bytes, the source observation geometry and the independently published Stooke cylindrical map support row zero at the north and columns increasing east. The PDS3 original label has no array row-direction statement. West-positive coordinate labels do not imply westward-increasing image columns. See `source/reference/registration.md` and its pinned diagnostic data. The observation recipe therefore uses `rowOrder: north-to-south` and `longitudeDirection: east` for array sampling; the shape retains west-positive longitude.

The monochrome view displays the published 8-bit high-pass values without attempting calibrated albedo recovery. It retains photographed illumination, source seams, and oversampled low-detail regions. Exactly 167,449 of 259,200 source pixels are zero (64.6022% of the unweighted cylindrical raster, not a surface-area fraction). All four interpolation samples must be valid before a display pixel is accepted. Missing regions use the shared neutral grid and keep the known silhouette. The 2048×1024 prepared map adds display sampling, not new measured detail.

</details>
