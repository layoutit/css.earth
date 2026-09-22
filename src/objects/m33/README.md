# Triangulum Galaxy (M33)

A publisher optical image supplies the color of an authored 1.2 kpc depth envelope. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [VST snaps a very detailed view of the Triangulum Galaxy](https://www.eso.org/public/images/eso1424a/) | `eso1424a`; 4000 × 3355 pixels; publisher publication JPEG. |
| Geometry reference | Corbelli et al. 2014, arXiv:1409.2665. Adopted parameters remain in the [recipe](source/recipe.json); exact source-field qualification is unresolved. |

The image is publisher-prepared display RGB, not common calibrated flux or a qualified natural-color measurement. Observation dates are not retained in the selected records.

The [manifest](source/manifest.json) records byte identities, complete credits, reuse terms and canonical source bindings. The [source record](source/provenance.json) identifies the provider product and local conversion. The [investigation ledger](investigations.json) records the selected routes and unresolved qualification; it consolidates existing records without claiming an exhaustive search.

## Evidence

- The generated [runtime inventory](inventory.json) contains 96 layer images, the bank, presentation, provenance and one dataset preview (100 assets). Its staging copy is identical; the preview stays at its existing public location.
- The prepared bank (`prepared/image-layers.json`) and [object descriptor](object.json) identify the accepted delivery; the [presentation](source/presentation.json) binds its input and recipe pins.
- This metadata review examined revision `e4dfae5485b0aeeb88485531387366e886f43ef4` plus the accompanying manifest, presentation and documentation edits. It does not establish a cold replay, inspected browser result or independent scientific qualification.

## Known problems

- The 68 by 57 arcminute VST field contains the full bright optical disk. The larger warped neutral-hydrogen outskirts are not represented.
- Foreground stars and background objects remain in the image. Compact features are not classified or individually placed in three dimensions; no point-source removal is applied.
- Exact source fields, uncertainties and coordinate epoch for adopted orientation and placement remain incompletely recorded. No independent sky-registration or measured-depth acceptance is available here.

<details>
<summary>Image-layer preparation and reproduction</summary>

The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 normalized parametric slabs; cross-axis textures sample the same separable field. This is not measured per-pixel depth.

Sources, recipes and expected geometry/resource hashes remain tracked. Layer WebPs carry accepted byte hashes. Lossy WebP encoding can differ across platforms, so installation verifies accepted bytes; a new replay must compare its output against the pinned bank and report differences. The [shared bake guide](../../../labs/nebula/docs/baking.md) describes reproduction.

The source-owned manifest and presentation feed the shared provenance preparation pipeline. Its metadata and byte checks establish identity and decoding, not physical depth or visual acceptance.

</details>
