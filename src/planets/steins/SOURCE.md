# Steins source record

This package presents asteroid 2867 Šteins with the published Rosetta OSIRIS shape, a photographic visualization mosaic, and shape-derived Elevation. All static data interpretation runs in the shared preparers. Runtime consumes retained PolyCSS native `u` triangles in raster mode.

## Selected data and bounded survey

| Candidate | Contribution and decision |
| --- | --- |
| [Jorda, Gaskell and Kaasalainen shape, PDS 2013](https://pdssbn.astro.umd.edu/holdings/ro-a-osinac_osiwac-5-steins-shape-v1.0/dataset.shtml), DOI 10.26007/55FK-CB77 | **Included**. `steins_cart.wrl` has 10,242 vertices and 20,480 triangles in km. The wrapped VRML is parsed directly; source axes, connectivity and physical scale are preserved before meshoptimizer simplification. |
| [Stooke Small Bodies Maps V3](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html) | **Included** Monochrome. Unannotated 3600×1800 cylindrical map, controlled by Leyrat2010. Higher-resolution visualization compilation than the referenced original figure, but heavily processed and not calibrated reflectance. The gridded and named companions establish the projection and remain reference documents. |
| [Rosetta NAC reflectance release](https://pdssbn.astro.umd.edu/holdings/ro-a-osinac-4-ast1-steins-reflect-v1.0/dataset.shtml) | **Deferred** for a future observation-level photometric reconstruction. The actual release, index, dataset catalog and a resolved flyby image label were examined. Radiometrically calibrated and distortion-corrected 2048×2048 camera images are available; they are not a cylindrical mosaic. The inspected label has camera/quaternion geometry and explicitly lists the SPICE kernels used. Its optional image point-of-interest intercept is `N/A`; the file remains a camera image rather than a geographic map. Reliable reprojection would require the mission camera and SPICE geometry chain plus a source-supported photometric model. None is invented here. |
| [Rosetta NAC stray-light corrected reflectance](https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=RO-A-OSINAC-4-AST1-STEINS-STR-REFL-V1.0) and WAC counterparts | **Deferred** with the camera-data route above. Their calibrated products address stray light/distortion, not the per-surface incidence/emission normalization required for a global albedo lens. Catalog availability is not evidence that a ready registered map exists. |
| [Leyrat et al. 2010](https://doi.org/10.1016/j.pss.2010.04.003) and [Schröder et al. 2010](https://arxiv.org/abs/1702.00184) | **Excluded as texture inputs**. These studies provide photometric/variegation interpretations, and Leyrat controls the selected released map. The bounded archive/citation survey found the registered Stooke release and calibrated mission images; it did not locate an independently released, unannotated global corrected-albedo raster. This remains an unresolved dataset candidate, not a claim no such data exist. |
| USGS/LPI cartography and IAU nomenclature | **Reference only**. Searches identified nomenclature and annotated image products, not a higher-resolution registered science raster for this package. |

## Geometry and accuracy

The source combines illuminated OSIRIS stereophotoclinometry, stereo/limb constraints and lightcurve inversion for unseen terrain. Rosetta imaged about 60% of the body, at best approximately 80 m/pixel. PDS reports roughly 20 m mean control-point positional error over illuminated regions; that is not global accuracy. Unseen terrain is less certain.

**The original shape contains a documented artificial elevation jump where SPC terrain meets lightcurve-derived terrain.** We retain the published surface and label this limitation rather than smoothing or synthesizing new terrain. The source center differs slightly from center of gravity, within its positional uncertainty. The X/Y axes are not its principal inertia axes.

The source catalog reports mean radius 2.70±0.2 km and volume-equivalent radius 2.63±0.2 km. The app's physical reference uses the pinned Horizons 2.58 km radius. This reference does not rescale the source vertices. Elevation is source radius minus **2.58 km**, not geoid/gravitational elevation. GM is unavailable in the pinned Horizons physical block; the astronomy package's unavailable-value convention is used rather than inferring a mass.

Shared `source-meshoptimizer`, version 1.2.0, uses `ErrorAbsolute` and `RegularizeLight`, target 800 triangles, authored error allowance 100 m. The result is 800 faces, 402 used vertices, 1,200 edges, one closed component and Euler characteristic 2; no opposite face pairs were removed. The library estimate is 48.4695 m. A separate 3,200 equal-area ray comparison gives mean 11.6846 m, p95 27.9911 m, p99 39.6013 m and maximum 53.8148 m, with no misses. These samples are a simplification diagnostic, not an exhaustive Hausdorff bound or scientific source accuracy.

## Appearance and processing

See [registration and coverage](source/reference/registration.md) for coordinate proofs, exact mask interpretation and limitations. Monochrome retains source-compiled observations and their shadows; it is not natural color or albedo. Enlarging to the prepared 4096×2048 map does not add camera detail. The shape-derived Elevation palette spans −0.7 to +1.1 km about the explicit reference sphere, with shared cartographic relief. Added Sun lighting is a separate approximate fixed-epoch shared capability.

The 800 native `u` leaves use 128 px cells in 2048×6400 triangle atlases. Atlas RGBA pixel storage is about 50 MiB per atlas; that is not measured GPU residency. The context and navigation silhouette are prepared from the same final mesh and gap-aware Monochrome at 20°E,10°N.

The pinned IAU PCK00011 pole is RA91°,DEC−62°, W321.76+1428.09917d at J2000. A superseded PCK rotation is deliberately not copied. Astro epoch, heliocentric position and shared solar context are owned by the astronomy preparation.

## Reproduction

Required raw inputs and source documents are either checked in or restored through `source/preparation/acquisition.json`. The manifest records byte sizes, SHA256 hashes, credits, roles and generated context recipe. Use the shared acquisition operation for `steins`, then `pnpm prepare:planets -- --object=steins` after shared tools are built. `runtime-assets.json` owns installable prepared files; ordinary consumers use `pnpm setup:assets --object=steins` without preparing source maps or geometry.

Focused source tests bind the released XYZ anchors/units, map orientation/coverage, rotation and reduced source fit. Browser and fresh-install qualification are performed by the parent integration workflow; source tests alone do not establish delivery or visual acceptance.
