# Pleiades · M45

Five prepared lenses show the reflection nebulosity around the Pleiades in the shared galaxy view. The default optical composite combines Taavi Niittee's wider photograph with central NOIRLab detail. The other views preserve NOIRLab optical, two Spitzer composites and WISE infrared. These are relative display colors on an inferred cloud, not measured dust density.

## Sources

| Source | Displayed information | Coverage |
| --- | --- | --- |
| [Niittee / Tõrva Astronomy Club](https://commons.wikimedia.org/wiki/File:Plejades.jpg) + [NOIRLab](https://noirlab.edu/public/images/noao-m45/) | Wider optical composite; registered central luminance detail | Niittee 264.79′ × 172.08′; NOIRLab 68.68′ × 50.13′ |
| [NOIRLab noao-m45](https://noirlab.edu/public/images/noao-m45/) | Publisher B/V/I display | 4000 × 2920 pixels |
| [Spitzer PIA09262](https://science.nasa.gov/photojournal/pink-pleiades/) | IRAC 3.6/4.5/5.8/8 µm, false color | 2855² pixels; 58.07′ square |
| [Spitzer PIA09263](https://science.nasa.gov/photojournal/the-seven-sisters-pose-for-spitzer/) | IRAC 4.5/8 µm + MIPS 24 µm, false color | Same central footprint |
| [WISE PIA13121](https://science.nasa.gov/photojournal/seven-sisters-get-wise/) | 3.4/4.6/12/22 µm, false color | 4007 × 3061 pixels; 182.99′ × 139.79′ |
| [Hipparcos and Tycho-2 source receipt](../../../labs/nebula/models/m45/stellar-sources.json) | Observed stellar directions and optical display photometry | Historical 450-light selection from 2,105 records; eight named stars retained in the current field below |

Exact native byte pins, complete credits and reuse links are in the [source manifest](source/manifest.json). Niittee is credited under CC BY 4.0; NOIRLab, NASA/JPL-Caltech/J. Stauffer and NASA/JPL-Caltech/UCLA retain their separate provider terms. The [source dossier](../../../labs/nebula/models/m45/source-dossier.json) distinguishes downloaded display rasters from native detector resolution and calibrated scientific arrays.

World placement adopts **136.2 ± 1.2 pc**, the VLBI cluster distance in [Melis et al. (2014)](https://doi.org/10.1126/science.1256101), main text and Table 1. It does not measure the distance to every dust filament. The [nebula record](source/nebula.json) preserves the processing frame origin, ICRS 56.75°, +24.1167°; this is an adopted display center, not a newly measured centroid.

## Evidence

The [delivery recipe](source/delivery.json) and [saved request](source/request.json) define the app inputs. The generated delivery receipt identifies the actual compiled result; its historical lab ID alone does not prove byte identity after a compiler change. The [shared preparation guide](../../../docs/nebulae/README.md) describes restoration and app checks.

The 13 September 2026 integration prepared result `cd1f89e3e0affb327370338346df7f5812c0109ebd46cffeb9c8f702b94ed70c`, with five lenses, 450 shared lights and 821 nonempty slices plus 26 distant-view images per lens. This is the new compiled delivery, distinct from the historical `4510c5bb…` comparison. Source-card validation checked all five bindings and the installed bank identity; this does not establish a new visual acceptance or a clean-cache NOX replay.

[Stellar evidence](../../../labs/nebula/models/m45/stellar-evidence.json) documents the catalog correction and retained cloud. The [optical composite assessment](../../../labs/nebula/models/m45/optical-composite-notes.md) records central registration, native separation, rejected image blends, and the historical front/side failures. Those observations describe their pinned lab results, not a new independent measurement of 3D structure. The [presentation record](source/presentation.json) binds each card to its source; the composite card's reference preview is Niittee's original photograph before fusion.

## Known problems

Fine reflection filaments are softened, bright stellar cores and halos survive removal, and side views expose a thin cloud. The original NOIRLab-only view covers about 60% of the historical model's projected emission; the wider Niittee field covers about 99.84%. Those model-specific coverage figures do not describe all Pleiades dust. Absolute outer-field astrometry remains unqualified beyond the central matched overlap.

All lenses share an authored finite depth surface. Gibson & Nordsieck's scattering interpretation and Ritchey et al.'s absorption sightlines motivate local ordering, but the compiler does not recover multiple dust layers, extinction, illuminating-star distances or a scattering phase function. The [physical ledger](../../../labs/nebula/models/m45/physical-evidence.json) and [lab README](../../../labs/nebula/models/m45/README.md) retain those assumptions and excluded UV, 2MASS, IRIS and wider-image candidates.

## Current surrounding stars

The 14 September 2026 app delivery adds 420 shared lights from the pinned [stellar field](source/stellar-field.json): 414 Gaia DR3 rows inside a 20 pc sphere, selected at G < 12. The [shared method](../../../docs/nebulae/stellar-fields.md) records proper-motion propagation, Bailer-Jones distance uncertainty, photometric display scaling, radial fading and the 1,500-point budget. Stars are independent of the image footprint and are not confirmed nebula members.

The displayed set contains 412 Gaia sources and eight retained Hipparcos stars after directional duplicate removal. Those eight retain their previously declared conditional depths.

The verified cloud replay is `cd1f89e3e0affb327370338346df7f5812c0109ebd46cffeb9c8f702b94ed70c`. Resource hashes and source-card bindings passed with the new catalogue; cloud geometry and spectral images are unchanged by this starfield replacement. No new clean-cache native-processing claim is made.
