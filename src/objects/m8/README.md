# Lagoon Nebula (M8)

Three lenses color one authored cloud front; **ESO optical is the default**. Local published structure guides its interpretation, but gas depth, extinction and overlapping molecular clouds are not reconstructed.

## Sources

| Source / lens | Selected image and coverage |
| --- | --- |
| [ESO optical, eso0936a](https://www.eso.org/public/images/eso0936a/) | Hα/R/V/B display; 4000 × 2679 pixels, 93.49′ × 62.61′. |
| [ESO VISTA, eso1101d](https://www.eso.org/public/images/eso1101d/) | J/H/Ks display; 4000 × 2202 pixels, 71.81′ × 39.54′. The publisher’s Hα metadata label conflicts with its near-IR caption. |
| [Spitzer IRAC maps, CDS HiPS](../../sources/cds-hips-spitzer-irac.json) | IRAC 8.0/4.5/3.6 µm in MJy/sr from CDS hips2fits, [composed](source/sky-bands/spitzer-irac.json) on a 1757 × 1417 pixel, 35.73′ × 28.81′ TAN grid. Each band is scaled to its own measured range, so hue shows where a band is bright, not physical band ratios. MIPS 24 µm is left out: its map has no data over the Hourglass core. |

The Spitzer lens used the publisher's sig11-012 TIFF until the FITS composite replaced it; [preview comparison](evidence/spitzer-fits/preview-comparison.jpg) (publisher left, FITS right). The composite registers against ESO optical with 214 matched stars, 0.12 px held-out RMS (the publisher TIFF: 199 stars).

The ESO publication TIFFs preserve the full master footprints at reduced sampling. Pixel spacing is not measured PSF resolution. Different bands, stretches and masks cannot be interpreted as interchangeable calibrated flux.

The adopted **1326 −69/+77 pc** cluster distance follows [Wright et al. (2019), §3.4](https://doi.org/10.1093/mnras/stz870), including its systematic uncertainty treatment; it is not a measured gas depth. The [stellar field](source/stellar-field.json) supplies 226 Gaia sources within an authored 60 pc sphere, G < 12, with Bailer-Jones distance estimates and uncertainty intervals shared across lenses.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; “included” means used by this delivery, not scientifically validated.

## Evidence

- [Final Helix/Lagoon app inspection](../../../site/test/evidence/nebulae/2026-09-14/final-helix-m8.json) records front/oblique views of all three Lagoon lenses after the edge correction. The [earlier field report](../../../site/test/evidence/nebulae/2026-09-14/field-m8.json) predates that correction; [report context](../../../site/test/evidence/nebulae/2026-09-14/README.md) states reproduction gaps.
- The final app report identifies cloud result `7545a7a3af30…` and predates the FITS Spitzer lens. The current result `37a8918fb195…` replays byte for byte from the compact inputs; its [app inspection](evidence/spitzer-fits/app-inspection.json) records front, oblique and side captures of all three lenses ([views](evidence/spitzer-fits/app-views.jpg)), not a comparison with the earlier bank; the [object descriptor](object.json) pins its installed bank. The [edge-taper evidence](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m8/edge-taper-evidence.json) measures source-target preservation, not screen brightness: 99.917% of bright-core target retained with 3.819% of the previous outermost-strip signal.
- [Historical processing evidence](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m8/processing-evidence.json) covers relative registration and native separation. No fresh cold replay or scientific/material acceptance is asserted.

## Known problems

- Fine filaments soften; residual stellar halos, thin layers and oblique grid traces remain. The wider optical taper and 240″ infrared edge fade soften boundaries without creating missing observations.
- Neutral transitions remain where infrared coverage ends. Foreground absorption, distinct molecular layers and local diagnostic data are not fitted.
- Hubble central images failed registration qualification; Herschel’s central zero/nonfinite coverage cannot constrain the Lagoon. Neither is a delivered lens.

<details>
<summary>Methods and historical comparisons</summary>

The [fixed lab account](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m8/README.md), [physical evidence](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m8/physical-evidence.json) and [source dossier](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m8/source-dossier.json) preserve the Arias/Tiwari local interpretations, historical result identities and Hubble attempts with 0 and 9 matches against a 45-match gate. The papers’ 1250 pc local footprint conversion stays distinct from the adopted application distance. Use the [shared nebula guide](../../../docs/nebulae/README.md) for preparation.

</details>

## Compact delivery inputs

The source-owned compact input pin in [delivery.json](source/delivery.json) retains the accepted pre-slice model, material and integration data. Ordinary preparation regenerates the runtime WebP Q80/A80 XYZ atlases and distant impostors without native observation downloads, star extraction or model fitting. Runtime images remain generated and ignored. The [shared bake guide](../../../docs/nebulae/README.md#compact-inputs-and-research-replay) distinguishes this replay from optional full research processing. Source observations and the model limitations above still apply.

Application provenance reads the object-owned evidence and recipe copies recorded in [provenance references](source/provenance-references.json). Their original revisions and SHA-256 pins are preserved; nested research paths describe historical inputs and are not application file reads.
