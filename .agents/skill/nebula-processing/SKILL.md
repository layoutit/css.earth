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

1. Open `/reconstruction`, choose the completed starless source, and press **Process**. Selecting a candidate alone must not start a bake.
2. Bind the source result, exact saved Alignment matrix/pivot/placement, physical frame and unchanged prior. Confirm the worker uses the same observer rays and CSS-to-physical conversion as the overlay.
3. Use the density field as the common shape/support/depth. Images provide RGB only inside occupied density. Never extrude the whole photograph or turn background light into cloud matter.
4. Preserve identical full bounds and XYZ slice geometry across image variants. No per-image thickness, per-column normalization or image-dependent delivery cropping. Keep inferred stellar morphology distinct from measured gas/dust geometry.
5. Keep missing photographic coverage explicit. Do not invent color outside it or crop density to hide an alignment mismatch.
6. Check reference projection and XYZ integration convergence before baking. Increase integration sampling at its owning layer; never relax gates to make an image pass.
7. Bake lossless masters, then compressed XYZ banks. Derive counts from physical bounds so all axes have comparable slice pitch; equal counts on unequal dimensions are not equal sampling. Current interactive comparison uses 128 slices on the longest axis, a 512px analysis/delivery plane and adaptive integration sampling; it does not preserve all native detail.
8. Publish only a complete local result atomically after resource/hash verification. Decode the next bank before swapping the retained scene. Here “publish” means finalize the local cache, never host or deploy.

## 6. Inspect and accept the approximation

- Compare variants at the same camera, scale and brightness. Check front, oblique and edge views plus a continuous orbit.
- Inspect feature connectivity, parallax, repeated silhouettes, sheet-like depth, slice gaps, disappearing detail, seams, whitening and angle-dependent brightness.
- Check source identity, placement, full prior extent, resource hashes, XYZ banks, payload and actual job duration. Compare physical-area-weighted optical RGB totals across banks; preserve faint light with the existing optical RGB quantization error carry, not axis gains. Inspect active banks at the same camera pose to isolate handoff defects. A passing front projection does not prove real side geometry.
- Test switching saved sources without reprocessing or scene teardown; refresh must reconnect/load the same result.
- Keep stellar overlays independent of image choice and coverage. Preserve the same catalogue XYZ, validate positive density support, and use a common density projection for cutoff. Keep the star toggle. Inferred member depths need documented constraints, not a flat background plane.
- Record accepted/rejected outcomes and limits. If the same defect survives a fix, address the owning image/registration/model/sampling layer rather than hiding it through exposure or cutoff.
- Run the saved-output `browser-reconstruction-stability` command for both X/Z and Y/Z handoffs. It reports and fails brightness/image disagreement separately from successful processing. The current LMC variants still fail this strict visual gate; see `docs/slice-stability.md`. Do not describe them as fully rotation-stable or promote them on unit-test success alone.

## 7. Preserve and promote deliberately

- Native NOX outputs: `.local/nebula-lab/star-removal-nox-applied/`.
- Completed volumes: `.local/nebula-lab/reconstructions/`, including descriptor, masters/delivery, provenance and manifest.
- Preserve exact historical receipt bytes/hashes during organization; resolve relocated paths at loading boundaries.
- A finished local bake is not a production migration. Promotion requires explicit scope, reproducible input/recipe/transform/depth/bake records and fixed-camera acceptance. Keep runtime PolyCSS plain TypeScript; React owns the lab UI only.
- For a future high-detail named structure, test a registered local crop and connected volumetric model first. Multi-band color, wavelets, NeRF or Gaussian splats alone do not recover missing physical depth.
