# Triangulum Galaxy (M33)

A publisher optical image supplies the color of an authored 1.2 kpc depth envelope. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [VST snaps a very detailed view of the Triangulum Galaxy](https://www.eso.org/public/images/eso1424a/) | `eso1424a`; 4000 × 3355 pixels; publisher publication JPEG. |
| Geometry reference | Corbelli et al. 2014, arXiv:1409.2665. Adopted parameters remain in the [recipe](source/recipe.json); exact source-field qualification is unresolved. |
| [McConnachie et al. (2010)](https://arxiv.org/abs/1009.2804) | [Stellar extent](source/stellar-extent.json): M33's red-giant substructure reaches projected radii of about 40 kpc. Inside 40 kpc M33's caption hides; outside it the caption hangs under M33's image. It marks where stars are still measured, not a boundary. |

### Catalogues for measured dots (not drawn yet)

These tables are downloaded unchanged from CDS for a dot field like the Milky Way's. Nothing reads them yet.

| Folder | Catalogue | Rows |
| --- | --- | --- |
| `source/lggs-stars/` | [Massey et al. 2006](https://doi.org/10.1086/503256), LGGS UBVRI stars (`table5.dat.gz`) and spectroscopic members (`table9.dat`) | 146,622 and 361 |
| `source/pellerin-cepheids/` | [Pellerin & Macri 2011](https://doi.org/10.1088/0067-0049/193/2/26), Cepheids | 563 |
| `source/long-snr/` | [Long et al. 2010](https://doi.org/10.1088/0067-0049/187/2/495), supernova remnants | 137 |
| `source/sarajedini-clusters/` | [Sarajedini & Mancone 2007](https://doi.org/10.1086/518835), star clusters and candidates | 451 |
| `source/ciardullo-pne/` | [Ciardullo et al. 2004](https://doi.org/10.1086/423414), planetary nebulae | 152 |
| `source/hodge-hii/` | [Hodge et al. 1999](https://doi.org/10.1086/316374), HII regions | 1,272 |

Each table covers the whole disc: half of its rows lie within 12 to 15 arcminutes of the centre in the disc plane, and 95% within 25 to 33 arcminutes. Known problems: LGGS includes Milky Way foreground stars, and the cluster table marks some candidates as stellar; both need removing before placement. Hodge et al. list only the regions new in 1999; the 1,066 regions from earlier catalogues are not on CDS. No catalogue measures depth, so every dot will sit on the disc plane.

The image is publisher-prepared display RGB, not common calibrated flux or a qualified natural-color measurement. Observation dates are not retained in the selected records.

The [manifest](source/manifest.json) records byte identities, complete credits, reuse terms and canonical source bindings. The [source record](source/provenance.json) identifies the provider product and local conversion. The [investigation ledger](investigations.json) records the selected routes and unresolved qualification; it consolidates existing records without claiming an exhaustive search.

## Evidence

- The generated [runtime inventory](inventory.json) contains 96 layer images, the bank, presentation, provenance and one dataset preview (100 assets). Its staging copy is identical; the preview stays at its existing public location.
- The prepared bank (`prepared/image-layers.json`) and [object descriptor](object.json) identify the accepted delivery; the [presentation](source/presentation.json) binds its input and recipe pins.
- This metadata review examined plus the accompanying manifest, presentation and documentation edits. It does not establish a cold replay, inspected browser result or independent scientific qualification.

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
