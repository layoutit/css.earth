# Nebula image processing method

This is the repeatable workflow for bringing observed images into the lab, separating compact light, and coloring a spatial model. Source-specific settings belong in recipes, never in algorithm branches.

**Current stage:** VISTA, Horálek and WISE have completed native NOX removal and separate 3D comparison bakes. Alignment imports/inspects sources; Reconstruction selects a completed native starless image and runs an explicit **Process** job. Other catalogue images remain available for comparison/removal without being automatically selected for reconstruction. The current 512px volume comparison is an approximation, not a production-quality recovery of gas depth.

## Order of operations

```text
Pinned original + source metadata
                │
                ▼
Star detections → verified image registration → full-density overlay
                │                                  │
                └──────── selected source ──────────┘
                                  │
                                  ▼
                       Compact-light separation
                       ├── diffuse trial
                       ├── compact residual + masks
                       └── source reconstruction check
                                  │
                           inspect and select
                                  │
                                  ▼
                    Structure ownership + depth prior
                                  │
                    lossless comparison masters
                                  │
                    delivery slices → rotation review
```

Image import and registration do not themselves authorize separation or a volume bake. An explicit user instruction for named candidates or a processing-button click authorizes that operation; do not request the same approval again. Never skip alignment because an image looks approximately right.

## 1. Acquire and preserve the observation

- Record publisher, source URL, credits, license, bands, native dimensions, bit depth, color profile, SHA-256, WCS and pixel convention. Preserve the exact downloaded bytes.
- Prefer scientific survey/observatory sources. Author photographs are useful with explicit credits and registration; appearing on APOD does not make them NASA-owned or calibrated photometry.
- Process the native grid of the **pinned source**, then reduce delivery previews. A publisher's 10K derivative is not its larger original. Upscaling does not supply missing detail.
- Keep the entire footprint and actual no-data regions. A black display pixel alone is not a measured absence of emission. Do not crop to a central connected component, subtract the outskirts, or cut against simulation density before comparing coverage.
- Preserve the original bit depth and orientation in the source archive. NOX currently uses a separate full-size RGB8 working copy where needed; record that conversion explicitly. Do not silently rotate, mirror, resize or rectify the registered source pixels.

Large originals and lossless intermediates stay in the ignored `.local/nebula-lab/` cache. Recipes, source receipts, registration evidence and bounded inspection textures are versioned.

## 2. Establish direction, scale and position from stars

1. Extract compact-source coordinates and a detection map from the untouched image. These are observed-image candidates, not a catalogue of confirmed foreground stars.
2. Read publisher WCS as an initial sky placement. Verify point-source correspondences against a registered image or an appropriate astronomical catalogue. For infrared images, use matching bands/catalogues; do not match dust morphology to optical stars.
3. When a correction is necessary, fit in native pixel coordinates. Reserve validation matches from fitting. For a fixed published WCS, check it without fitting a correction.
4. Record residuals in native pixels **and their angular scale**, spatial coverage, matched hull, and shifted/reflected/wrong-scale negative controls. Declare thresholds before evaluating. Extrapolated corners remain extrapolated.
5. Pin the passing evidence, exact source hash and active WCS/homography. A different crop, source resolution or transform requires another registration check.

Use explicit conversion between top-left, zero-based raster pixel centres and the source's AVM/FITS convention. Keep north/east orientation, handedness and the observer side visible in the full-field overlay.

**Image-to-image registration and image-to-simulation fitting are different.** The LMC lab's shared manual placement is scale 3, rotation +39°, translation (−1.2, −1.7, 0) kpc about the SMASH pivot. Transfer that same transform with each image's pivot compensated. It is an inspection fit, not measured physical scale or correspondence between observed stars and simulated particles. Preserve the independently registered relative image geometry.

The stellar simulation's observer transform is reconstructed approximately from the paper. It has no measured gas/dust depth and retains model/observation offsets. See [registration and observer evidence](docs/registration.md).

## 3. Remove stars automatically with NOX

The image sidebar uses **NOX automatic removal**. Manual star picking, profile calibration and harmonic removal are retired from the interactive workflow. Their earlier receipts remain provenance for existing prepared images; they are not a required user step.

1. Clicking Quick preview or Remove stars approves that operation for the selected imported image. Verify its original hash, native dimensions and pinned NOX model; existing star layers and trial recipes are not prerequisites. Preserve the full image extent and orientation. Non-RGB8 originals get a separate full-size RGB8 working PNG without an additional stretch. Registration and approval are still required before a later 3D bake.
2. **Quick preview** runs the model on automatically selected native crops. Inspect bright stars, crowded regions and nebula detail. It never changes the full image or the reconstruction.
3. **Remove stars** processes the full native image using overlapping tiles and bounded batches. The worker reports actual progress. Refresh reconnects to the server-owned job; only **Cancel** stops it. A server restart marks interrupted work honestly.
4. Derive the positive original-minus-prediction residual. Preserve earlier approved removal when a baseline exists. Subtract once from the original; keep the exact native integer accounting `original = without stars + residual` and the actual changed-pixel mask.
5. Save native lossless outputs, bounded comparison textures, model/source/code hashes and verification. Install only a completed, verified result; source images, placement and the current 3D reconstruction remain unchanged.

The three comparison buttons are **Original / Without stars / Residual**. Removal strength defaults to 100%; lowering it blends the completed result rather than refitting stars. No sample list, calibration prerequisite or separate star-removal tab remains.

NOX predicts the background under stars. It is an image-processing model, not measured gas emission or a stellar-membership classifier. Inspect dark halos and compact nebular features before any 3D bake. [Model and setup](docs/star-removal.md).

## 4. Check useful color and coverage

- Alignment's visible **Star removal** control remembers a 0–100% value independently for each processed source. Moving it selects the diffuse comparison: 0% is the original preview on the prepared variant's pixel grid; 100% is the prepared diffuse result. Intermediate values interpolate those endpoints before applying the shared tone curve. The compact-residual comparison scales its RGB by the same strength. The separate Original layer always retains its original preview. The control cannot remove sources missed by extraction or strengthen the prepared endpoint.
- Slider updates use debounced, cached local texture preparation, not another detection/separation run. Resizing to the common preview grid and WebP quantization mean intermediate preview pixels do not have the exact additive accounting of the native lossless products. Placement, camera, opacity and registered geometry remain independent; both settings exports include removal strength.
- Compare all components with the same declared global tone curve. Retain untuned native products. The lab's brightness/gamma/levels controls are inspection settings, not new source measurements.
- Record source and diffuse channel totals, percentile levels, clipped values, changed area and empty-data coverage. Bright enough for display does not mean high signal-to-noise: these composites are not calibrated radiance.
- Inspect native crops as well as overview previews. A smooth-looking reduction can conceal remaining stars, seams, masked knots or pixelated texture.
- Infrared and optical composites are separate candidate color treatments. Do not average their colors as if they measured the same band. WISE W4/W2/W1 dust structure, VISTA Y/J/Ks stars and optical emission can differ legitimately.
- A larger density field does not authorize inventing color beyond the image. Solve the footprint gap with verified observations, or retain explicit missing coverage.

## 5. Color the common density volume, then bake

In **Reconstruction**, choose a completed source and press **Process**. The image supplies color/texture; the full physical density field owns shape, support and depth. Zero density must emit nothing, even under a bright photograph. Do not generate per-image cloud thickness, normalize each sightline independently, or extrude the entire rectangular image.

- Bind the native NOX result and exact saved Alignment matrix/pivot/placement. Project each occupied physical voxel through the same observer mapping into the image.
- Multiply the common density by sampled RGB using one fixed density scale and exposure. Image channels remain color information; they do not create new matter or geometric components.
- Preserve full density bounds, XYZ slice positions and texture dimensions across variants. Disable image-dependent delivery cropping. Missing image coverage remains uncolored, rather than filled with invented observations.
- Prepare one image-independent density projection for cutoff. Keep the star catalogue independent of photographic color, extent and source choice: preserve measured angular positions and the existing inferred XYZ, check positive density, and use the same density projection for support.
- Check independent XYZ integration convergence before baking. Raise integration sampling, never relax numerical gates to force a pass. Derive comparable physical slice pitch from the unchanged bounds: 128 slices on the longest axis gives the current LMC 128 X, 125 Y and 56 Z slices. Current comparison textures are 512px; native source detail is not all retained at this level.
- Write lossless masters, compressed delivery banks, star catalogue, provenance and a manifest. Validate before atomic cache publication and browser decoding.
- Compare all sources at fixed front, ±60° and edge views. Distinguish actual changes in projected path length from discontinuities at slice-bank handoffs. Calibrate prepared banks consistently; do not pump exposure or change color with the camera to hide defects.

The previous filled-component approach extruded photographic background and produced broad sheets from the side. It is retained only as historical evidence. The replacement uses the stellar simulation as the cloud's visualization shape; this still does not establish measured gas/dust geometry. A future physically informed structure model must preserve that distinction.

## Selected LMC inputs

| Candidate | Pinned processing grid | Active registration | Remaining limitation |
|---|---:|---|---|
| [ESO VISTA](https://www.eso.org/public/images/eso1914a/) | 8954 × 10000, publication TIFF | Matched-star homography to SMASH; 5340 held out, P90 0.667 SMASH pixels | Publisher's 28638 × 31985 original is larger; current footprint still misses outer density. Publisher WCS alone failed. |
| [Horálek optical](https://noirlab.edu/public/images/iotw2547a/) | 6582 × 4388, JPEG | Matched-star homography to SMASH; 198 held out, P90 1.12 SMASH pixels | 60.2% matched hull; outer footprint extrapolated. |
| [NASA/IPAC WISE data](https://irsa.ipac.caltech.edu/onlinehelp/wise/wise/overview.html) | 6000 × 6000, CDS RGB JPEG | Fixed WCS checked against AllWISE W1 point sources | ~14.6″ pixels; atlas seams and display stretch remain. CDS made the RGB composite. |

Exact image sources, credits and transforms are in [the image recipe](models/image-candidates.json). SMASH provides the optical sky anchor at approximately 5″ per reference pixel. WISE's own pixels are coarser; residuals from different reference grids are not directly comparable numbers.

## Repeatability and acceptance record

For each new object, retain one record linking source → alignment gate → separation recipe/receipt → selected target → depth assumptions → bake receipt → fixed-camera review. Record failed candidates as failed; keep the failure at its owning stage.

At each experiment's start, state the hypothesis, fixed controls and success threshold. Allow at most three fix/review rounds and two final cleanup rounds. Stop if evidence is missing or improving one view breaks another. Validate the actual produced files and visual result; a successful process exit is insufficient.

The active UI workflow is recorded in [workflows](docs/workflows.md) and [reconstruction](docs/reconstruction.md). Earlier source-specific separation trials remain in their model evidence. Newly processed banks live in the ignored local reconstruction cache until deliberately promoted with their recipes and provenance. Do not process an unapproved catalogue entry merely because it is selectable in Alignment.
