# Andromeda Galaxy (M31)

A publisher optical image supplies the color of an authored 1 kpc depth envelope. Image brightness does not measure per-pixel distance.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Wide-field view of the Andromeda Galaxy](https://esahubble.org/images/heic1112f/) | `heic1112f`; 4783 × 5000 pixels; High-resolution crop/resample derived offline from the publisher Large JPEG. |
| Geometry reference | Chemin, Carignan & Foster 2009, arXiv:0909.3846. Adopted parameters remain in the [recipe](source/recipe.json); exact source-field qualification is unresolved. |
| [Ibata et al. (2005)](https://arxiv.org/abs/astro-ph/0504164) | [Stellar extent](source/stellar-extent.json): an extended disc-like structure of M31 stars spanning out to about 40 kpc (scattered detections to 70 kpc). Inside 40 kpc M31's caption hides; outside it the caption hangs under M31's image. It marks where stars are still measured, not a boundary. |
| [Azimlu et al. (2011)](https://doi.org/10.1088/0004-6256/142/4/139) | [HII regions](source/azimlu-hii/points.json): 3,961 regions from H-alpha images of the whole disc (CDS J/AJ/142/139). |
| [Kodric et al. (2013)](https://doi.org/10.1088/0004-6256/145/4/106) | [Cepheids](source/pandromeda-cepheids/points.json): 2,009 Cepheids from the first year of Pan-STARRS1 PAndromeda monitoring, whole disc (CDS J/AJ/145/106). |
| [Lee & Lee (2014)](https://doi.org/10.1088/0004-637X/786/2/130) | [Supernova remnant candidates](source/lee-snr/points.json): 156 candidates from H-alpha and [S II] images (CDS J/ApJ/786/130). |
| [Merrett et al. (2006)](https://doi.org/10.1111/j.1365-2966.2006.10268.x) | [Planetary nebulae](source/merrett-pne/points.json): 2,574 of 3,300 emission-line objects, after the authors' own flags for HII regions, background objects and other galaxies (CDS J/MNRAS/369/120). |
| [Johnson et al. (2015)](https://doi.org/10.1088/0004-637X/802/2/127) | [Star clusters](source/phat-clusters/points.json): 2,753 clusters from the PHAT Hubble imaging, which covers only the north-east third of the disc (CDS J/ApJ/802/127). |

The five catalogues give sky positions only. They are recorded for a future layer of catalogue dots over the image, in the Milky Way's style; nothing reads them yet.

The [disc geometry](source/disc-geometry.json) that will place them on M31's disc is inclination 77.7° and position angle 38°, the [Corbelli et al. (2010)](https://doi.org/10.1051/0004-6361/200913297) H I fit between 10 and 25 kpc, around SIMBAD's M31 centre. Three published measurements are recorded beside it:

- [Dalcanton et al. (2023)](https://doi.org/10.3847/1538-3881/accc83) measure 77° ± 0.5° from the stars themselves, within 0.7° of it.
- [Chemin et al. (2009)](https://doi.org/10.1088/0004-637X/705/2/1395) agree on the position angle (37.7° ± 0.9°) but find 74.3° ± 1.1° for the inclination.
- [Dorman et al. (2013)](https://doi.org/10.1088/0004-637X/779/2/103) find 44.4° ± 0.5° for the old red-giant disc, which the paper says can look more face-on than the young disc. It is not used for young tracers.

One flat plane ignores the warp, which tilts the disc to 86° beyond 30 kpc.

The image is publisher-prepared display RGB, not common calibrated flux or a qualified natural-color measurement. Observation dates are not retained in the selected records. The 361.93 × 234.08 arcmin field describes the parent image, not the 4783 × 5000 crop; crop coordinates and conversion are retained in the acquisition record.

The [manifest](source/manifest.json) records byte identities, complete credits, reuse terms and canonical source bindings. The [source record](source/provenance.json) identifies the provider product and local conversion. The [investigation ledger](investigations.json) records the selected routes and unresolved qualification; it consolidates existing records without claiming an exhaustive search.

## Evidence

- The generated [runtime inventory](inventory.json) contains 92 layer images, the bank, presentation, provenance and one dataset preview (96 assets). Its staging copy is identical; the preview stays at its existing public location.
- The prepared bank (`prepared/image-layers.json`) and [object descriptor](object.json) identify the accepted delivery; the [presentation](source/presentation.json) binds its input and recipe pins.
- This metadata review examined plus the accompanying manifest, presentation and documentation edits. It does not establish a cold replay, inspected browser result or independent scientific qualification.

## Known problems

- The wide DSS2 field contains the full visible galaxy and substantial surrounding sky, foreground stars and background objects. Those released sources are retained. Faint halo coverage is limited by the survey composite.
- Foreground stars and background objects remain in the image. Compact features are not classified or individually placed in three dimensions; no point-source removal is applied.
- The image-layer recipe's inclination (77.5°) matches none of the papers above; its position angle (37.7°) is Chemin et al. (2009)'s mean. The recipe cites Chemin, whose mean inclination is 74.3°. Coordinate epoch and placement remain incompletely recorded. No independent sky-registration or measured-depth acceptance is available here.

<details>
<summary>Image-layer preparation and reproduction</summary>

The observation is decomposed by local compactness into one high-frequency midplane residual and a diffuse component. Only diffuse optical depth is distributed through 32 normalized parametric slabs; cross-axis textures sample the same separable field. This is not measured per-pixel depth.

Sources, recipes and expected geometry/resource hashes remain tracked. Layer WebPs carry accepted byte hashes. Lossy WebP encoding can differ across platforms, so installation verifies accepted bytes; a new replay must compare its output against the pinned bank and report differences. The [shared bake guide](../../../labs/nebula/docs/baking.md) describes reproduction.

The source-owned manifest and presentation feed the shared provenance preparation pipeline. Its metadata and byte checks establish identity and decoding, not physical depth or visual acceptance.

</details>
