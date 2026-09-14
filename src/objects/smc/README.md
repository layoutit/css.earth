# Small Magellanic Cloud

A publisher optical image supplies the color of an authored 25 kpc depth envelope. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Deepest, widest view of the Small Magellanic Cloud from SMASH](https://noirlab.edu/public/images/noirlab2030b/) | `noirlab2030b`; 3000 × 2501 pixels; publisher-curated AstroPix JPEG derivative. |
| Geometry reference | Ripepi et al. 2017, arXiv:1707.04500; the broad envelope is not a thin disk or per-pixel distance map. Adopted parameters remain in the [recipe](source/recipe.json); exact source-field qualification is unresolved. |

The image is publisher-prepared display RGB, not common calibrated flux or a qualified natural-color measurement. Observation dates are not retained in the selected records.

The [manifest](source/manifest.json) records byte identities, complete credits, reuse terms and canonical source bindings. The [source record](source/provenance.json) identifies the provider product and local conversion. The [investigation ledger](investigations.json) records the selected routes and unresolved qualification; it consolidates existing records without claiming an exhaustive search.

## Evidence

- The generated [runtime inventory](runtime-assets.json) contains 96 layer images, the bank, presentation, provenance and one dataset preview (100 assets). Its staging copy is identical; the preview stays at its existing public location.
- The [prepared bank](prepared/image-layers.json) and [object descriptor](object.json) identify the accepted delivery; the [presentation](source/presentation.json) binds its input and recipe pins.
- This metadata review examined revision `e4dfae5485b0aeeb88485531387366e886f43ef4` plus the accompanying manifest, presentation and documentation edits. It does not establish a cold replay, inspected browser result or independent scientific qualification.

- The earlier README records a 2026-09-12 macOS arm64 replay with sharp 0.35.3/libwebp 1.6.0: 95 of 96 layers matched and `x-13.webp` was reaccepted four bytes shorter. Its [original account](https://github.com/layoutit/css.earth/blob/e4dfae5485b0aeeb88485531387366e886f43ef4/src/objects/smc/README.md) lacks an inspectable comparison report; it is historical context, not a fresh reproduction pass.

## Known problems

- The SMASH image covers the main optical body, not the full Bridge, Wing or tidal debris. Released foreground and background sources remain.
- Foreground stars and background objects remain in the image. Compact features are not classified or individually placed in three dimensions; no point-source removal is applied.
- Exact source fields, uncertainties and coordinate epoch for adopted orientation and placement remain incompletely recorded. No independent sky-registration or measured-depth acceptance is available here.

<details>
<summary>Image-layer preparation and reproduction</summary>

The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 normalized parametric slabs; cross-axis textures sample the same separable field. This is not measured per-pixel depth.

Sources, recipes and expected geometry/resource hashes remain tracked. Layer WebPs carry accepted byte hashes. Lossy WebP encoding can differ across platforms, so installation verifies accepted bytes; a new replay must compare its output against the pinned bank and report differences. The [shared bake guide](../../../labs/nebula/docs/baking.md) describes reproduction.

The source-owned manifest and presentation feed the shared provenance preparation pipeline. Its metadata and byte checks establish identity and decoding, not physical depth or visual acceptance.

</details>
