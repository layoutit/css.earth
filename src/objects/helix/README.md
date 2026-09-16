# Helix Nebula

Three ESO lenses share a conditional emission field. **ESO WFI optical is the default.** Molecular velocities constrain a coarse scaffold; unmeasured front/back allocation and outer-halo depth remain assumptions.

## Sources

| Source / lens | Selected image and coverage |
| --- | --- |
| [ESO WFI, eso0907a](https://www.eso.org/public/images/eso0907a/) | B/V/R display; 7059 × 6535 pixels, 28.02′ × 25.94′. |
| [ESO VISTA, eso1205a](https://www.eso.org/public/images/eso1205a/) | Y/J/K display; 6592² pixels, 37.51′ square. |
| [ESO 3.6 m, helix](https://www.eso.org/public/images/helix/) | Wider 6850 × 4759-pixel image, 48.82′ × 33.92′; filters not listed by the publisher. |
| [Molecular component record](source/evidence/helix/kinematics-hco.json) | Zeigler et al. HCO+ measurements condition coarse depth where supported; they do not recover every knot. |

All three photographs are display composites with unequal footprints and band responses. The adopted central-star scale is **216 −12/+14 pc**, from [Benedict et al. (2009), abstract, NGC 7293 distance](https://arxiv.org/abs/0909.4281).

The [stellar field](source/stellar-field.json) contains 6627 Gaia candidates in an authored 50 pc sphere, G < 16. The delivery uses 1466 parallax-informed points plus **34 compact image anchors**: 28 WFI, five VISTA and one wider-ESO core, including the central star. These anchors deliberately retain conditional cloud depths and original source appearance across lenses; catalogue matches do **not** convert those depths into measured distances. One VISTA edge core has image evidence but no Gaia association.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; “included” means used by this delivery, not scientifically validated.

## Evidence

- [Final app inspection](../../../site/test/evidence/nebulae/2026-09-14/final-helix-m8.json) records front/oblique views across all three lenses after restoring the wider-image cores. [Report context](../../../site/test/evidence/nebulae/2026-09-14/README.md) documents incomplete historical capture metadata.
- The final app report identifies cloud result `2794e4cc5c3a…`, and the [object descriptor](object.json) pins its installed bank; the field’s image-anchor receipt separates compact-source evidence, image-component offsets and Gaia angular associations.
- [Historical registration](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/helix/README.md#aligned-observations-and-native-star-removal) records held-out RMS of 0.34″ for VISTA and 1.10″ for the wider ESO field relative to WFI. This verifies overlap registration, not absolute astrometry or stellar membership. No new cold replay or material acceptance is claimed.

## Known problems

- Residual bright stellar halos remain in the cloud. Retained cores restore visual anchors; they do not make the contaminated diffuse material scientifically star-free.
- The first 28-core WFI-only fix missed upper halos outside that photograph. The current three-image union resolves that coverage omission; it does not justify arbitrary points on nebular knots.
- Fine knots, outer-halo completeness, VISTA color streaks and unsupported depth remain unresolved. Earlier one-axis and disk/ring models failed visual inspection.

<details>
<summary>Methods and historical comparisons</summary>

The [fixed lab account](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/helix/README.md) preserves the single-axis, disk/ring, tuned-shape and compiler trials as distinct results. The [joint-fit method](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/docs/joint-fit.md) records molecular sample-count, beam and front/back limitations. Wider Hubble/CTIO, CFHT and photographer candidates remain documented in the [investigation ledger](investigations.json). Preparation belongs in the [shared guide](../../../docs/nebulae/README.md).

</details>

## Compact delivery inputs

The source-owned compact input pin in [delivery.json](source/delivery.json) retains the accepted pre-slice model, material and integration data. Ordinary preparation regenerates the runtime WebP Q80/A80 XYZ atlases and distant impostors without native observation downloads, star extraction or model fitting. Runtime images remain generated and ignored. The [shared bake guide](../../../docs/nebulae/README.md#compact-inputs-and-research-replay) distinguishes this replay from optional full research processing. Source observations and the model limitations above still apply.

Application provenance reads the object-owned evidence and recipe copies recorded in [provenance references](source/provenance-references.json). Their original revisions and SHA-256 pins are preserved; nested research paths describe historical inputs and are not application file reads.
