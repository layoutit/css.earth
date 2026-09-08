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

**Stronger removal must address the measured rejection cause.** The initial LMC trial rejected many undersampled stars at `minimumSigma=0.65`. Native field, bright-nebula and bar comparisons supported lowering that recipe value to `0.25`, retaining every other shape and mask limit. Increasing the profile threshold created zero-covariance cores; broadly relaxing shapes and enlarging masks produced patchy dark interpolation. Those alternatives were rejected. The selected change removes more small compact sources without claiming to solve broad halos or completely unresolved single-pixel peaks. The recipe-driven regression checks a small star alongside a filament and broad nebula; removing the recipe override makes that check fail.

### Calibrate from native star samples

Alignment's right sidebar separates **Image** placement/tone from **Star removal**. The latter has three full-image comparison buttons, a removal-strength slider and a paginated native-star sampler.

The user sequence is **pick/add references → Remove stars → inspect the full result**. The removal action performs source-bound calibration followed by application; **Preview samples** exposes a fast, optional crop-only check. Opening the source overview performs no fits. Picking a position only places a marker and magnified locator; **Add sample**, **Find samples**, **Preview samples** and **Remove stars** are explicit operations. Selection changes invalidate the learned bank without starting work or disabling the main removal action. The next removal click learns the current examples before applying. Keep the reference pager/focus stable; check stars are an explicit alternate view. Persist source-bound references and restore completed artifacts through read-only verification. Long-running application belongs to a server job with a persisted request identity; refresh only disconnects its observer. Reattach to the same job, stream or poll real progress, and cancel only through an explicit job cancellation request. A server restart marks unfinished work interrupted; never silently launch a replacement. Show real stage/counter progress and allow cancellation.

- Start with spatially distributed candidates spanning brightness and width. The original detection catalogue is a suggestion source, not the old accepted-star list. Supplement it at multiple native pixel scales so the original detector's width limit cannot decide what is available for calibration.
- Inspect one reference at a time: source crop, fitted compact light and result. Refine a click in the magnifier before adding it. Measure in the pinned original's pixel grid, independently of browser zoom, overlay placement and display tone. The overview is a reduced navigation image only.
- Fit each reference with an elliptical Moffat profile and a local tilted background. Width and shape come from luminance; RGB amplitudes/backgrounds are fitted separately. Report FWHM, elongation, fit error, saturation, neighbors and the model's halo radius. An extrapolated halo is not a measured boundary. Saturated, blended, low-contrast and poorly fitted sources are flagged rather than silently used.
- The calibration stage groups qualified selected references into at most six width/shape profiles. Each records its supporting references, native width range, Moffat shape, detection scale and bounded mask. The mask uses the one-percent peak contour capped to the inspected reference neighborhood; it is not a physical stellar boundary.
- Test that shared bank on unselected candidates in bounded native windows, excluding reference positions. Independently qualify each candidate, match compatible width/shape, and fit its RGB amplitude/background using the shared profile. Display accepted and rejected check crops separately from the references. Reference previews also use the actual shared-bank model, mask and verdict rather than their independent fits. Record training contribution separately from a successful removal match. During application, selected reference seeds bypass the cheaper discovery/screening stage but retain exactly the same final fit and bank guards. Adding a qualified broad reference can expand recognition of similar broad stars; adding a flagged reference does not relax the guards.
- Whole-image application requires the current source-bound calibration, obtained automatically by the explicit removal action. Scan the whole native grid at the learned scales, qualify candidates, and apply compatible shared profiles. Start from the hash-pinned approved native residual and mask, after verifying their original/diffuse accounting. Extend that removal with the calibrated estimates: combine positive compact estimates by maximum, union masks, then subtract once from the original. Previously removed stars must not return when the selected bank recognizes only a subset of the field. Record detections, decisions, masks, native lossless products, code/source/calibration hashes and reduced review previews. Preserve exact integer source = diffuse + residual accounting and unchanged pixels outside accepted masks. A resource limit must fail explicitly, never silently return a partial image as complete.
- New application outputs stay in an ignored local trial cache. The image controls display that completed trial; original imagery, approved separation products and the reconstruction remain unchanged. Whole-image output is selected by an opaque source-bound result identifier, not browser-provided file paths. Tone and comparison strength apply to the chosen result before display.
- These are stretched RGB composites. The profile bank is an inspection approximation, not calibrated photometry, an empirical PSF reconstruction or proof that removed light belongs to a foreground star. Crowded blends, saturation and extended emission still need inspection. No 3D processing follows from sampling, calibration or whole-image removal.

The established scientific next step is to build an empirical PSF from suitable isolated stars and fit neighboring sources together when crowded, then inspect residuals. See [Photutils empirical PSF construction](https://photutils.readthedocs.io/en/2.3.0/user_guide/epsf.html) and [PSF fitting](https://photutils.readthedocs.io/en/stable/user_guide/psf.html). The shared analytic bank does not implement that complete empirical-PSF and simultaneous crowded-field pipeline.

## 4. Check useful color and coverage

- Alignment's visible **Star removal** control remembers a 0–100% value independently for each processed source. Moving it selects the diffuse comparison: 0% is the original preview on the prepared variant's pixel grid; 100% is the prepared diffuse result. Intermediate values interpolate those endpoints before applying the shared tone curve. The compact-residual comparison scales its RGB by the same strength. The separate Original layer always retains its original preview. The control cannot remove sources missed by extraction or strengthen the prepared endpoint.
- Slider updates use debounced, cached local texture preparation, not another detection/separation run. Resizing to the common preview grid and WebP quantization mean intermediate preview pixels do not have the exact additive accounting of the native lossless products. Placement, camera, opacity and registered geometry remain independent; both settings exports include removal strength.
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
