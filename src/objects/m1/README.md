# Crab Nebula · M1

Six prepared spectral lenses share the Crab's ejecta and pulsar-wind display model in the galaxy view. Hubble optical is the default; Webb infrared, Webb component color, Spitzer infrared, VLA radio and Chandra X-rays show distinct tracers. These colors are independently processed displays, not interchangeable measurements of one material.

## Sources

| Source | Displayed information | Native input |
| --- | --- | --- |
| [Hubble heic0515a](https://esahubble.org/images/heic0515a/) | [O III], [O I] and [S II] optical line color | 3864² pixels; 6.41′ field |
| [Webb weic2326a](https://esawebb.org/images/weic2326a/) | Near/mid-infrared, 1.62–21 µm | 4000 × 3483 pixels |
| [Webb weic2417a](https://esawebb.org/images/weic2417a/) | Derived dust, sulfur and synchrotron component display | 2958 × 2569 pixels |
| [Spitzer potw1720c](https://esahubble.org/images/potw1720c/) | Mid-infrared 24 µm | 5290² pixels; common publisher grid |
| [VLA potw1720b](https://esahubble.org/images/potw1720b/) | Radio synchrotron, approximately 3 GHz | Same grid |
| [Chandra potw1720f](https://esahubble.org/images/potw1720f/) | X-ray pulsar wind; exact displayed passband unspecified | Same grid |
| [Martin's released SITELLE data](https://github.com/thomasorb/M1_paper/tree/af491d4a13d408464ffb3ea75e6a424f6ef5d140) | 416,573 ejecta emission samples, paired velocities and registration image | 2016 observations; GPL-3.0 repository terms |

The [source manifest](source/manifest.json) preserves exact native pins and complete image credits, including NASA/ESA/Allison Loll/Jeff Hester/Davide De Martin, NASA/ESA/CSA/STScI/T. Temim, JPL/Caltech, NRAO/AUI/NSF and CXC. ESA/Hubble and ESA/Webb image policies remain attached to their products. The SITELLE release is not labeled NASA public domain.

World placement retains **2,000 pc**, the conditional reconstruction scale adopted in [Martin et al. (2021), §3.4](https://doi.org/10.1093/mnras/staa4046). Its cited 1.7–2.4 kpc range is not a statistical error bar. [Lin et al. (2023)](https://arxiv.org/abs/2306.01617) independently report a pulsar VLBI distance of 1.90 −0.18/+0.22 kpc; the delivered model is not rescaled to that estimate. The processing-frame origin is ICRS 83.6334511837°, +22.0151236394°, preserved in the [nebula record](source/nebula.json).

## Evidence

The [physical source receipt](../../../labs/nebula/models/m1/physical-sources.json), [evidence ledger](../../../labs/nebula/models/m1/physical-evidence.json) and [sampled recipe](../../../labs/nebula/models/m1/sampled.json) preserve the FITS coordinate qualification and expansion-to-depth conversion. The line/deep-image alignment qualifies the released coordinate grid; it does not independently prove depth.

The [lab assessment](../../../labs/nebula/models/m1/README.md) records native removal, Webb scale calibration, registered-image holdouts and rejected material trials. The auxiliary Hubble 2017 image transfers the publisher grid to Spitzer, VLA and Chandra; it is a supporting observation, not a seventh lens. Nonstellar radio/X-ray emission is preserved instead of being passed through optical star removal.

The [delivery recipe](source/delivery.json) and [request](source/request.json) define replay; its generated receipt identifies the actual result. The [presentation record](source/presentation.json) binds source previews and descriptions. Follow the [shared app preparation guide](../../../docs/nebulae/README.md) for app checks; earlier lab checks alone do not qualify this integration.

The 13 September 2026 integration prepared result `3fac3e884fb50266769d927b5e8832eb374a7dc3d93d49d28807f010d45677cf`, with six lenses, 351 shared lights and 542 nonempty slices plus 26 distant-view images per lens. The final star atlas contains the complete set of spectral colors; the earlier assembly failure is corrected at that owner. This reproduced result is distinct from historical `88f361d1…`; successful preparation does not clear the recorded material-fidelity problem or establish a clean-cache NOX replay.

## Known problems

The historical live material repeats photographic color through depth. Its bounded replacements lost front detail or produced colored beads and were rejected. This unresolved material defect is distinct from the released ejecta coordinates; shipping a scene does not establish a faithful volumetric color reconstruction. The delivered result must retain that qualification unless its own fixed-camera assessment clears it.

Ejecta depth assumes homologous expansion. Nonuniform acceleration, a separately authored diffuse interior, finite jet shapes and per-tracer component strengths remain conditional. Resolution differs by instrument and observation epoch; image pixel spacing is not telescope resolution. The northern ejecta-jet arrays were not acquired, and the model has no calibrated extended radio volume, relativistic beaming, radiative transfer or dust-density measurement.

## Current surrounding stars

The 14 September 2026 app delivery adds 281 shared lights from the pinned [stellar field](source/stellar-field.json): 280 Gaia DR3 rows inside a 50 pc sphere, selected at G < 16. The [shared method](../../../docs/nebulae/stellar-fields.md) records proper-motion propagation, Bailer-Jones distance uncertainty, photometric display scaling, radial fading and the 1,500-point budget. Stars are independent of the image footprint and are not confirmed nebula members.

The displayed set contains 280 Gaia sources plus the retained Crab pulsar, whose previously declared model depth and spectral display remain separate.

The verified cloud replay is `3fac3e884fb50266769d927b5e8832eb374a7dc3d93d49d28807f010d45677cf`. Resource hashes and source-card bindings passed with the new catalogue; cloud geometry and spectral images are unchanged by this starfield replacement. No new clean-cache native-processing claim is made.
