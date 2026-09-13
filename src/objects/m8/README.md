# Lagoon Nebula · M8

Three prepared lenses show the Lagoon in the shared galaxy view: ESO optical, ESO VISTA near infrared and Spitzer mid-infrared. Their relative display colors paint one authored coherent front. Local published structure guides that front; the model does not recover the cloud's physical density or depth.

## Sources

| Source | Displayed information | Native input and coverage |
| --- | --- | --- |
| [ESO eso0936a](https://www.eso.org/public/images/eso0936a/) | Optical Hα/R/V/B composite | 4000 × 2679 pixels; 93.49′ × 62.61′ |
| [ESO VISTA eso1101d](https://www.eso.org/public/images/eso1101d/) | J/H/Ks near-infrared false color | 4000 × 2202 pixels; 71.81′ × 39.54′ |
| [Spitzer sig11-012](https://www.spitzer.caltech.edu/image/sig11-012-into-the-depths-of-the-lagoon-nebula) | IRAC 3.6/4.5/5.8/8 µm + MIPS 24 µm false color | 1757 × 1417 pixels; 35.73′ × 28.81′ |

Credits: ESO; ESO/VVV with the Cambridge Astronomical Survey Unit; NASA/JPL-Caltech. The [source manifest](source/manifest.json) preserves exact native pins and provider reuse links. The ESO inputs are unchanged publisher 4K TIFF variants of larger masters; Spitzer is the complete selected master. These are stretched outreach images, not calibrated common-band luminosity measurements. VISTA's caption identifies J/H/Ks; its conflicting AVM H-alpha label is a metadata error, not an infrared H-alpha observation.

World placement adopts **1,326 −69/+77 pc** from [Wright et al. (2019), §3.4](https://doi.org/10.1093/mnras/stz870). That Gaia DR2 cluster estimate includes the paper's zero-point correction and spatially correlated systematic uncertainty. It is not a distance measurement for each gas component. The [nebula record](source/nebula.json) retains the existing common ICRS processing origin, 270.76531645904527°, −24.30622861770443°.

## Evidence

The [selected observations](../../../labs/nebula/models/m8/processing-observations.json), [physical ledger](../../../labs/nebula/models/m8/physical-evidence.json) and [depth recipe](../../../labs/nebula/models/m8/depth-model.json) separate local observed constraints from every authored spatial parameter. Arias and Tiwari's local Hourglass/M8E descriptions do not establish whole-nebula geometry. Paper footprints converted at 1,250 pc remain local angular constraints; adopting the newer world distance does not turn them into measured volume depths.

The [lab source-and-result account](../../../labs/nebula/models/m8/README.md) and [processing evidence](../../../labs/nebula/models/m8/processing-evidence.json) record registration, native separation and the measured shortcomings of each pinned result. The [delivery recipe](source/delivery.json) and [request](source/request.json) preserve the selected processing controls; the generated receipt identifies the actual replay. The [presentation record](source/presentation.json) binds source previews and cards. Follow the [shared preparation guide](../../../docs/nebulae/README.md) for app verification.

The 13 September 2026 integration prepared result `dd7eedffd90f02c018b4940b38517d7e3233b5dfef1a9a1d4f5be8d72b2452e5`, with three lenses, 650 shared lights and 619 nonempty slices plus 26 distant-view images per lens. This is the new compiled delivery, distinct from the historical `1a5712d6…` assessment. Source-card validation checked all three bindings and the installed bank identity; it does not establish a new visual acceptance or a clean-cache NOX replay.

## Known problems

The current source-derived model softens fine filaments, retains peripheral stellar-removal blobs, and shows thin-layer and slice/grid artifacts from oblique and side views. Infrared footprints are narrower than optical coverage, leaving sharp color-to-neutral transitions. Missing infrared support is no-data, not absent gas.

The historical 650 image-derived lights had uncertain halo maxima and conditional depths. The app now replaces that field with the independently catalogued neighbourhood described below; quality/magnitude cuts still omit real stars and do not prove membership. No gas velocity is converted directly into depth, and foreground extinction or separate molecular clouds are not reconstructed.

Hubble's central optical and near-infrared images remain excluded because their small footprints have not passed the required independent registration. The Herschel candidate contains zero-filled and nonfinite support near the central field. The [source dossier](../../../labs/nebula/models/m8/source-dossier.json) retains those alternatives and the failed registration attempts rather than treating them as absent datasets.

## Current surrounding stars

The 14 September 2026 app delivery adds 226 shared lights from the pinned [stellar field](source/stellar-field.json): 226 Gaia DR3 rows inside a 60 pc sphere, selected at G < 12. The [shared method](../../../docs/nebulae/stellar-fields.md) records proper-motion propagation, Bailer-Jones distance uncertainty, photometric display scaling, radial fading and the 1,500-point budget. Stars are independent of the image footprint and are not confirmed nebula members.

The current cloud replay is `7545a7a3af301ef4cc288c84e4343262add505c4db1f8bff8d1c836a7ad8c3e6`, with 711 cloud slices and 26 distant-view images per lens. Resource hashes and source-card bindings passed with the new catalogue; the starfield itself remains independent of the separate faint-edge adjustment below. No new clean-cache native-processing claim is made.

## Faint image edges

The saved compiler now feathers the optical display boundary over 450″ and tapers
VISTA/Spitzer input edges over 240″ before fitting the shared emission field.
This replaces the earlier 90″ window. The input target retains 99.917% of the
bright-core signal and 3.819% of the old outermost-strip signal; these figures
measure the target, not screen brightness. Native images, physical placement,
source weights and central background settings remain unchanged. The saved
[edge evidence](../../../labs/nebula/models/m8/edge-taper-evidence.json) distinguishes
those numerical checks from the final app inspection.
