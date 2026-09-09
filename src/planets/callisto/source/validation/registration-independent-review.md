# Callisto PIA03456: independent fixed-camera review

Accept the unchanged fitted camera for conservative partial processed-color preparation. This is source-registration acceptance, not a prepared body or browser qualification. No camera parameter was changed or fitted in this review.

The PDS ASU image database independently identifies PIA03456 as the C30 color plate viewed from 215° west longitude (145° east). The fitted east-positive convention is supported; no longitude reversal or extra plate flip is warranted. The native GeoTIFF is equidistant cylindrical with central longitude 180°, radius 2,409,300.0488 m, and pixel-center coordinates derived from its actual affine transform. The 2,410.3 km physical body radius is a separate scale used in the perspective camera.

I projected eight independently named USGS Gazetteer centers through the frozen camera and inspected the color plate and native unblurred mosaic side by side. Vili, Valfodr, Alfr, Bran, Loni, Vidarr, Egres and Grimr coincide with the matching impact structures. Vili’s bright disk, isolated Valfodr, Alfr and Bran’s bright surroundings are clear. The original color pixels and controlled monochrome pixels retain their different contrast and photometry.

For the root-held-out upper-right and lower-left quadrants, native unblurred NCC is 0.713 and 0.573; high-pass sigma-6 NCC is 0.608 and 0.548. Four named centers fall in these quadrants. Local 25 × 25 pixel comparisons peak at zero offset for six features, at (+1,0) for Egres and (+1,+1) for Grimr. No diagnostic shift was applied. These are alignment diagnostics, not a claimed absolute geodetic accuracy. The remaining four named features are independent identification checks of training regions and are not mislabeled as withheld pixels.

The plate has visible color fringing and soft detail near its limb. Preserve its processed photographic colors without calling them I/F, measured albedo, or a global color map. A conservative initial emission limit of 60° is appropriate; the outer limb and unseen hemisphere are not accepted by this review. Genuine missing coverage must remain the normal cartographic grid. Atlas source-pixel sampling, lighting and retained browser behavior still need the standard preparation and qualification checks.

`registration-independent-review.json` retains exact input/output hashes, fixed camera parameters, all eight named coordinates, original-map metadata, and diagnostic results. `agent-named-fixed-camera.png` shows the full comparison; `agent-feature-patches.png` shows untouched source-value crops enlarged with nearest-neighbor sampling.

Delivery decision: the body implementation uses the separately accepted 65° emission cutoff, with exact fully opaque contributing pixels. The 60° suggestion above is retained as the original review history; it is not the implemented recipe.
