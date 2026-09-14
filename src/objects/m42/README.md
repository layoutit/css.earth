# Orion Nebula (M42)

Two ESO lenses color a coherent, authored ionization-front hypothesis; **optical is the default**. Local literature constraints do not measure the depth of the entire wide field.

## Sources

| Source / lens | Selected image and coverage |
| --- | --- |
| [ESO optical, eso1723a](https://www.eso.org/public/images/eso1723a/) | i/Hα/r/G display; 4000 × 3106 pixels, 59.95′ × 46.56′. |
| [ESO VISTA, eso1006a](https://www.eso.org/public/images/eso1006a/) | K/J/Z near-IR display; 3252 × 4000 pixels, 71.84′ × 88.35′. |
| [Local physical evidence](../../../labs/nebula/models/m42/physical-evidence.json) | Wen–O’Dell, Henney and later Orion interpretations guide central topology; wide-field curvature and thickness are authored. |

Both publisher TIFFs retain their full footprints. Their RGB values are stretched display samples, not common flux units; resolution and coverage differ. The adopted distance is **414 ± 7 pc**, from [Menten et al. (2007), abstract](https://arxiv.org/abs/0709.0485).

The [stellar field](source/stellar-field.json) contains 2780 Gaia candidates in an authored 50 pc sphere, G < 14; 1500 brightness-ranked points are delivered with a spherical fade. Positions use Bailer-Jones distance estimates, with uncertainty intervals retained. Image bounds do not determine stellar depth or selection.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; “included” means used by this delivery, not scientifically validated.

## Evidence

- The [object descriptor](object.json) pins the installed bank; [delivery inputs](source/delivery.json) record saved controls and catalogue preparation. The source manifest distinguishes those inputs from generated delivery bytes.
- The [fixed lab processing account](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m42/README.md) records both-lens browser checks, native stellar-light accounting and coherent-front projection comparisons. Its older result identities are historical, not a fresh acceptance of the current delivery.
- This documentation review checks provenance and interpretation; it does not establish a cold replay, independent gas-depth validation or material acceptance.

## Known problems

- A rectangular optical coverage transition, pale neutral residuals and fine oblique slice bands remain. Adding surrounding stars does not repair the cloud’s photographic boundary.
- The roughly 0.2 pc star/front distance and 0.1 pc equivalent layer are local published models at the papers’ distance, not whole-field measurements.
- Orion-S, foreground Veil alternatives, extinction and overlapping fronts remain incomplete. Downloaded central MUSE diagnostic maps have not been fitted; several lack required masks, units or complete WCS.

<details>
<summary>Methods and historical comparisons</summary>

The [physical ledger](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m42/physical-evidence.json) separates observed positions, published models and authored parameters; [depth-model.json](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m42/depth-model.json) is the runnable hypothesis. The [fixed lab README](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m42/README.md) preserves the earlier 355-support and saved-100%-detail comparisons, including their normalized-image error limits. General preparation is documented in the [nebula guide](../../../docs/nebulae/README.md).

</details>
