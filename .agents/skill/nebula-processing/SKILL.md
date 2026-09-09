---
name: nebula-processing
description: "Process a galaxy or nebula image in the local Nebula Lab: acquire and pin observations, register direction and angular scale, compare with an appropriate density prior, remove stars with NOX, and bake/inspect a reproducible PolyCSS 3D model. Use for adding an image candidate, processing a new nebula, preparing a reconstruction variant, or diagnosing alignment, coverage, separation and depth artifacts."
---

# Nebula image to baked 3D model

Work in `labs/nebula`. Read its `AGENTS.md`, `METHOD.md`, `docs/workflows.md` and `docs/reconstruction.md` before changing the pipeline. They define the actual app and numerical gates; this skill explains how to apply it to another source.

The current app supports LMC/SMC inspection and LMC's VISTA, WISE and Horálek reconstruction variants. A new object requires its own data recipes, registration evidence, frame and appropriate prior. The general procedure is reusable; an arbitrary image is not automatically a configured reconstruction source.

## 1. Define the output and evidence

- Identify the object, intended visible/infrared treatment, projected extent, intended close-view detail and delivery budget.
- Separate observations, simulation constraints and authored assumptions. A stellar-density simulation is not measured nebular gas/dust depth. Images from Earth in different bands are not independent viewing angles.
- Start with a small comparison bake and fixed front/oblique cameras. State success and a bounded iteration budget before processing; do not design a new reconstruction framework before trying the baseline.
- Preserve an existing running lab, browser state and completed caches. Cleanup remains inside the lab unless explicitly requested elsewhere.

## 2. Acquire a suitable image and prior

- Prefer observatory/agency/survey originals; credit the actual author and processing source. APOD publication does not transfer ownership to NASA.
- Record exact URL, license/credit, SHA-256, native dimensions, bit depth, pixel conventions, filters, display stretch and WCS. Preserve original bytes in the ignored local cache.
- Compare angular footprint and resolution before selecting: a sharp central image may miss the full cloud. Keep no-data regions explicit. Never upscale a preview and call it native detail.
- Use a suitable measured/simulated spatial dataset, with units, frame, observer transform, source hash and limitations. Preserve the full prior before cutting a delivery region. A single photo without depth constraints requires explicitly authored geometry; report this instead of inventing measured depth.
- Put object-specific choices in `models/<object>/` and acquisition metadata in `sources/`. Reuse algorithms rather than adding image-name branches.

## 3. Register before baking

1. Detect compact sources on the untouched native image, before removing stars.
2. Start with publisher WCS; verify against a suitable catalogue or registered image using shared stars. Match compatible bands where possible.
3. If fitting a correction, reserve held-out matches. Record native-pixel/angular residuals, spatial coverage, matched hull and shifted/mirrored/wrong-scale controls. Pin the source bytes and exact accepted transform.
4. Keep pixel-center conventions, north/east handedness and observer side explicit. Reject an unverified direction rather than compensating by eye.
5. Open `/alignment` with the complete density field and image footprint. Use the reference observer; compare registration first, then the separate image-to-simulation fit.
6. Save/export placement including rotation, scale, offset and pivot. A manual model fit is not astrometry; retain both independently.

Importing and aligning a candidate does not authorize processing. A user instruction naming the candidates, or an explicit processing-button click, authorizes that operation. Do not ask for the same authorization again.

## 4. Remove stars once

- Use the Alignment sidebar's **Quick preview** for native crops when direction/removal quality is uncertain; then **Remove stars** for the full source.
- NOX runs locally on overlapping tiles. Non-RGB8 sources receive a separate full-size RGB8 working image; keep the higher-depth original unchanged and record the conversion.
- Inspect **Original / Without stars / Residual**, particularly saturated stars, halos, crowded fields and compact nebular knots. Automatic removal is not a membership catalogue or measurement of the hidden cloud.
- Require completed native diffuse/residual/mask products, source/model/code pins and exact native accounting: original = diffuse + residual. Check real artifacts, not just process exit status.
- Refresh reconnects to server-owned work. Cancel stops it explicitly. Never restart a server merely to refresh UI while processing.
- The strength slider blends completed preview products; it does not change detection. Reconstruction consumes the complete native diffuse output, not this display blend, browser WebP or a second removal pass.

## 5. Process the volume explicitly

1. Open `/reconstruction`, choose the completed starless source, and press **Preview**. Selecting a candidate alone must not start a bake.
2. Pin the Alignment density descriptor, prepared slices, source textures, reference projection and catalogue alongside the native starless image and registration. A new object needs an explicitly selected density cloud before it can use this material workflow.
3. Keep the cloud’s exact geometry, bounds, crops, depth and decoded alpha. Use the exact same prepared density bank shown in Alignment; do not substitute a historical photo-derived benchmark or resample a new volume for each image.
4. Preserve the entire saved Alignment placement, including its scale, rotation, pivot and offsets. Use one shared Earth observer/framing across both tabs. Compare actual image landmarks across tabs, not only against reconstruction’s own mapping.
5. Sample registered candidate chromaticity at each existing slice texel’s physical position. Optional saturation, local detail, brightness and gamma are authored RGB material controls; use one coverage-normalized registered detail field for all axes, preserve alpha, and pin settings in the result. Preview explicitly; do not process on slider movement. Image brightness cannot redefine density. Missing/zero-RGB samples retain explicitly counted neutral density color; report this mixed-source coverage.
6. Preserve observed IDs, astrometry and photometry. One configured sky-to-density fit conditions model depths on the real density field, independently of candidate image. All materials share the same resulting positions and encoded cutoff signal; no per-image selection or repositioning.
7. Current LMC comparison uses the existing 144 Alignment slices and 943 stars, a 1024px registered color plane, and an original comparison plane up to 2048px within four million pixels. It preserves Alignment density detail, not all native image detail. Prepare original-image geometry through exactly the same mapping.
8. Verify exact geometry, every decoded alpha byte, catalogue records and resource hashes. Finalize only a complete local result atomically. Decode the next bank before swapping the retained scene; never host or deploy as part of processing.

## 6. Inspect and accept the approximation

- Compare variants at the same camera, scale and brightness. Check front, oblique and edge views plus a continuous orbit.
- Inspect feature connectivity, parallax, repeated silhouettes, sheet-like depth, slice gaps, disappearing detail, seams, whitening and angle-dependent brightness.
- Check source identity, placement, exact canonical geometry/alpha, resource hashes, XYZ banks, payload and actual job duration. Use Earth view and the original-image overlay to inspect mapping. Inspect active banks at the same camera pose to isolate handoff defects. A passing front projection does not prove real side geometry.
- Test switching saved sources without reprocessing or scene teardown; refresh must reconnect/load the same result.
- Prepare stellar area and opacity jointly from catalogue magnitudes, with global exposure and no arbitrary faint-star opacity floor. Image residuals can check correspondence; candidate image brightness must not redefine the shared catalogue light.
- Keep stellar overlays independent of image choice and coverage. Preserve the same catalogue XYZ and reference-support signal, validate its common reference and positive source-density support, and use a common projection for cutoff. Keep the star toggle. Inferred member depths need documented constraints, not a flat background plane.
- Record accepted/rejected outcomes and limits. If the same defect survives a fix, address the owning image/registration/model/sampling layer rather than hiding it through exposure or cutoff.
- Run the saved-output `browser-reconstruction-stability` command for both X/Z and Y/Z handoffs. It reports and fails brightness/image disagreement separately from successful processing. See `docs/slice-stability.md` for the current measured outcome and historical failed experiments. Do not describe them as fully rotation-stable or promote them on unit-test success alone.

## 7. Preserve and promote deliberately

- Native NOX outputs: `.local/nebula-lab/star-removal-nox-applied/`.
- Completed volumes: `.local/nebula-lab/reconstructions/`, including descriptor, masters/delivery, provenance and manifest.
- Preserve exact historical receipt bytes/hashes during organization; resolve relocated paths at loading boundaries.
- A finished local bake is not a production migration. Promotion requires explicit scope, reproducible input/recipe/transform/depth/bake records and fixed-camera acceptance. Keep runtime PolyCSS plain TypeScript; React owns the lab UI only.
- For a future high-detail named structure, test a registered local crop and connected volumetric model first. Multi-band color, wavelets, NeRF or Gaussian splats alone do not recover missing physical depth.
