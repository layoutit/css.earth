# Nebula image processing method

This is the repeatable workflow for bringing observed images into the lab, separating compact light, and eventually coloring a spatial model. Source-specific settings belong in recipes, never in algorithm branches.

**Current stage:** VISTA, Horálek and WISE are selected for aligned, full-footprint **2D separation trials**. Other catalogue images remain comparison previews. A new volume and replacement of the current reconstruction require a separate decision after inspecting those trials.

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
                    high-resolution volume masters
                                  │
                    delivery slices → rotation review
```

Image import and registration do not themselves authorize separation or a volume bake. Never skip the alignment stage because an image looks approximately right.

## 1. Acquire and preserve the observation

- Record publisher, source URL, credits, license, bands, native dimensions, bit depth, color profile, SHA-256, WCS and pixel convention. Preserve the exact downloaded bytes.
- Prefer scientific survey/observatory sources. Author photographs are useful with explicit credits and registration; appearing on APOD does not make them NASA-owned or calibrated photometry.
- Process the native grid of the **pinned source**, then reduce delivery previews. A publisher's 10K derivative is not its larger original. Upscaling does not supply missing detail.
- Keep the entire footprint and actual no-data regions. A black display pixel alone is not a measured absence of emission. Do not crop to a central connected component, subtract the outskirts, or cut against simulation density before comparing coverage.
- Preserve integer depth during separation. Do not silently apply EXIF rotation, mirroring, resizing, rectification or a color-profile conversion that invalidates the registered pixels or changes their values.

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

## 3. Separate compact light before cloud decomposition

The current implementation is a **conservative local interpolation trial**, not a calibrated PSF fit or a guarantee of a star-free image:

1. Verify source SHA-256 and native dimensions. Decode without automatic orientation or resampling, preserving unsigned 8/16-bit values and any alpha channel.
2. Detect native-grid compact peaks with tiled Gaussian high-pass analysis, or consume a hash-matched native-pixel detection catalogue. Write the complete detection list and map **before** removing any signal. The filtered detection image never becomes the diffuse output.
3. Assess each candidate against a robust local annular background plane. Accept only bounded, near-round profiles within the recipe's width, elongation and Gaussian-correlation limits. Keep rejection reasons.
4. Inside accepted circular masks, estimate underlying color using a harmonic interpolation anchored at the mask boundary. The positive source-minus-interpolation residual is the compact component. Overlapping estimates use their maximum, preventing double subtraction.
5. Subtract that quantized residual from the original. Pixels outside accepted masks remain bit-identical. Preserve the full grid, including disconnected outskirts and image edges.
6. Save native lossless diffuse/residual images, accepted masks, detections, accepted-source records, comparison preview and a receipt containing source/recipe/code hashes, dependency versions, parameters and output hashes.

Required accounting: `original color = diffuse color + compact residual color` exactly in integer code values; zero changed pixels outside the masks. Alpha, when present, is copied rather than added. This proves accounting, **not** correct astrophysical classification.

Compact nebular knots may resemble stars. Crowded blends, saturated stars, broad wings, diffraction spikes and edge sources can remain. Inspect original/diffuse/residual together at native resolution; inspect bright knots and faint outskirts specifically. Reject a trial that hollows out nebular structure, even if its arithmetic closes. Neither detection coordinates nor removed light determine stellar membership or depth.

## 4. Check useful color and coverage

- Compare all components with the same declared global tone curve. Retain untuned native products. The lab's brightness/gamma/levels controls are inspection settings, not new source measurements.
- Record source and diffuse channel totals, percentile levels, clipped values, changed area and empty-data coverage. Bright enough for display does not mean high signal-to-noise: these composites are not calibrated radiance.
- Inspect native crops as well as overview previews. A smooth-looking reduction can conceal remaining stars, seams, masked knots or pixelated texture.
- Infrared and optical composites are separate candidate color treatments. Do not average their colors as if they measured the same band. WISE W4/W2/W1 dust structure, VISTA Y/J/Ks stars and optical emission can differ legitimately.
- A larger density field does not authorize inventing color beyond the image. Solve the footprint gap with verified observations, or retain explicit missing coverage.

## 5. Later: assign structure and depth, then bake

This stage follows selection of a useful 2D result; it is not part of the current three-image separation run.

- Decompose extended light into **filled structures plus a retained remainder**, with accounting back to the selected image. Sparse wavelet coefficients alone are not cloud footprints. Preserve related fine detail with its parent structure instead of spreading every feature across every depth layer.
- Map registered pixels onto observer rays at the declared distance. A stellar density field supplies an uncertain depth prior; it does not measure gas geometry. Angular coverage becomes physical coverage through the projection and distance, not arbitrary percentage scaling.
- Give connected structures explicit finite depth/thickness assumptions. Compare localized and broad-depth controls at fixed registration, target and exposure. Keep residual light and uncertainty visible.
- Fit the selected Earth-facing projection before trimming empty volume bounds. Never cut the input density first to force the photograph to fit. Do not normalize layers independently or increase brightness to hide missing structure.
- Bake lossless masters at sufficient spatial/integration resolution; only then derive bounded compressed XYZ slice banks. Check all axis banks, oblique views and close views for repeated silhouettes, gaps, disappearing structure, whitening and brightness changes.
- Keep observed stars separate from diffuse light. Use actual catalogue positions where available; inferred depth placement must be documented and constrained by the model, not a flat background plane.

The earlier [coherent-depth](docs/coherent-depth.md) and [filled-observation](docs/filled-observation.md) experiments remain **rejected for production morphology**. Their numerical checks do not establish a successful general 3D reconstruction. The [research plan](docs/research-plan.md) records the remaining structure/depth work and rotation acceptance gates.

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

The source-specific replay commands and current trial results are recorded in [the separation experiment](models/lmc-star-separation/README.md). Use that complete sequence from a clean checkout/cache; do not process a new unapproved catalogue entry merely because it is selectable in Alignment.
