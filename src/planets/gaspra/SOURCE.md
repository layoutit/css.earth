# Gaspra source record

Gaspra uses the published Thomas optical shape and registered Galileo SSI high-pass monochrome mosaic. Elevation is radial height from that shape. No photographic texture or terrain is synthesized to fill missing observations.

## Source survey and selection

Survey completed 2026-09-07. Authoritative labels and relevant descriptions are pinned in `source/reference/`.

| Candidate | Contribution and disposition |
| --- | --- |
| [Thomas optical shape and mosaic](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/) | **Included.** The 2° planetocentric radius table derives from Galileo stereogrammetry and limb matching. Its associated 720×360, 2 pixels/degree mosaic uses SSI images 107318313 and 107318326, with best source detail about 55 m/pixel. Exact zero explicitly marks poor or missing coverage. |
| [Stooke shape](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/951gaspra.xml) | **Excluded in favor of the registered Thomas pair.** A coarser 5° model with a documented modification for light-curve agreement. Its newer publication date does not mean better spatial sampling; the model changes are separate from the Thomas mosaic's source geometry. |
| [Stooke global mosaics and detailed sheets](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html#gaspra) | **Inspected; deferred as a replacement.** They add low-resolution coverage and finer display sampling, based on Thomas positional control. The 3600×1800 cylindrical source is pinned as a comparison. It mixes strongly oversampled imagery, seams and gray gaps without a supplied validity mask identified in this survey. The Thomas map provides explicit missing-data semantics and a directly associated shape. The Stooke image independently supports north-up, east-right array orientation. |
| [Radiometrically calibrated Galileo SSI images](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.ssi.cal-images/) | **Deferred.** Real I/F images in FITS and ISIS formats, calibrated in 2013–2014. The archive documents absent viable camera kernels and a nadir-pointing calibration workaround that prevents geometry calculation. These camera images are not a registered global texture. |
| [2026 color/geometry cubes](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.color_geom_cubes_v1.0/) | **Deferred, useful future source.** Six 150×150 color/angle cubes and 350×350 geometry cubes, spatially registered by assumed translations and tied to the Thomas model. They contain calibrated six-filter radiance plus incidence/emission/phase, but no latitude/longitude backplanes or photometric correction. A new camera-to-shape registration would be required; this release is not treated as missing or as a ready global color map. |
| [NIMS spectral image cube](https://sbn.psi.edu/pds/resource/gaspracube.html) and [point spectra](https://sbn.psi.edu/pds/resource/gaspraspec.html) | **Excluded from these surface views.** They are valuable infrared measurements, but point-perspective spectral/point observations are not a global optical surface or elevation map. No composition or thermal lens is inferred from them. |

## Coordinates and interpretation

The selected shape contains 16,471 rows: 91 latitudes and 181 longitudes at 2° spacing, including a repeated longitude seam and consistent poles. Values are radii in kilometers, converted to meters in preparation. The source longitude is positive west and is converted once to the renderer's east-positive body frame. Radius spans 4.1442–10.7966 km; there is no ellipsoid substitution. The complete released grid includes regions with weaker observational constraints, which are not claimed to be equally well measured.

The mosaic has a material metadata conflict. Its PDS4 generic display section says bottom-to-top, but its bytes, the source observation geometry and the independently published Stooke cylindrical map support row zero at the north and columns increasing east. The PDS3 original label has no array row-direction statement. West-positive coordinate labels do not imply westward-increasing image columns. See `source/reference/registration.md` and its pinned diagnostic data. The observation recipe therefore uses `rowOrder: north-to-south` and `longitudeDirection: east` for array sampling; the shape retains west-positive longitude.

The monochrome view displays the published 8-bit high-pass values without attempting calibrated albedo recovery. It retains photographed illumination, source seams, and oversampled low-detail regions. Exactly 167,449 of 259,200 source pixels are zero (64.6022% of the unweighted cylindrical raster, not a surface-area fraction). All four interpolation samples must be valid before a display pixel is accepted. Missing regions use the shared neutral grid and keep the known silhouette. The 2048×1024 prepared map adds display sampling, not new measured detail.

Elevation colors encode radius minus the 6.1 km reference sphere, using a -2 to +5 km palette. They include the body's overall irregular shape and do not represent height above a gravitational equipotential. Cartographic relief is computed from the source field. Both views retain the shared Shadows control; directional lighting is a prepared diffuse approximation at the shared world epoch and cannot remove photographed shadows or model all terrain self-occlusion.

## Physical frame and geometry

[NAIF pck00011.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), pinned here, gives BODY9511010 pole RA 9.47°, Dec 26.70°, and W = 83.67° + 1226.9114850° × d at J2000 TDB. The shared preparation approximates TDB as TT. Horizons confirms the 6.1 km radius and approximately 7.042 hour rotation; GM is unavailable, so no mass is invented. The shared orbital context owns the pinned osculating elements and epoch.

The full 90×180 sampled grid yields 32,040 triangles and 16,022 welded vertices before official meshoptimizer 1.2.0 simplification. The selected 800-face mesh uses native PolyCSS `u` raster triangles with 128-pixel cells, packed into 2048×6400 atlases. The 200 m library error allowance with `ErrorAbsolute` and `RegularizeLight` reaches an estimated 122.743 m. This estimate is not a guaranteed maximum radial deviation. A separate 3,200 equal-area ray sample finds mean 34.708 m, p95 87.307 m, p99 120.456 m and maximum 202.662 m error with zero missed rays. The mesh is closed and consistently wound: 402 vertices, 1,200 edges, 800 faces, one component, Euler characteristic 2.

## Reproduction and qualification

Restore pinned inputs with `node tools/objects/dist/operations.js acquire gaspra` and verify with the same command plus `--verify-only`. Generate consumed output with `node tools/objects/dist/prepare-authored.js gaspra --write`. The shared preparation owns radii, reorientation, masking, scalar maps, native triangles, lighting, thumbnails and minimaps. `source/preparation/navigation.json` records the context snapshot recipe, also implemented by the shared radial snapshot owner. Runtime installation uses the separate package runtime manifest.

The source pins and source/mesh tests are distinct from parent-owned browser qualification, aggregate gates and runtime publication. Browser evidence must bind the exact prepared bytes, camera, lens and lighting state. A prepared preview alone is not native pixel parity or a performance claim.
