# Andromeda Galaxy (M31)

A publisher optical image supplies the color of an authored 1 kpc depth envelope. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Wide-field view of the Andromeda Galaxy](https://esahubble.org/images/heic1112f/) | `heic1112f`; 4783 × 5000 pixels; High-resolution crop/resample derived offline from the publisher Large JPEG. |
| Geometry reference | Chemin, Carignan & Foster 2009, arXiv:0909.3846. Adopted parameters remain in the [recipe](source/recipe.json); exact source-field qualification is unresolved. |

The image is publisher-prepared display RGB, not common calibrated flux or a qualified natural-color measurement. Observation dates are not retained in the selected records. The 361.93 × 234.08 arcmin field describes the parent image, not the 4783 × 5000 crop; crop coordinates and conversion are retained in the acquisition record.

The [manifest](source/manifest.json) records byte identities, complete credits, reuse terms and canonical source bindings. The [source record](source/provenance.json) identifies the provider product and local conversion. The [investigation ledger](investigations.json) records the selected routes and unresolved qualification; it consolidates existing records without claiming an exhaustive search.

## Evidence

- The generated [runtime inventory](inventory.json) contains 92 layer images, the bank, presentation, provenance and one dataset preview (96 assets). Its staging copy is identical; the preview stays at its existing public location.
- The prepared bank (`prepared/image-layers.json`) and [object descriptor](object.json) identify the accepted delivery; the [presentation](source/presentation.json) binds its input and recipe pins.
- This metadata review examined revision `e4dfae5485b0aeeb88485531387366e886f43ef4` plus the accompanying manifest, presentation and documentation edits. It does not establish a cold replay, inspected browser result or independent scientific qualification.

## Known problems

- The wide DSS2 field contains the full visible galaxy and substantial surrounding sky, foreground stars and background objects. Those released sources are retained. Faint halo coverage is limited by the survey composite.
- Foreground stars and background objects remain in the image. Compact features are not classified or individually placed in three dimensions; no point-source removal is applied.
- Exact source fields, uncertainties and coordinate epoch for adopted orientation and placement remain incompletely recorded. No independent sky-registration or measured-depth acceptance is available here.

<details>
<summary>Image-layer preparation and reproduction</summary>

The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 normalized parametric slabs; cross-axis textures sample the same separable field. This is not measured per-pixel depth.

Sources, recipes and expected geometry/resource hashes remain tracked. Layer WebPs carry accepted byte hashes. Lossy WebP encoding can differ across platforms, so installation verifies accepted bytes; a new replay must compare its output against the pinned bank and report differences. The [shared bake guide](../../../labs/nebula/docs/baking.md) describes reproduction.

The source-owned manifest and presentation feed the shared provenance preparation pipeline. Its metadata and byte checks establish identity and decoding, not physical depth or visual acceptance.

</details>
