# Nebula image processing method

This is the repeatable workflow for bringing observed images into the lab, separating compact light, and coloring a spatial model. Source-specific settings belong in recipes, never in algorithm branches. The native LMC research workflow is executable with `node --experimental-strip-types labs/nebula/run.mts bake-nebula --research`; [baking.md](docs/baking.md) defines the clean-start command, stage inputs and reproducibility boundary.

**Material qualification is now stricter:** a real density field painted with one XY photograph at every depth still extrudes the photograph's structures. New accepted clouds require color attached to finite 3D emitters, depth-aware mixing, a regression that rejects the old projected painter, and front/oblique/side inspection. Preserving a front photograph while smearing it sideways fails; averaging away its details also fails. The historical density/symmetry/shape recipes documented below remain reproducible inspection baselines, not proof of this new gate. Requalify their material method before new promotion; do not silently change previously pinned app assets.

Use [Nebula Compiler Process Guidelines](docs/nebula-compiler-guidelines.md) before adding physical constraints. It defines method eligibility, reusable combinations, primary-source intake, actual coverage/uncertainty checks and the evidence-ledger-to-recipe-to-result record. Measurements, published models and authored depth choices remain distinct; shells, fronts, filaments, cavities and dust require different forward observables. [Orion's ledger](models/m42/physical-evidence.json) is the first compact intake example, not an independent acceptance of its 3D geometry.

**Without an existing density model:** the separate [planetary-nebula experiment](docs/planetary-nebulae.md) fits a plausible emission field from an image plus symmetry assumptions before baking. Its M2–9 recipe is not a replacement for the fixed LMC density workflow described below.

**Choose the method from the evidence:** `density` uses an independent spatial prior; `symmetry` declares an axis/inclination; `inference` preserves image evidence and compares conditional geometry. All methods share the lab shell and source-registration/separation utilities. Helix now uses the [emission compiler](docs/emission-compiler.md) for its main cloud; projected shape editing and joint molecular-wall comparisons remain diagnostics. Observation colors and shapes can differ by wavelength even when field stars align correctly.

**Current inference stage:** **Nebula → Compile nebula** runs the authorized pipeline from pinned observations to one prepared cloud. Independent per-image normalization forms a combined relative-luminosity target with explicit coverage. A bounded positive multiscale fit supplies projected emission; an optional velocity-conditioned scaffold and an explicitly uncertain halo supply its depth. Near/far allocation and thickness remain assumptions. Every image lens repaints the same geometry and alpha, and compact lights use observed sky positions with conditional field depths. None of these products is calibrated gas density or confirmed stellar membership. The [compiler guide](docs/emission-compiler.md) records setup, controls, replay and limits; visual acceptance remains open.

**Current density stage:** VISTA, Horálek and WISE have completed native NOX removal and separate 3D comparison bakes. Alignment imports/inspects sources; Reconstruction selects a completed native starless image and runs an explicit **Preview** job. Other catalogue images remain available for comparison/removal without being automatically selected for reconstruction. The comparison repaints the Alignment density cloud; it does not recover measured gas depth.

Scientific algorithms live in the private reconstruction package, shared fields/contracts in `@cssearth/bake/volume`, and offline replay in `@cssearth/bake/volume/node`. The lab owns recipes, application state and durable jobs; volume-viewer consumes prepared assets through an injected host renderer. Ordinary app installation uses `tools/nebula/prepare.mts` without scientific refitting. See [ownership and verification](docs/internal-packages.md).

## Density method: order of operations

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
                     Fixed Alignment cloud + stars
                                  │
                     Registered image chromaticity
                                  │
                 Same geometry/alpha → rotation review
```

Image import and registration do not themselves authorize separation or a volume bake. An explicit user instruction for named candidates or a processing-button click authorizes that operation; do not request the same approval again. A full **Compile nebula** authorizes its configured source and fit stages together, while preserving their validation. Never skip alignment because an image looks approximately right.

## 1. Acquire and preserve the observation

- Record publisher, source URL, credits, license, bands, native dimensions, bit depth, color profile, SHA-256, WCS and pixel convention. Preserve the exact downloaded bytes.
- Prefer scientific survey/observatory sources. Author photographs are useful with explicit credits and registration; appearing on APOD does not make them NASA-owned or calibrated photometry.
- Process the native grid of the **pinned source**, then reduce delivery previews. A publisher's 10K derivative is not its larger original. Upscaling does not supply missing detail.
- Keep the entire footprint and actual no-data regions. A black display pixel alone is not a measured absence of emission. Do not crop to a central connected component, subtract the outskirts, or cut against simulation density before comparing coverage.
- Preserve the original bit depth and orientation in the source archive. NOX currently uses a separate full-size RGB8 working copy where needed; record that conversion explicitly. Do not silently rotate, mirror, resize or rectify the registered source pixels.

Large originals and lossless intermediates stay in the ignored `.local/nebula-lab/` cache. Recipes, source receipts and registration evidence are versioned. All inspection/reference images, starless/residual previews and density/app slice textures are regenerated by the bake and ignored.

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

## 5. Paint the Alignment density cloud

In **Reconstruction**, choose a completed source and press **Preview**. The source of shape is the exact density object already visible in Alignment. The older photo-derived benchmark is a historical experiment, not this reference.

- Pin `subject.density.directory`’s descriptor, existing slices, density recipe/grid and frame. Reuse all 144 LMC density quads and every decoded alpha byte. Do not regenerate a smoother volume or infer geometry from image light.
- Preserve the selected image’s complete saved Alignment placement, including scale, all rotations, pivot and offsets. Never strip its shared authored fit. The fit remains an explicit model-placement assumption, not measured sky geometry.
- Sample the full-native NOX diffuse image through the same fitted observer rays as Alignment. A 1024px registered color plane provides chromaticity; no second star-removal pass runs.
- Optional material controls are saved in the job/result identity and provenance. Defaults preserve the previous RGB: saturation 1, detail 0, scale 24, brightness 1, gamma 1. For detail, compute luminance on the registered starless plane and smooth signal and valid-coverage weight separately with three separable box passes. Divide the two to avoid a false photo-edge halo. Radius is scaled from 1024px reference width. The local signal/mean ratio (with a noise floor) raised to Detail strength supplies a bounded 0.2–1 RGB multiplier. It deepens dark lanes without overexposing bright knots; it never alters density. Saturation changes normalized chromaticity, followed by `brightness * RGB ** (1 / gamma)` and bounded output. Whole-cloud tone includes neutral uncovered material. One registered field supplies every XYZ bank; no per-layer sharpening or runtime CSS filters.
- Candidate brightness cannot redefine density. Missing/zero-RGB samples retain the density bank’s neutral color, with explicit coverage counts. Switching material changes colors while the volume stays fixed.
- Use one configured SMASH sky-to-model reference and the pinned full-density field to assign deterministic model depths to the existing 943 observed stars. Preserve their IDs, measured coordinates and photometry. All candidate images use the same resulting star positions; the candidate image cannot select or move stars.
- Prepare point brightness from the catalogue’s V magnitude, independently of the candidate image. Relative flux is `10 ** (-0.4 * (V - 10))`; see the [observatory magnitude reference](https://lco.global/spacebook/distance/comparing-magnitudes-different-objects/). Split that display-light budget between point area and opacity, compensating the encoded RGB luminance. Do not add a faint-star opacity floor or boost size and opacity independently. Current prepared diameters stay within 0.65–4 px; the measured 943-star sample does not clip its flux budget. This is a bounded display approximation, not radiometrically calibrated output. The Exposure control scales all star light together; Size scales all diameters together.
- Prepare an original-image comparison plane and nine source-UV landmarks through the actual painter mapping. **Earth view** uses one shared observer/framing in both tabs. Compare the same landmarks across tabs, including legacy object routes; testing one tab against its own transform misses this failure.
- Verify the actual output against Alignment: every quad, every alpha byte, source/frame hashes, same stars across materials, and source switching at a retained camera. Keep the existing density source and saved browser placements untouched.

Original-image inspection uses up to 2048px within four million pixels. The cloud has simulated stellar density and modeled display colors/depths, not measured gas geometry. Rotation artifacts of the inherited density bank remain a separate rendering concern.

## Shape-cloud inference preview

The [shape-cloud workbench](docs/nebula-compiler.md#shape-cloud-comparison) remains a separate diagnostic for editable shape hypotheses. The compiler's main **Nebula** view does not require these manual edits. In the diagnostic, start with **Structure** to compare source and model in grayscale, inspect edges, and reveal missing/excess signal with shared display levels. **Compare / Overlay / Textured** show the registered photograph beside, behind or painted onto the same cloud. Earth view preserves registration and linked framing. Unlock rotation and drag either 3D pane to rotate both; the source remains a flat plane. The corner axes identify image X/Y and the original direction toward Earth.

- Detected contours initialize the components automatically. Nearby duplicate brightness boundaries share one shell; distinct projected-center groups remain selectable. No hidden photo-column normalization makes the model match the image.
- In **Shapes**, the visible **Detector** has Sensitivity (25–400%, default 100%), Min. size (minimum ellipse radius, 2–40% of the shorter image side; default 7%), and Max. shapes (1–32, default 12). Slide to update the structures and cloud directly: a bounded draft during dragging and full refinement after release. No Detect/Apply step or view switch. The retained viewer keeps its camera; source-scoped settings and server-owned jobs survive refresh. Reuse the existing starless raster, never another NOX run. Every geometry has its own saved shape edits. Sensitivity lowers contrast/edge thresholds; it cannot establish whether faint light belongs to the nebula. See the [actual Helix fitting trial](docs/helix-fitting-trial.md) before extending this detector.
- Hover a guide for its component/weight and click to select it. **All / Group / Selected** scopes expose weight, thickness, softness, depth, position, size, rotation and enable controls; exposure is global. **Solo** isolates a component; **Reset to detected** restores the automatic initialization.
- Each term is a 3D emission field, currently a shell, ring or filled ellipsoid. **Add / Subtract** and weight compose `max(0, sum(added emission) - sum(subtracted emission))`. Symbolic `S1`, `S2`, … terms select/highlight the same guides; the formula and sliders edit the same settings. A partial subtraction dims a cavity instead of forcing it empty. These are authored 3D hypotheses; the 2D guides are their projected evidence, not a separate volume model.
- Rings also expose **Arc length / Arc angle**: a clockwise image-local sector with soft ends in the actual 3D emission. A complete 360° ring preserves previous behavior. **Fit** selects an optional checked-in source-pinned hypothesis, such as [Helix · tuned](models/helix/README.md#saved-coarse-fit--2026-09-12); its edits are separate from automatic drafts and reset to that saved recipe. Selecting a saved fit does not rerun detection or star removal.
- Shape edits save the draft and automatically update the cloud. Dragging requests a throttled coarse pass; release, keyboard completion or an idle pause requests detail. Only the newest pending settings wait behind the active pass. Both qualities evaluate the same field, bounds, registration and exposure. Modes, camera movement and component selection do not process anything. The current scene stays visible until the next bank finishes decoding; refresh reconnects to server-owned work.
- Neutral and textured outputs share all geometry and every decoded alpha byte. Painting uses the pinned working source and its exact pixel projection; uncovered/black pixels retain neutral material. Source, structure, geometry, settings and implementation identities bind results and drafts to their evidence.
- **Structure** uses the complete working source raster and the actual baked neutral Z projection placed back into that frame. Relative display luminance, equally smoothed gradient magnitude, and signed residual are prepared offline. One global least-squares brightness factor removes overall amplitude from this diagnostic only; it never changes the field, alpha or texture. The same source-derived white point and Levels gain apply to both sides. White residual means missing light, black means excess, midgray means agreement. Background and residual stars remain evidence, not automatic nebular membership. This view stays Earth-facing with linked pan/zoom; returning to 3D restores its previous pose. Channel and Levels changes only select prepared images.
- Sample the complete finite emission support with comparable physical slab spacing across XYZ; keep the full photograph registration separate from these tight baking bounds. Empty image margins must not reduce the number of useful side slices. A changed preparation version refreshes the saved recipe without discarding its settings or hiding the previous completed scene.

This preview models relative emission, not measured gas density. Depth and wall shape are authored assumptions; unsupported arcs, asymmetries and outer emission still need better hypotheses. The photo texture must not conceal a poor neutral fit.

## Multiband evidence and kinematic constraints

The [multimodal inspector](docs/multimodal-workflow.md) combines registered, independently normalized broad/ridge/compact evidence while retaining each source's footprint and attribution. Single-band features survive; compatible repeated support is an additional display, not a membership test. The [joint fit](docs/joint-fit.md) connects projected ridge skeletons to the broader HCO+ catalogue, compares two coarse molecular-wall surfaces and prepares neutral XYZ volumes with withheld-velocity residuals. The inner [O III] slit remains separate. These are conditional shape hypotheses, not a recovered density field; see [research and dataset leads](docs/multimodal-research.md).

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
