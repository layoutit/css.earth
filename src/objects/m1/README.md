# Crab Nebula (M1)

Six spectral lenses share expansion-inferred ejecta and an authored pulsar-wind model. **Hubble optical is the default.** Display color and opacity do not measure gas or dust density.

## Sources

| Source / lens | Selected observation and scope |
| --- | --- |
| [Hubble optical](https://esahubble.org/images/heic0515a/) | WFPC2 optical-line mosaic, 1999–2002; 3864² pixels, 6.41′ square. |
| [Webb infrared](https://esawebb.org/images/weic2326a/) | NIRCam/MIRI, 2022–2023; 4000 × 3483 pixels, 5.47′ × 4.76′. |
| [Webb components](https://esawebb.org/images/weic2417a/) | Derived synchrotron/sulfur/dust display from the same observations; 2958 × 2569 pixels. The registered field is about 5.47′ × 4.75′ after an explicit 2.67% scale correction. |
| [Spitzer infrared](https://esahubble.org/images/potw1720c/) | MIPS 24 µm attribution comes from the companion release; exposure date unspecified. |
| [VLA radio](https://esahubble.org/images/potw1720b/) | Approximately 3 GHz; 2012 observations with older large-scale template information. |
| [Chandra X-rays](https://esahubble.org/images/potw1720f/) | ACIS composite; companion release spans 2000–2013, exact stack/passband unspecified. |
| [SITELLE ejecta](https://doi.org/10.1093/mnras/staa4046) | 416,573 released 2016 emission samples; depth assumes an expansion law and 2,000 pc. |

The last three images share a 5290²-pixel, 8.83′ publisher grid transferred through a separately registered 2017 Hubble bridge. They have no independent field-star registration. Infrared, radio and X-ray colors are representational; compact nonstellar emission is preserved.

The adopted **2,000 pc** scale follows [Martin et al. (2021), §3.4](https://doi.org/10.1093/mnras/staa4046), not a new distance fit; its cited 1.7–2.4 kpc range is not a statistical error. [Lin et al. (2023)](https://arxiv.org/abs/2306.01617) report the alternative VLBI pulsar distance of 1.90 +0.22/−0.18 kpc. The [stellar field](source/stellar-field.json) supplies 280 Gaia sources within an authored 50 pc sphere, G < 16, using Bailer-Jones distance estimates and retained uncertainty intervals. One named pulsar keeps its original conditional depth and spectral appearance: 281 displayed points.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; “included” means used by this delivery, not scientifically validated.

## Evidence

- [Recorded app checks](../../../site/test/evidence/nebulae/2026-09-14/field-defaults.json) cover the catalogue field, projection and star toggle; [evidence context](../../../site/test/evidence/nebulae/2026-09-14/README.md) states their version and limits.
- The [object descriptor](object.json) pins the installed bank whose provenance identifies compiler result `3fac3e884fb5…`. The [delivery request](source/delivery.json) pins preparation inputs and retains the older accepted-lab reference separately. This documentation review did not perform a cold replay.
- [Historical processing evidence](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m1/processing-evidence.json) separates stellar registration, native pixel accounting and projected-signal checks. These establish their recorded processing behavior, not physical depth or current material acceptance.

## Known problems

- Image color repeated through depth, softened filaments and oblique glow remain. Trials that lost the front view or created beads were rejected; shipping this version does not resolve that material failure.
- Expansion may be nonuniform; smoothing, diffuse interior, jet lengths and strengths remain conditional. The northern ejecta-jet arrays were not acquired.
- Unequal epochs, footprints and PSFs prevent a calibrated multiband comparison. Missing image coverage is not absent emission; no extinction, dust-density or relativistic radiative-transfer solution is claimed.

<details>
<summary>Methods and historical comparisons</summary>

The [fixed processing account](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m1/README.md) preserves the earlier result identities and failed material trials. [Physical evidence](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m1/physical-evidence.json) distinguishes SITELLE measurements, Ng–Romani torus parameters and authored terms; the [source dossier](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m1/source-dossier.json) preserves registration, epochs and alternatives. General preparation belongs in the [nebula guide](../../../docs/nebulae/README.md).

</details>

## Compact delivery inputs

The source-owned compact input pin in [delivery.json](source/delivery.json) retains the accepted pre-slice model, material and integration data. Ordinary preparation regenerates the runtime WebP Q80/A80 XYZ atlases and distant impostors without native observation downloads, star extraction or model fitting. Runtime images remain generated and ignored. The [shared bake guide](../../../docs/nebulae/README.md#compact-inputs-and-research-replay) distinguishes this replay from optional full research processing. Source observations and the model limitations above still apply.
